/**
 * Razorpay Webhook Handler
 * Receives and processes payment events from Razorpay
 */

import crypto from "crypto";
import Order from "../models/OrderModel.js";
import Product from "../models/ProductModel.js";
import {
  validatePaymentSignature,
  verifyPaymentAmount,
  isValidPaymentStatus,
  parsePaymentNotes,
} from "./paymentValidator.js";

/**
 * Verify webhook signature from Razorpay
 * @param {object} eventData - The webhook event data
 * @param {string} webhookSignature - Signature from webhook header
 * @param {string} webhookSecret - Webhook secret from Razorpay dashboard
 * @returns {boolean} True if webhook is authentic
 */
export const verifyWebhookSignature = (eventData, webhookSignature, webhookSecret) => {
  const body = JSON.stringify(eventData);
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  return expectedSignature === webhookSignature;
};

/**
 * Handle payment.authorized event
 * Payment is authorized but not captured yet
 */
export const handlePaymentAuthorized = async (payment) => {
  try {
    console.log(`✓ Payment Authorized: ${payment.id}`);
    
    // Store webhook receipt timestamp
    const order = await Order.findOne({
      razorpayPaymentId: payment.id,
    }).select("webhookReceivedAt");

    if (order) {
      order.webhookReceivedAt = new Date();
      order.paymentStatus = "authorized";
      await order.save();
    }

    return { success: true, message: "Payment authorized" };
  } catch (error) {
    console.error("Error handling payment authorized:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Handle payment.captured event
 * Payment is successfully captured - THIS IS FINAL CONFIRMATION
 */
export const handlePaymentCaptured = async (payment, razorpayInstance) => {
  try {
    console.log(`✓ Payment Captured: ${payment.id}`);

    // Verify payment signature with order details
    if (!payment.notes || !payment.notes.items) {
      throw new Error("Payment notes missing items data");
    }

    const parsedData = parsePaymentNotes(payment.notes);
    const { consumerId, items, amount, addressData } = parsedData;

    // Verify amount
    if (!verifyPaymentAmount(amount, payment.amount)) {
      throw new Error(
        `Amount mismatch: Expected ${amount}, Got ${payment.amount / 100}`
      );
    }

    // Check if order already exists for this payment
    let order = await Order.findOne({
      razorpayPaymentId: payment.id,
    });

    if (order) {
      // Order already created - idempotency check
      console.log(`Order already exists for payment ${payment.id}`);
      return {
        success: true,
        message: "Order already processed for this payment",
        orderId: order._id,
      };
    }

    // Create order with paid status
    order = await Order.create({
      consumer: consumerId,
      items: items.map((item) => ({
        product: item.product || item._id,
        farmer: item.farmer,
        quantity: item.quantity || item.qty,
        price: item.price,
        image: item.image,
      })),
      totalAmount: amount,
      orderType: payment.notes.orderType || "delivery",
      status: "pending",
      deliveryDetails: {
        address: {
          street: addressData.address || addressData.street,
          city: addressData.city,
          state: addressData.state,
          zipCode: addressData.pincode || addressData.zipCode,
        },
      },
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      webhookReceivedAt: new Date(),
    });

    console.log(`✓ Order created via webhook: ${order._id}`);

    return {
      success: true,
      message: "Order created successfully",
      orderId: order._id,
    };
  } catch (error) {
    console.error("Error handling payment captured:", error);

    // Log failed webhooks for manual review
    await logFailedWebhook({
      event: "payment.captured",
      paymentId: payment.id,
      error: error.message,
      timestamp: new Date(),
    });

    return { success: false, error: error.message };
  }
};

/**
 * Handle payment.failed event
 * Payment failed - implement rollback if needed
 */
export const handlePaymentFailed = async (payment) => {
  try {
    console.log(`✗ Payment Failed: ${payment.id}`);

    // Find order with this payment
    const order = await Order.findOne({
      razorpayPaymentId: payment.id,
    });

    if (order) {
      order.paymentStatus = "failed";
      order.status = "cancelled";
      await order.save();

      // Restore stock if it was reserved
      await restoreStock(order);
    }

    return { success: true, message: "Payment failure handled" };
  } catch (error) {
    console.error("Error handling payment failed:", error);
    return { success: false, error: error.message };
  }
};

/**
 * Restore reserved stock on payment failure
 */
async function restoreStock(order) {
  try {
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantityAvailable =
          (product.quantityAvailable || 0) + item.quantity;
        await product.save();
        console.log(`Stock restored for product: ${item.product}`);
      }
    }
  } catch (error) {
    console.error("Error restoring stock:", error);
  }
}

/**
 * Log failed webhooks for manual review
 */
async function logFailedWebhook(data) {
  try {
    // TODO: Implement webhook logging to database
    console.error("Failed webhook:", data);
  } catch (error) {
    console.error("Error logging webhook:", error);
  }
}

/**
 * Handle webhook events dispatcher
 */
export const handleWebhookEvent = async (event, payload, razorpayInstance) => {
  const { event: eventType, payload: paymentData } = event;

  switch (eventType) {
    case "payment.authorized":
      return await handlePaymentAuthorized(paymentData.payment);

    case "payment.captured":
      return await handlePaymentCaptured(paymentData.payment, razorpayInstance);

    case "payment.failed":
      return await handlePaymentFailed(paymentData.payment);

    case "payment.international.authorized":
    case "payment.international.captured":
      console.log(`International payment: ${eventType}`);
      return { success: true, message: "International payment noted" };

    default:
      console.log(`Unhandled webhook event: ${eventType}`);
      return { success: true, message: "Event noted but not processed" };
  }
};
