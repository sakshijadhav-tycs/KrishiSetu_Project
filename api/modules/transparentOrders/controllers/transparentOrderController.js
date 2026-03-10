import {
  createTransparentCheckoutOrder,
  getCustomerTransparentOrders,
  getFarmerTransparentSubOrders,
  getTransparentInvoiceForDownload,
  getTransparentAdminSummary,
  getTransparentOrderDetails,
  getTransparentReturnRequestsForAdmin,
  markSubOrderDelivered,
  requestTransparentOrderReturn,
  reviewTransparentReturnRequest,
  updateSubOrderFulfillmentStatus,
  markSubOrderTransferred,
  runSettlementSweep,
  verifyTransparentPaymentAndCreateOrders,
} from "../services/transparentOrderService.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import MainOrder from "../../../models/MainOrderModel.js";
import User from "../../../models/UserModel.js";
import CheckoutIntent from "../../../models/CheckoutIntentModel.js";
import OrderItem from "../../../models/OrderItemModel.js";
import SubOrder from "../../../models/SubOrderModel.js";
import { generateTransparentReceiptPDF } from "../../../utils/pdfGenerator.js";
import {
  sendInvoiceDownloadNotification,
  sendOrderCancellationEmail,
  sendOrderConfirmation,
  sendPaymentFailedEmail,
  sendPaymentReceiptEmail,
  sendPaymentSuccessEmail,
} from "../../../utils/sendEmail.js";
import {
  resolveStoredFilePath,
  uploadReceiptToCloudinary,
} from "../../../utils/receiptStorage.js";

const errorResponse = (res, status, message) =>
  res.status(status).json({ success: false, message });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.join(__dirname, "../../../");

const persistReceiptStorage = async (orderDoc, localReceiptUrl) => {
  orderDoc.receiptLocalPath = localReceiptUrl;

  const localReceiptFilePath = resolveStoredFilePath(projectRootDir, localReceiptUrl, localReceiptUrl);
  const uploadResult = await uploadReceiptToCloudinary({
    localFilePath: localReceiptFilePath,
    orderId: orderDoc?._id,
    receiptType: "receipt-transparent",
  });

  orderDoc.receiptUrl = uploadResult.uploaded && uploadResult.secureUrl
    ? uploadResult.secureUrl
    : localReceiptUrl;
};

export const createCheckoutOrder = async (req, res) => {
  try {
    if (!["consumer", "user"].includes(req.user?.role)) {
      return errorResponse(res, 403, "Only consumers can create checkout orders");
    }
    const data = await createTransparentCheckoutOrder({
      customerId: req.user._id,
      cartItems: req.body.items,
      shippingAddress: req.body.shippingAddress,
      purchaseMode: req.body.purchaseMode,
      paymentMethod: req.body.paymentMethod,
      subscriptionConfig: req.body.subscriptionConfig,
    });

    if (data?.mainOrderId && data?.requiresPayment === false) {
      setImmediate(async () => {
        try {
          const [mainOrder, customer] = await Promise.all([
            MainOrder.findById(data.mainOrderId).lean(),
            User.findById(req.user._id).select("name email").lean(),
          ]);
          if (mainOrder && customer?.email) {
            await sendOrderConfirmation(mainOrder, customer.email);
          }
        } catch (emailError) {
          console.error("TRANSPARENT_ORDER_CONFIRM_EMAIL_ERROR:", emailError?.message || emailError);
        }
      });
    }

    return res.status(201).json({
      success: true,
      message: "Transparent checkout order created",
      data,
    });
  } catch (error) {
    return errorResponse(res, 400, error.message || "Failed to create checkout");
  }
};

