import Order from "../models/OrderModel.js";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import {
  sendEmail,
  sendOrderConfirmation,
  sendOrderCancellationEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
  sendInvoiceDownloadNotification,
  sendReceiptDownloadNotification,
} from "../utils/sendEmail.js";
import { generateInvoicePDF, generateReceiptPDF } from "../utils/pdfGenerator.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  autoReactivateExpiredSuspensions,
  getFarmerAccountBlockReason,
} from "../utils/accountStatus.js";
import Settings from "../models/SettingsModel.js";
import { getAppliedDealForProduct } from "../utils/dealPricing.js";
import {
  isRemoteFileUrl,
  resolveStoredFilePath,
  uploadReceiptToCloudinary,
} from "../utils/receiptStorage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.join(__dirname, "..");
const getUniqueFarmerIds = (items = []) =>
  [...new Set(
    items
      .map((item) => item?.farmer?._id?.toString?.() || item?.farmer?.toString?.())
      .filter((id) => id && id !== "[object Object]")
  )];

dotenv.config();

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const ORDER_STATUS_FLOW = {
  pending: ["accepted", "rejected"],
  accepted: ["processing"],
  processing: ["shipped"],
  shipped: ["delivered", "completed"],
  delivered: [],
  completed: [],
  rejected: [],
  cancelled: [],
};

const normalizeOrderStatus = (status = "") => {
  const normalized = String(status).toLowerCase().trim();
  if (normalized === "completed") return "delivered";
  return normalized;
};

const getCommissionPercent = async () => {
  const settings = await Settings.findOne().select("defaultCommissionPercent").lean();
  const configured = Number(settings?.defaultCommissionPercent);
  return Number.isFinite(configured) && configured > 0 ? configured : 10;
};

const buildTrackingId = (orderLike) => {
  const seed = String(orderLike?._id || `${Date.now()}`);
  return `KS-${seed.slice(-8).toUpperCase()}`;
};

const FARMER_CANCELLABLE_STATUSES = new Set(["pending", "accepted"]);
const ONLINE_PAYMENT_METHODS = new Set(["razorpay", "online"]);

const toStatusToken = (status = "") => String(status || "").toLowerCase().trim();

const persistReceiptStorage = async (orderDoc, localReceiptUrl, receiptType = "receipt") => {
  orderDoc.receiptLocalPath = localReceiptUrl;

  const localReceiptFilePath = resolveStoredFilePath(projectRootDir, localReceiptUrl, localReceiptUrl);
  const uploadResult = await uploadReceiptToCloudinary({
    localFilePath: localReceiptFilePath,
    orderId: orderDoc?._id,
    receiptType,
  });

  orderDoc.receiptUrl = uploadResult.uploaded && uploadResult.secureUrl
    ? uploadResult.secureUrl
    : localReceiptUrl;
};

