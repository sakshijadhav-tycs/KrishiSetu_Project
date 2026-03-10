import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import {
  verifyRazorpaySignature,
  findOrderByRazorpayPaymentId,
} from "../services/razorpayVerificationService.js";
import Order from "../models/OrderModel.js";

let originalFindOne;

test.before(() => {
  process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "test_secret";
  originalFindOne = Order.findOne;
});

test.after(() => {
  Order.findOne = originalFindOne;
});

test("verifyRazorpaySignature returns true for valid signature", () => {
  const razorpay_order_id = "order_123";
  const razorpay_payment_id = "pay_123";
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const signature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(payload)
    .digest("hex");

  assert.equal(
    verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature: signature,
    }),
    true
  );
});

test("verifyRazorpaySignature returns false for invalid signature", () => {
  assert.equal(
    verifyRazorpaySignature({
      razorpay_order_id: "order_123",
      razorpay_payment_id: "pay_123",
      razorpay_signature: "invalid_signature",
    }),
    false
  );
});

test("findOrderByRazorpayPaymentId queries both canonical and compat fields", async () => {
  let capturedQuery = null;
  Order.findOne = async (query) => {
    capturedQuery = query;
    return null;
  };

  await findOrderByRazorpayPaymentId("pay_abc");

  assert.deepEqual(capturedQuery, {
    $or: [{ razorpay_payment_id: "pay_abc" }, { razorpayPaymentId: "pay_abc" }],
  });
});