export const verifyPaymentAndSplitOrder = async (req, res) => {
  try {
    if (!["consumer", "user"].includes(req.user?.role)) {
      return errorResponse(res, 403, "Only consumers can verify payments");
    }
    const data = await verifyTransparentPaymentAndCreateOrders({
      customerId: req.user._id,
      ...req.body,
    });

    if (data?.mainOrderId && !data?.alreadyProcessed) {
      setImmediate(async () => {
        try {
          const [mainOrderDoc, customer, items, subOrders] = await Promise.all([
            MainOrder.findById(data.mainOrderId),
            User.findById(req.user._id).select("name email").lean(),
            OrderItem.find({ orderId: data.mainOrderId }).sort({ createdAt: 1 }).lean(),
            SubOrder.find({ orderId: data.mainOrderId }).populate("farmerId", "name").lean(),
          ]);

          if (mainOrderDoc && customer?.email) {
            await sendOrderConfirmation(mainOrderDoc, customer.email);
            await sendPaymentSuccessEmail({ order: mainOrderDoc, customer });

            if (!mainOrderDoc.receiptGenerated || !mainOrderDoc.receiptUrl) {
              const receiptPath = await generateTransparentReceiptPDF(
                mainOrderDoc.toObject(),
                customer,
                items,
                subOrders
              );
              await persistReceiptStorage(mainOrderDoc, receiptPath);
              mainOrderDoc.receiptGenerated = true;
              mainOrderDoc.receiptGeneratedAt = new Date();
              await mainOrderDoc.save();
            }

            if (mainOrderDoc.receiptUrl) {
              await sendPaymentReceiptEmail({
                order: mainOrderDoc.toObject(),
                customer,
                attachmentPath: resolveStoredFilePath(
                  projectRootDir,
                  mainOrderDoc.receiptUrl,
                  mainOrderDoc.receiptLocalPath
                ),
                attachmentFilename: `receipt-${String(mainOrderDoc._id).slice(-8)}.pdf`,
              });
            }
          }
        } catch (emailError) {
          console.error("TRANSPARENT_PAYMENT_EMAIL_ERROR:", emailError?.message || emailError);
        }
      });
    }

    return res.status(200).json({
      success: true,
      message: data?.alreadyProcessed
        ? "Payment already processed for this intent"
        : "Payment verified and transparent split order created",
      data,
    });
  } catch (error) {
    if (req.body?.intentId) {
      setImmediate(async () => {
        try {
          const [intent, customer] = await Promise.all([
            CheckoutIntent.findById(req.body.intentId).lean(),
            User.findById(req.user._id).select("name email").lean(),
          ]);
          if (intent && customer?.email) {
            await sendPaymentFailedEmail({
              order: {
                _id: intent._id,
                totalAmount: intent?.pricingSnapshot?.totalAmount || 0,
              },
              customer,
              reason: error.message || "Payment verification failed",
            });
          }
        } catch (emailError) {
          console.error("TRANSPARENT_PAYMENT_FAILED_EMAIL_ERROR:", emailError?.message || emailError);
        }
      });
    }

    return errorResponse(
      res,
      error.message?.toLowerCase()?.includes("unauthorized") ? 403 : 400,
      error.message || "Payment verification failed"
    );
  }
};

export const getMyMainOrders = async (req, res) => {
  try {
    if (!["consumer", "user"].includes(req.user?.role)) {
      return errorResponse(res, 403, "Only consumers can view their main orders");
    }
    const data = await getCustomerTransparentOrders(req.user._id);
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch orders");
  }
};

export const getMainOrderDetails = async (req, res) => {
  try {
    const data = await getTransparentOrderDetails({
      orderId: req.params.id,
      user: req.user,
    });
    return res.json({ success: true, data });
  } catch (error) {
    const status = error.message?.toLowerCase().includes("unauthorized")
      ? 403
      : 404;
    return errorResponse(res, status, error.message || "Order not found");
  }
};