// @desc    Create an order & Generate Razorpay ID
export const createOrder = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();

    const { 
      items,
      pickupDetails,
      deliveryDetails,
      notes,
      paymentMethod,
      orderType,
      subscription, // optional { enabled: boolean, frequency: 'weekly'|'monthly', productId }
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items provided" });
    }

    let totalAmount = 0;
    const finalItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ success: false, message: `Product not found: ${item.product}` });

      const farmer = await User.findById(product.farmer).select(
        "name accountStatus rejectionReason suspensionStartDate suspensionEndDate suspensionReason role"
      );
      const farmerState = getFarmerAccountBlockReason(farmer);
      if (farmerState.blocked) {
        return res.status(403).json({
          success: false,
          message: `New orders are disabled for farmer "${farmer?.name || product.farmer}".`,
          farmerState,
          productId: product._id,
        });
      }

      const availableStock = product.countInStock || product.quantityAvailable || 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}` });
      }

      const activeDeal = await getAppliedDealForProduct(product);
      const unitPrice = Number(activeDeal?.discountedPrice ?? product.price);
      totalAmount += unitPrice * item.quantity;
      
      finalItems.push({ 
        product: item.product,
        farmer: product.farmer, 
        quantity: item.quantity, 
        price: unitPrice,
        image: product.images ? product.images[0] : (product.image || "") 
      });

      if (product.countInStock !== undefined) product.countInStock -= item.quantity;
      if (product.quantityAvailable !== undefined) product.quantityAvailable -= item.quantity;
      await product.save();
    }

    const commissionPercent = await getCommissionPercent();
    const commissionAmount = Number(((totalAmount * commissionPercent) / 100).toFixed(2));
    const payoutAmount = Number((totalAmount - commissionAmount).toFixed(2));

    let razorpayOrderId = null;
    if (paymentMethod === "razorpay") {
      const options = {
        amount: Math.round(totalAmount * 100), 
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
      };
      const rzpOrder = await razorpayInstance.orders.create(options);
      razorpayOrderId = rzpOrder.id;
    }

    const order = await Order.create({
      consumer: req.user._id,
      items: finalItems,
      totalAmount,
      orderType,
      pickupDetails: orderType === "pickup" ? pickupDetails : undefined,
      deliveryDetails: orderType === "delivery" ? deliveryDetails : undefined,
      paymentMethod,
      paymentStatus: "pending",
      commissionPercentApplied: commissionPercent,
      commissionAmount,
      payoutAmount,
      payoutStatus: "Pending",
      razorpay_order_id: razorpayOrderId,
      razorpayOrderId, 
      notes,
      isSubscriptionOrder: Boolean(subscription?.enabled),
      subscriptionCycleLabel: subscription?.enabled
        ? `Subscription (${subscription.frequency || "custom"})`
        : "",
      statusTimeline: [
        {
          status: "pending",
          updatedByRole: "consumer",
          note: "Order placed",
        },
      ],
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    order.trackingId = buildTrackingId(order);
    await order.save();

    // Optional: create/update a subscription for the first product
    if (
      subscription &&
      subscription.enabled &&
      ["daily", "weekly", "monthly"].includes(subscription.frequency) &&
      items[0]?.product
    ) {
      try {
        const existing = await import("../models/SubscriptionModel.js").then(
          (m) => m.default
        );

        const product = await Product.findById(items[0].product);
        if (product) {
          const requestedStartDate = subscription.startDate
            ? new Date(subscription.startDate)
            : new Date();
          const startDate = Number.isNaN(requestedStartDate.getTime())
            ? new Date()
            : requestedStartDate;
          const nextDate = new Date(startDate);
          const durationDays = Number(subscription.durationDays || 30);
          const endDate = new Date(startDate);
          endDate.setDate(endDate.getDate() + durationDays);

          await existing.findOneAndUpdate(
            {
              customerId: req.user._id,
              productId: product._id,
              status: { $in: ["active", "paused"] },
            },
            {
              consumer: req.user._id,
              farmer: product.farmer,
              product: product._id,
              customerId: req.user._id,
              farmerId: product.farmer,
              productId: product._id,
              frequency: subscription.frequency,
              quantity: Number(subscription.quantity || items[0]?.quantity || 1),
              startDate,
              endDate,
              durationDays,
              status: "active",
              isActive: true,
              nextDeliveryDate: nextDate,
              nextOrderDate: nextDate,
            },
            { upsert: true, new: true }
          );
        }
      } catch (subErr) {
        // Do not break main order flow if subscription fails
        console.error("SUBSCRIPTION_CREATE_ERROR:", subErr.message);
      }
    }

    // Generate Invoice for COD orders and send email
    if (paymentMethod === "cod" || paymentMethod === "cash") {
        try {
            // Populate order with consumer and farmers for PDF generation
            const populatedOrder = await Order.findById(order._id)
                .populate("consumer", "name email")
                .populate("items.product", "name")
                .lean();

            // Get all unique farmers from order items
            const farmerIds = getUniqueFarmerIds(finalItems);
            const farmers = await User.find({ _id: { $in: farmerIds } }).select("name email").lean();

            // Generate invoice PDF
            const invoicePath = await generateInvoicePDF(populatedOrder, populatedOrder.consumer, farmers);
            
            // Update order with invoice URL
            order.invoiceUrl = invoicePath;
            order.invoiceGeneratedAt = new Date();
            await order.save();

            // Send invoice email with PDF attachment
            const invoiceFilePath = resolveStoredFilePath(projectRootDir, invoicePath);
            if (fs.existsSync(invoiceFilePath)) {
                await sendEmail({
                    email: req.user.email,
                    subject: `KrishiSetu - Order Invoice #${order._id.toString().substring(0, 8).toUpperCase()}`,
                    html: `
                        <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                            <h2 style="color: #16a34a;">Order Placed Successfully!</h2>
                            <p>Hi ${req.user.name},</p>
                            <p>Your order #${order._id.toString().toUpperCase()} has been placed successfully.</p>
                            <p>Please find your invoice attached. Payment is pending and will be collected on delivery.</p>
                            <p>Thank you for choosing KrishiSetu!</p>
                        </div>
                    `,
                    attachments: [{
                        filename: `invoice-${order._id}.pdf`,
                        path: invoiceFilePath
                    }]
                });
            } else {
                // Fallback to regular confirmation email if PDF generation fails
                await sendOrderConfirmation(order, req.user.email);
            }
        } catch (emailErr) {
            console.error("INVOICE_GENERATION_ERROR:", emailErr);
            // Fallback to regular confirmation email
            try {
                await sendOrderConfirmation(order, req.user.email);
            } catch (fallbackErr) {
                console.error("CONFIRM_EMAIL_ERROR:", fallbackErr);
            }
        }

        try {
          await sendOrderConfirmation(order, req.user.email);
        } catch (confirmErr) {
          console.error("ORDER_CONFIRMATION_EMAIL_ERROR:", confirmErr?.message || confirmErr);
        }
    }

    res.status(201).json({
      success: true,
      message: paymentMethod === "razorpay" ? "Payment Initiated" : "Order Placed Successfully",
      order,
    });

  } catch (error) {
    console.error("CREATE_ORDER_ERROR:", error);
    res.status(500).json({ success: false, message: "Error creating order", error: error.message });
  }
};

