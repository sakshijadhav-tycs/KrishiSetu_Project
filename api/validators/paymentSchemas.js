import { z } from "zod";

export const createRazorpayOrderBodySchema = z
  .object({
    amount: z.coerce.number().positive(),
    items: z.array(z.object({}).passthrough()).min(1),
    addressData: z.any().optional(),
    orderType: z.string().optional(),
  })
  .passthrough();

export const verifyRazorpayPaymentBodySchema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    orderId: z.string().min(1),
  })
  .passthrough();

export const verifyOrderPaymentBodySchema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    dbOrderId: z.string().min(1),
  })
  .passthrough();

export const quickCheckoutBodySchema = z
  .object({
    amount: z.coerce.number().positive(),
  })
  .passthrough();

export const quickPaymentVerificationBodySchema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
  })
  .passthrough();
