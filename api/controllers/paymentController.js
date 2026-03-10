import Order from '../models/OrderModel.js';
import Product from '../models/ProductModel.js';
import User from '../models/UserModel.js';
import { requireRazorpayInstance } from '../config/razorpay.js';
import {
  fetchRazorpayPayment,
  verifyRazorpaySignature,
} from "../services/razorpayVerificationService.js";
import { generateReceiptPDF } from '../utils/pdfGenerator.js';
import {
  sendEmail,
  sendOrderConfirmation,
  sendPaymentFailedEmail,
  sendPaymentSuccessEmail,
} from '../utils/sendEmail.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { logError } from "../utils/safeLogger.js";
import {
  resolveStoredFilePath,
  uploadReceiptToCloudinary,
} from "../utils/receiptStorage.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRootDir = path.join(__dirname, "..");

const persistReceiptStorage = async (orderDoc, localReceiptUrl) => {
  orderDoc.receiptLocalPath = localReceiptUrl;

  const localReceiptFilePath = resolveStoredFilePath(projectRootDir, localReceiptUrl, localReceiptUrl);
  const uploadResult = await uploadReceiptToCloudinary({
    localFilePath: localReceiptFilePath,
    orderId: orderDoc?._id,
    receiptType: "receipt",
  });

  orderDoc.receiptUrl = uploadResult.uploaded && uploadResult.secureUrl
    ? uploadResult.secureUrl
    : localReceiptUrl;
};

/**
 * @desc    Create Razorpay Order
 * @route   POST /api/payments/razorpay/create-order
 * @access  Private (Consumer)
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    if (req.user?.role !== 'consumer' && req.user?.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only consumers can create payment orders'
      });
    }

    const { amount, items, addressData } = req.body;

    if (!amount || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount and items are required'
      });
    }

    // Validate stock availability
    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) {
        return res.status(404).json({
          success: false,
          message: `Product not found: ${item.product}`
        });
      }

      const availableStock = product.countInStock || product.quantityAvailable || 0;
      if (availableStock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}`
        });
      }
    }

    // Create Razorpay order
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        consumerId: req.user._id.toString(),
        items: JSON.stringify(items),
        amount: amount.toString(),
        addressData: JSON.stringify(addressData || {}),
        orderType: req.body.orderType || 'delivery'
      }
    };

    const razorpay = requireRazorpayInstance();
    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      message: 'Razorpay order created successfully'
    });
  } catch (error) {
    if (error?.code === "RAZORPAY_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: error.message });
    }
    logError("RAZORPAY_ORDER_CREATE_ERROR", { message: error?.message || String(error) });
    res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: error.message
    });
  }
};

/**
 * @desc    Verify Razorpay Payment Signature
 * @route   POST /api/payments/razorpay/verify
 * @access  Private (Consumer)
 */
export const verifyRazorpayPayment = async (req, res) => {
  try {
    if (req.user?.role !== 'consumer' && req.user?.role !== 'user') {
      return res.status(403).json({
        success: false,
        message: 'Only consumers can verify payments'
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment verification data'
      });
    }

    // Verify signature
    const isAuthentic = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (!isAuthentic) {
      try {
        const failedOrder = await Order.findById(orderId).populate('consumer', 'name email');
        if (failedOrder) {
          failedOrder.paymentStatus = 'failed';
          await failedOrder.save();
          await sendPaymentFailedEmail({
            order: failedOrder,
            customer: failedOrder.consumer,
            reason: 'Invalid payment signature',
          });
        }
      } catch (emailError) {
        logError("PAYMENT_FAILED_EMAIL_ERROR", { message: emailError?.message || String(emailError) });
      }
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Fetch payment details from Razorpay
    const paymentInfo = await fetchRazorpayPayment(razorpay_payment_id);

    // Verify payment amount matches order amount
    const order = await Order.findById(orderId).populate('consumer', 'name email');
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Verify order belongs to user
    if (order.consumer._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized: Order does not belong to you'
      });
    }

    if (order.paymentMethod !== 'razorpay') {
      return res.status(400).json({
        success: false,
        message: 'Payment method is not Razorpay for this order'
      });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment already verified for this order'
      });
    }

    // Verify payment amount (convert paise to rupees)
    const paidAmount = paymentInfo.amount / 100;
    if (Math.abs(paidAmount - order.totalAmount) > 0.01) {
      try {
        order.paymentStatus = 'failed';
        await order.save();
        await sendPaymentFailedEmail({
          order,
          customer: order.consumer,
          reason: 'Payment amount mismatch',
        });
      } catch (emailError) {
        logError("PAYMENT_FAILED_EMAIL_ERROR", { message: emailError?.message || String(emailError) });
      }
      return res.status(400).json({
        success: false,
        message: 'Payment amount mismatch'
      });
    }

    // Update order with payment details
    order.paymentStatus = 'paid';
    order.razorpay_order_id = razorpay_order_id;
    order.razorpay_payment_id = razorpay_payment_id;
    order.razorpayOrderId = razorpay_order_id;
    order.razorpayPaymentId = razorpay_payment_id;
    order.razorpay_signature = razorpay_signature;
    order.status = 'accepted';
    order.webhookReceivedAt = new Date();

    // Generate receipt PDF
    if (!order.receiptGenerated) {
      try {
        // Get all unique farmers from order items
        const farmerIds = [...new Set(order.items.map(item => item.farmer.toString()))];
        const farmers = await User.find({ _id: { $in: farmerIds } }).select('name email');

        const receiptPath = await generateReceiptPDF(order, order.consumer, farmers);
        await persistReceiptStorage(order, receiptPath);
        order.receiptGenerated = true;
        order.receiptGeneratedAt = new Date();
      } catch (pdfError) {
        logError("RECEIPT_GENERATION_ERROR", { message: pdfError?.message || String(pdfError) });
        // Don't fail payment verification if PDF generation fails
      }
    }

    await order.save();

    try {
      await sendPaymentSuccessEmail({ order, customer: order.consumer });
    } catch (emailError) {
      logError("PAYMENT_SUCCESS_EMAIL_ERROR", { message: emailError?.message || String(emailError) });
    }

    try {
      await sendOrderConfirmation(order, order.consumer?.email);
    } catch (emailError) {
      logError("ORDER_CONFIRMATION_EMAIL_ERROR", { message: emailError?.message || String(emailError) });
    }

    // Send receipt email with PDF attachment
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
                <p>Your payment for Order #${order._id.toString().toUpperCase()} has been confirmed.</p>
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
        logError("RECEIPT_EMAIL_ERROR", { message: emailError?.message || String(emailError) });
        // Don't fail payment verification if email fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified successfully',
      order: {
        _id: order._id,
        paymentStatus: order.paymentStatus,
        receiptUrl: order.receiptUrl
      }
    });
  } catch (error) {
    if (error?.code === "RAZORPAY_NOT_CONFIGURED") {
      return res.status(503).json({ success: false, message: error.message });
    }
    logError("PAYMENT_VERIFICATION_ERROR", { message: error?.message || String(error) });
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: error.message
    });
  }
};