// @desc    Verify Razorpay Payment Signature
export const verifyPayment = async (req, res) => {
  try {
    if (req.user?.role !== "consumer" && req.user?.role !== "user") {
      return res.status(403).json({ success: false, message: "Only consumers can verify payments" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, dbOrderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !dbOrderId) {
      return res.status(400).json({ success: false, message: "Missing payment verification data" });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      try {
        const failedOrder = await Order.findById(dbOrderId).populate("consumer", "name email");
        if (failedOrder) {
          failedOrder.paymentStatus = "failed";
          await failedOrder.save();
          await sendPaymentFailedEmail({
            order: failedOrder,
            customer: failedOrder.consumer,
            reason: "Invalid payment signature",
          });
        }
      } catch (emailError) {
        console.error("PAYMENT_FAILED_EMAIL_ERROR:", emailError?.message || emailError);
      }
      return res.status(400).json({ success: false, message: "Invalid Signature" });
    }

    const paymentInfo = await razorpayInstance.payments.fetch(razorpay_payment_id);

    const updatedOrder = await Order.findById(dbOrderId)
      .populate("consumer", "name email")
      .populate("items.product", "name")
      .populate("items.farmer", "name email");

    if (!updatedOrder) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (updatedOrder.consumer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: Order does not belong to you" });
    }

    if (updatedOrder.paymentMethod !== "razorpay") {
      return res.status(400).json({ success: false, message: "This order is not a Razorpay payment order" });
    }

    if (updatedOrder.paymentStatus === "paid") {
      return res.status(400).json({ success: false, message: "Payment already confirmed" });
    }

    const paidAmount = paymentInfo.amount / 100;
    if (Math.abs(paidAmount - updatedOrder.totalAmount) > 0.01) {
      try {
        updatedOrder.paymentStatus = "failed";
        await updatedOrder.save();
        await sendPaymentFailedEmail({
          order: updatedOrder,
          customer: updatedOrder.consumer,
          reason: "Payment amount mismatch",
        });
      } catch (emailError) {
        console.error("PAYMENT_FAILED_EMAIL_ERROR:", emailError?.message || emailError);
      }
      return res.status(400).json({ success: false, message: "Payment amount mismatch" });
    }

    updatedOrder.paymentStatus = "paid";
    updatedOrder.razorpay_order_id = razorpay_order_id;
    updatedOrder.razorpay_payment_id = razorpay_payment_id;
    updatedOrder.razorpayOrderId = razorpay_order_id;
    updatedOrder.razorpayPaymentId = razorpay_payment_id;
    updatedOrder.razorpay_signature = razorpay_signature;
    updatedOrder.status = "accepted";
    updatedOrder.webhookReceivedAt = new Date();

    if (!updatedOrder.receiptGenerated) {
      try {
        const farmerIds = getUniqueFarmerIds(updatedOrder.items);
        const farmers = await User.find({ _id: { $in: farmerIds } }).select("name email").lean();
        const receiptPath = await generateReceiptPDF(updatedOrder.toObject(), updatedOrder.consumer.toObject(), farmers);
        await persistReceiptStorage(updatedOrder, receiptPath, "receipt");
        updatedOrder.receiptGenerated = true;
        updatedOrder.receiptGeneratedAt = new Date();
      } catch (pdfError) {
        console.error("RECEIPT_GENERATION_ERROR:", pdfError);
      }
    }

    await updatedOrder.save();
    try {
      await sendPaymentSuccessEmail({
        order: updatedOrder,
        customer: updatedOrder.consumer,
      });
    } catch (emailError) {
      console.error("PAYMENT_SUCCESS_EMAIL_ERROR:", emailError?.message || emailError);
    }

    try {
      await sendOrderConfirmation(updatedOrder, updatedOrder.consumer?.email);
    } catch (emailError) {
      console.error("ORDER_CONFIRMATION_EMAIL_ERROR:", emailError?.message || emailError);
    }

    if (updatedOrder.receiptUrl && updatedOrder.consumer.email) {
      try {
        const receiptFilePath = resolveStoredFilePath(
          projectRootDir,
          updatedOrder.receiptUrl,
          updatedOrder.receiptLocalPath
        );
        if (receiptFilePath && fs.existsSync(receiptFilePath)) {
          await sendEmail({
            email: updatedOrder.consumer.email,
            subject: `KrishiSetu - Payment Receipt #${updatedOrder._id.toString().substring(0, 8).toUpperCase()}`,
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                <h2 style="color: #16a34a;">Payment Confirmed!</h2>
                <p>Hi ${updatedOrder.consumer.name},</p>
                <p>Your payment for Order #${updatedOrder._id.toString().toUpperCase()} has been confirmed.</p>
                <p>Please find your payment receipt attached.</p>
                <p>Thank you for choosing KrishiSetu!</p>
              </div>
            `,
            attachments: [{
              filename: `receipt-${updatedOrder._id}.pdf`,
              path: receiptFilePath
            }]
          });
        }
      } catch (emailErr) {
        console.error("PAYMENT_EMAIL_ERROR:", emailErr);
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment Verified Successfully",
      order: {
        _id: updatedOrder._id,
        paymentStatus: updatedOrder.paymentStatus,
        receiptUrl: updatedOrder.receiptUrl
      }
    });
  } catch (error) {
    console.error("VERIFY_PAYMENT_ERROR:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// @desc    Get Single Order
export const getOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("consumer", "name email phone")
      .populate("items.farmer", "name phone") 
      .populate("items.product", "name images price");

    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    const isAdmin = req.user?.role === "admin";
    const isConsumer = order.consumer?._id?.toString?.() === req.user?._id?.toString?.();
    const isFarmer = (order.items || []).some(
      (item) => item?.farmer?._id?.toString?.() === req.user?._id?.toString?.()
    );
    if (!isAdmin && !isConsumer && !isFarmer) {
      return res.status(403).json({ success: false, message: "Unauthorized access" });
    }
    res.json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Consumer Orders
export const getConsumerOrders = async (req, res) => {
  try {
    const orders = await Order.find({ consumer: req.user._id })
      .populate("items.farmer", "name")
      .populate("items.product", "name images price")
      .sort("-createdAt");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get Farmer Orders
export const getFarmerOrders = async (req, res) => {
  try {
    const { category = "all", paymentMethod = "all" } = req.query;
    const normalizedCategory = String(category).toLowerCase();
    const query = { "items.farmer": req.user._id };

    if (normalizedCategory === "split") {
      return res.json({ success: true, data: [] });
    }
    if (normalizedCategory === "subscription") {
      query.isSubscriptionOrder = true;
    } else if (normalizedCategory === "single") {
      query.isSubscriptionOrder = { $ne: true };
    }

    const normalizedPayment = String(paymentMethod).toLowerCase();
    if (normalizedPayment === "razorpay") {
      query.paymentMethod = "razorpay";
    } else if (normalizedPayment === "cod") {
      query.paymentMethod = { $in: ["cod", "cash"] };
    }

    const orders = await Order.find(query)
      .populate("consumer", "name")
      .populate("items.product", "name images price")
      .sort("-createdAt");
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Get All Orders (Admin)
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("consumer", "name")
      .populate("items.farmer", "name")
      .populate("items.product", "name images")
      .sort("-createdAt");
    res.json({ success: true, count: orders.length, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Update Order Status
export const updateOrderStatus = async (req, res) => {
  try {
    const requestedStatus = normalizeOrderStatus(req.body?.status);
    if (requestedStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Use dedicated cancellation endpoint for order cancellation",
      });
    }
    if (!requestedStatus || !Object.prototype.hasOwnProperty.call(ORDER_STATUS_FLOW, requestedStatus)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    const isFarmerOwner = (order.items || []).some(
      (item) => item?.farmer?.toString() === req.user?._id?.toString()
    );
    if (!isFarmerOwner) {
      return res.status(403).json({ success: false, message: "Not authorized to update this order" });
    }

    const currentStatus = normalizeOrderStatus(order.status);
    if (currentStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Cancelled orders cannot be updated",
      });
    }
    if (currentStatus === requestedStatus) {
      return res.json({ success: true, message: "Status already up to date", data: order });
    }

    const allowedNext = ORDER_STATUS_FLOW[currentStatus] || [];
    if (!allowedNext.includes(requestedStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid transition from ${currentStatus} to ${requestedStatus}`,
      });
    }

    order.status = requestedStatus === "delivered" ? "completed" : requestedStatus;
    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    timeline.push({
      status: requestedStatus,
      updatedByRole: req.user?.role || "system",
      note: req.body?.note || "",
    });
    order.statusTimeline = timeline;

    if (requestedStatus === "delivered" || requestedStatus === "completed") {
      order.paymentStatus = order.paymentMethod === "razorpay" ? "paid" : order.paymentStatus;
      const now = new Date();
      order.deliveredAt = now;
      order.returnWindowEndsAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      order.autoSettleAt = new Date(order.returnWindowEndsAt.getTime());
      order.payoutStatus = "Pending";
    }
    if (requestedStatus === "cancelled" || requestedStatus === "rejected") {
      order.payoutStatus = "OnHold";
    }

    await order.save();
    await order.populate("consumer", "name");
    await order.populate("items.product", "name images price");
    await order.populate("items.farmer", "name");

    res.json({ success: true, message: "Status updated", data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// @desc    Cancel Order & Send Email
export const cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate("consumer", "name email");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    if (order.consumer?._id?.toString?.() !== req.user?._id?.toString?.() && req.user?.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this order" });
    }
    if (["cancelled"].includes(toStatusToken(order.status))) {
      return res.json({ success: true, message: "Order already cancelled" });
    }

    // Stock Refill Logic
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (product.countInStock !== undefined) product.countInStock += item.quantity;
        if (product.quantityAvailable !== undefined) product.quantityAvailable += item.quantity;
        await product.save();
      }
    }

    order.status = "cancelled";
    order.cancelledBy = req.user?.role === "admin" ? "ADMIN" : "CONSUMER";
    order.cancelledAt = new Date();
    order.cancellationReason = String(req.body?.reason || "").trim();
    order.payoutStatus = "OnHold";
    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    timeline.push({
      status: "cancelled",
      updatedByRole: req.user?.role || "consumer",
      note: order.cancellationReason ? `Order cancelled: ${order.cancellationReason}` : "Order cancelled",
    });
    order.statusTimeline = timeline;
    await order.save();

    if (order.consumer?.email) {
      try {
        await order.populate("items.product", "name");
        await sendOrderCancellationEmail(order, order.consumer.email, order.cancellationReason);
      } catch (mailErr) {
        console.error("MAIL_SEND_FAILURE:", mailErr.message);
      }
    }

    res.json({ success: true, message: "Order cancelled successfully" });
  } catch (error) {
    console.error("CANCEL_ORDER_ERROR:", error);
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Farmer cancels order with mandatory reason + refund/email workflow
export const cancelOrderByFarmer = async (req, res) => {
  try {
    const reason = String(req.body?.reason || "").trim();
    if (!reason) {
      return res.status(400).json({
        success: false,
        message: "Cancellation reason is required",
      });
    }

    const order = await Order.findById(req.params.id)
      .populate("consumer", "name email")
      .populate("items.product", "name")
      .populate("items.farmer", "name");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const actorFarmerId = req.user?._id?.toString?.();
    const itemFarmerIds = [...new Set((order.items || []).map((item) => item?.farmer?._id?.toString?.() || item?.farmer?.toString?.()).filter(Boolean))];
    const isOwnerFarmer = itemFarmerIds.length === 1 && itemFarmerIds[0] === actorFarmerId;
    if (!isOwnerFarmer) {
      return res.status(403).json({
        success: false,
        message: "Only the owner farmer can cancel this order",
      });
    }

    const normalizedCurrentStatus = toStatusToken(order.status);
    if (normalizedCurrentStatus === "cancelled") {
      return res.status(400).json({
        success: false,
        message: "Order already cancelled",
      });
    }
    if (["cancelled", "rejected", "delivered", "completed"].includes(normalizedCurrentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Cannot cancel delivered/completed/cancelled orders",
      });
    }
    if (!FARMER_CANCELLABLE_STATUSES.has(normalizedCurrentStatus)) {
      return res.status(400).json({
        success: false,
        message: "Farmer can cancel only pending or confirmed orders",
      });
    }

    const onlinePayment = ONLINE_PAYMENT_METHODS.has(toStatusToken(order.paymentMethod));
    const paymentId = order.razorpay_payment_id || order.razorpayPaymentId || "";
    const existingRefundStatus = toStatusToken(order.refund?.status || "none");
    const shouldAttemptRefund = onlinePayment && !["processed", "initiated"].includes(existingRefundStatus);
    const refundAmount = Number(order.totalAmount || 0);

    const now = new Date();
    const previousStatus = order.status;
    order.status = "cancelled";
    order.cancelledBy = "FARMER";
    order.cancelledAt = now;
    order.cancellationReason = reason;
    order.payoutStatus = "OnHold";

    const logs = Array.isArray(order.cancellationLogs) ? order.cancellationLogs : [];
    logs.push({
      cancelledBy: "FARMER",
      reason,
      statusBefore: String(previousStatus || ""),
      statusAfter: "cancelled",
      cancelledAt: now,
      cancelledByUser: req.user?._id || null,
    });
    order.cancellationLogs = logs;

    const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
    timeline.push({
      status: "cancelled",
      updatedByRole: "farmer",
      note: `Cancelled by farmer: ${reason}`,
    });
    order.statusTimeline = timeline;

    if (onlinePayment) {
      order.refund = {
        ...(order.refund?.toObject?.() || order.refund || {}),
        status: shouldAttemptRefund ? "initiated" : order.refund?.status || "processed",
        amount: refundAmount,
        failureReason: "",
      };
    } else {
      order.refund = {
        ...(order.refund?.toObject?.() || order.refund || {}),
        status: "not_required",
        amount: 0,
        failureReason: "",
      };
    }

    await order.save();

    const responseMeta = { refundStatus: order.refund?.status || "none" };

    if (shouldAttemptRefund) {
      if (!paymentId) {
        order.refund = {
          ...(order.refund?.toObject?.() || order.refund || {}),
          status: "failed",
          failureReason: "Missing Razorpay payment id for refund",
        };
        await order.save();
        responseMeta.refundStatus = "failed";
      } else {
        try {
          const refundResult = await razorpayInstance.payments.refund(paymentId, {
            amount: Math.round(refundAmount * 100),
            notes: {
              orderId: String(order._id),
              cancelledBy: "FARMER",
              reason,
            },
          });
          order.refund = {
            ...(order.refund?.toObject?.() || order.refund || {}),
            status: "processed",
            razorpayRefundId: refundResult?.id || "",
            refundedAt: new Date(),
            failureReason: "",
          };
          await order.save();
          responseMeta.refundStatus = "processed";
          responseMeta.refundId = refundResult?.id || "";
        } catch (refundError) {
          order.refund = {
            ...(order.refund?.toObject?.() || order.refund || {}),
            status: "failed",
            failureReason:
              refundError?.error?.description ||
              refundError?.message ||
              "Refund failed",
          };
          await order.save();
          responseMeta.refundStatus = "failed";
          responseMeta.refundError = order.refund.failureReason;
        }
      }
    }

    if (order.consumer?.email) {
      try {
        await sendOrderCancellationEmail(order, order.consumer.email, reason);
      } catch (emailError) {
        console.error("FARMER_CANCEL_EMAIL_ERROR:", emailError?.message || emailError);
      }
    }

    await order.populate("consumer", "name email");
    await order.populate("items.product", "name images price");
    await order.populate("items.farmer", "name");

    res.json({
      success: true,
      message: "Order cancelled by farmer",
      data: order,
      meta: responseMeta,
    });
  } catch (error) {
    console.error("CANCEL_ORDER_BY_FARMER_ERROR:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/**
 * @desc    Download Invoice PDF (COD orders)
 * @route   GET /api/orders/:id/invoice
 * @access  Private (Order owner only)
 */
export const downloadInvoice = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("consumer", "name email")
      .populate("items.product", "name")
      .populate("items.farmer", "name");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify ownership (consumer only)
    if (order.consumer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only download invoices for your own orders" });
    }

    if (order.paymentMethod !== "cod" && order.paymentMethod !== "cash") {
      return res.status(400).json({ success: false, message: "Invoice is available only for COD orders" });
    }

    // Generate invoice if not exists
    if (!order.invoiceUrl) {
      const farmerIds = getUniqueFarmerIds(order.items);
      const farmers = await User.find({ _id: { $in: farmerIds } }).select("name email").lean();
      
      const invoicePath = await generateInvoicePDF(order.toObject(), order.consumer.toObject(), farmers);
      order.invoiceUrl = invoicePath;
      order.invoiceGeneratedAt = new Date();
      await order.save();
    }

    const invoiceFilePath = resolveStoredFilePath(projectRootDir, order.invoiceUrl);
    
    if (!fs.existsSync(invoiceFilePath)) {
      return res.status(404).json({ success: false, message: "Invoice file not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="invoice-${order._id}.pdf"`);

    setImmediate(async () => {
      try {
        await sendInvoiceDownloadNotification({
          order,
          customer: order.consumer,
        });
      } catch (emailError) {
        console.error("INVOICE_DOWNLOAD_EMAIL_ERROR:", emailError?.message || emailError);
      }
    });
    
    const fileStream = fs.createReadStream(invoiceFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("DOWNLOAD_INVOICE_ERROR:", error);
    res.status(500).json({ success: false, message: "Error downloading invoice", error: error.message });
  }
};

/**
 * @desc    Download Receipt PDF (Paid orders)
 * @route   GET /api/orders/:id/receipt
 * @access  Private (Order owner only)
 */
export const downloadReceipt = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("consumer", "name email")
      .populate("items.product", "name")
      .populate("items.farmer", "name");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify ownership (consumer only)
    if (order.consumer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized: You can only download receipts for your own orders" });
    }

    // Check if order is paid
    if (order.paymentStatus !== "paid") {
      return res.status(400).json({ success: false, message: "Receipt can only be generated for paid orders" });
    }

    // Generate receipt if not exists
    if (!order.receiptUrl) {
      const farmerIds = getUniqueFarmerIds(order.items);
      const farmers = await User.find({ _id: { $in: farmerIds } }).select("name email").lean();
      
      const receiptPath = await generateReceiptPDF(order.toObject(), order.consumer.toObject(), farmers);
      await persistReceiptStorage(order, receiptPath, "receipt");
      order.receiptGenerated = true;
      order.receiptGeneratedAt = new Date();
      await order.save();
    }

    const receiptFilePath = resolveStoredFilePath(
      projectRootDir,
      order.receiptUrl,
      order.receiptLocalPath
    );
    
    if (!receiptFilePath || !fs.existsSync(receiptFilePath)) {
      if (isRemoteFileUrl(order.receiptUrl)) {
        return res.redirect(order.receiptUrl);
      }
      return res.status(404).json({ success: false, message: "Receipt file not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${order._id}.pdf"`);

    setImmediate(async () => {
      try {
        await sendReceiptDownloadNotification({
          order,
          customer: order.consumer,
        });
      } catch (emailError) {
        console.error("RECEIPT_DOWNLOAD_EMAIL_ERROR:", emailError?.message || emailError);
      }
    });
    
    const fileStream = fs.createReadStream(receiptFilePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("DOWNLOAD_RECEIPT_ERROR:", error);
    res.status(500).json({ success: false, message: "Error downloading receipt", error: error.message });
  }
};

/**
 * @desc    Confirm COD Payment (Farmer confirms payment received)
 * @route   POST /api/orders/:id/confirm-cod-payment
 * @access  Private (Farmer only - for their orders)
 */
export const confirmCODPayment = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("consumer", "name email")
      .populate("items.product", "name")
      .populate("items.farmer", "name");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Verify farmer owns at least one item in the order
    const farmerOwnsItem = order.items.some(item => 
      item.farmer._id.toString() === req.user._id.toString()
    );

    if (!farmerOwnsItem) {
      return res.status(403).json({ 
        success: false, 
        message: "Unauthorized: You can only confirm payment for your own orders" 
      });
    }

    // Check if order is COD
    if (order.paymentMethod !== "cod" && order.paymentMethod !== "cash") {
      return res.status(400).json({ 
        success: false, 
        message: "This endpoint is only for COD orders" 
      });
    }

    // Check if already paid
    if (order.paymentStatus === "paid") {
      return res.status(400).json({ 
        success: false, 
        message: "Payment already confirmed" 
      });
    }

    if (order.status !== "completed") {
      return res.status(400).json({
        success: false,
        message: "COD payment can be confirmed only after delivery is completed"
      });
    }

    // Update payment status
    order.paymentStatus = "paid";
    
    // Generate receipt PDF
    if (!order.receiptGenerated) {
      try {
        const farmerIds = getUniqueFarmerIds(order.items);
        const farmers = await User.find({ _id: { $in: farmerIds } }).select("name email").lean();
        
        const receiptPath = await generateReceiptPDF(order.toObject(), order.consumer.toObject(), farmers);
        await persistReceiptStorage(order, receiptPath, "receipt");
        order.receiptGenerated = true;
        order.receiptGeneratedAt = new Date();
      } catch (pdfError) {
        console.error("RECEIPT_GENERATION_ERROR:", pdfError);
        // Don't fail payment confirmation if PDF generation fails
      }
    }

    await order.save();

    try {
      await sendPaymentSuccessEmail({
        order,
        customer: order.consumer,
      });
    } catch (emailError) {
      console.error("PAYMENT_SUCCESS_EMAIL_ERROR:", emailError?.message || emailError);
    }

    // Send receipt email to customer
    if (order.receiptUrl && order.consumer.email) {
      try {
        const receiptFilePath = resolveStoredFilePath(
          projectRootDir,
          order.receiptUrl,
          order.receiptLocalPath
        );
        
        if (receiptFilePath && fs.existsSync(receiptFilePath)) {
          await sendEmail({
            email: order.consumer.email,
            subject: `KrishiSetu - Payment Receipt #${order._id.toString().substring(0, 8).toUpperCase()}`,
            html: `
              <div style="font-family: 'Segoe UI', sans-serif; padding: 20px;">
                <h2 style="color: #16a34a;">Payment Confirmed!</h2>
                <p>Hi ${order.consumer.name},</p>
                <p>Your COD payment for Order #${order._id.toString().toUpperCase()} has been confirmed by the farmer.</p>
                <p>Please find your payment receipt attached.</p>
                <p>Thank you for choosing KrishiSetu!</p>
              </div>
            `,
            attachments: [{
              filename: `receipt-${order._id}.pdf`,
              path: receiptFilePath
            }]
          });
        }
      } catch (emailError) {
        console.error("RECEIPT_EMAIL_ERROR:", emailError);
        // Don't fail payment confirmation if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: "COD payment confirmed successfully",
      order: {
        _id: order._id,
        paymentStatus: order.paymentStatus,
        receiptUrl: order.receiptUrl
      }
    });
  } catch (error) {
    console.error("CONFIRM_COD_PAYMENT_ERROR:", error);
    res.status(500).json({ success: false, message: "Error confirming COD payment", error: error.message });
  }
};
