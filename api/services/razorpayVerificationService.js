import crypto from "crypto";
import Order from "../models/OrderModel.js";
import { requireRazorpayInstance } from "../config/razorpay.js";

export const verifyRazorpaySignature = ({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) => {
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body.toString())
    .digest("hex");
  return expectedSignature === razorpay_signature;
};

export const fetchRazorpayPayment = async (razorpay_payment_id) => {
  const razorpay = requireRazorpayInstance();
  return razorpay.payments.fetch(razorpay_payment_id);
};

export const findOrderByRazorpayPaymentId = async (razorpay_payment_id) => {
  return Order.findOne({
    $or: [
      { razorpay_payment_id },
      { razorpayPaymentId: razorpay_payment_id },
    ],
  });
};