export const getFarmerSubOrderList = async (req, res) => {
  try {
    const data = await getFarmerTransparentSubOrders(req.user._id, {
      paymentMethod: req.query?.paymentMethod || "all",
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch farmer sub-orders");
  }
};

export const setSubOrderDelivered = async (req, res) => {
  try {
    const data = await markSubOrderDelivered({
      subOrderId: req.params.id,
      userId: req.user._id,
    });
    return res.json({
      success: true,
      message: "Sub-order marked delivered. Return window started.",
      data,
    });
  } catch (error) {
    const status = error.message?.toLowerCase().includes("unauthorized")
      ? 403
      : 404;
    return errorResponse(res, status, error.message || "Failed to update");
  }
};

export const setSubOrderStatus = async (req, res) => {
  try {
    const requestedStatus = String(req.body?.status || "").trim().toLowerCase();
    const cancellationReason = String(req.body?.reason || "").trim();
    const data = await updateSubOrderFulfillmentStatus({
      subOrderId: req.params.id,
      userId: req.user._id,
      nextStatus: req.body?.status,
      cancellationReason,
    });

    if (requestedStatus === "cancelled" && data?.orderId) {
      setImmediate(async () => {
        try {
          const mainOrderId = data?.orderId?._id || data?.orderId;
          const [mainOrderDoc, items] = await Promise.all([
            MainOrder.findById(mainOrderId).lean(),
            OrderItem.find({ orderId: mainOrderId }).sort({ createdAt: 1 }).lean(),
          ]);
          const customer = mainOrderDoc?.customerId
            ? await User.findById(mainOrderDoc.customerId).select("name email").lean()
            : null;

          if (mainOrderDoc && customer?.email) {
            const emailOrder = {
              ...mainOrderDoc,
              consumer: customer,
              items: (items || []).map((item) => ({
                name: item?.productName || "Fresh Farm Product",
                quantity: Number(item?.quantity || 0),
                price: Number(item?.price || 0),
              })),
            };
            await sendOrderCancellationEmail(
              emailOrder,
              customer.email,
              cancellationReason || data?.cancellationReason || "Cancelled by farmer"
            );
          }
        } catch (emailError) {
          console.error("TRANSPARENT_CANCEL_EMAIL_ERROR:", emailError?.message || emailError);
        }
      });
    }

    return res.json({
      success: true,
      message: "Sub-order status updated",
      data,
    });
  } catch (error) {
    const lowered = String(error.message || "").toLowerCase();
    const status = lowered.includes("unauthorized")
      ? 403
      : lowered.includes("invalid")
        ? 400
        : 404;
    return errorResponse(res, status, error.message || "Failed to update");
  }
};

export const submitReturnRequest = async (req, res) => {
  try {
    const data = await requestTransparentOrderReturn({
      orderId: req.params.id,
      userId: req.user._id,
      reason: req.body?.reason,
    });
    return res.json({
      success: true,
      message: "Return request submitted",
      data,
    });
  } catch (error) {
    const lowered = String(error.message || "").toLowerCase();
    const status = lowered.includes("unauthorized")
      ? 403
      : lowered.includes("not found")
        ? 404
        : 400;
    return errorResponse(res, status, error.message || "Failed to submit return request");
  }
};

export const reviewReturnRequest = async (req, res) => {
  try {
    const data = await reviewTransparentReturnRequest({
      subOrderId: req.params.id,
      userId: req.user._id,
      decision: req.body?.decision,
    });
    return res.json({
      success: true,
      message: `Return request ${String(req.body?.decision || "").toLowerCase()}`,
      data,
    });
  } catch (error) {
    const lowered = String(error.message || "").toLowerCase();
    const status = lowered.includes("unauthorized")
      ? 403
      : lowered.includes("not found")
        ? 404
        : 400;
    return errorResponse(res, status, error.message || "Failed to review return request");
  }
};

export const getAdminReturnRequests = async (req, res) => {
  try {
    const data = await getTransparentReturnRequestsForAdmin();
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch return requests");
  }
};

export const getAdminFinanceSummary = async (req, res) => {
  try {
    const data = await getTransparentAdminSummary();
    return res.json({ success: true, data });
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch admin summary");
  }
};

export const triggerSettlementSweep = async (req, res) => {
  try {
    const data = await runSettlementSweep({ source: "manual:transparent_admin_endpoint" });
    return res.json({
      success: true,
      message: "Settlement sweep executed",
      data,
    });
  } catch (error) {
    return errorResponse(res, 500, "Settlement sweep failed");
  }
};

export const transferSubOrderPayout = async (req, res) => {
  try {
    const data = await markSubOrderTransferred({ subOrderId: req.params.id });
    return res.json({
      success: true,
      message: "Sub-order payout marked as transferred",
      data,
    });
  } catch (error) {
    return errorResponse(res, 404, error.message || "Sub-order not found");
  }
};

export const downloadMainOrderInvoice = async (req, res) => {
  try {
    const data = await getTransparentInvoiceForDownload({
      orderId: req.params.id,
      user: req.user,
    });
    const invoiceFilePath = resolveStoredFilePath(projectRootDir, data.invoiceUrl);

    if (!fs.existsSync(invoiceFilePath)) {
      return errorResponse(res, 404, "Invoice file not found");
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="invoice-transparent-${data.orderId}.pdf"`
    );

    setImmediate(async () => {
      try {
        const [mainOrder, customer] = await Promise.all([
          MainOrder.findById(data.orderId).lean(),
          User.findById(req.user._id).select("name email").lean(),
        ]);
        if (mainOrder && customer?.email) {
          await sendInvoiceDownloadNotification({ order: mainOrder, customer });
        }
      } catch (emailError) {
        console.error("TRANSPARENT_INVOICE_DOWNLOAD_EMAIL_ERROR:", emailError?.message || emailError);
      }
    });

    const fileStream = fs.createReadStream(invoiceFilePath);
    fileStream.pipe(res);
  } catch (error) {
    const lowered = String(error.message || "").toLowerCase();
    const status = lowered.includes("unauthorized")
      ? 403
      : lowered.includes("not found")
        ? 404
        : 500;
    return errorResponse(res, status, error.message || "Failed to download invoice");
  }
};
