import { z } from "zod";

export const transparentCheckoutBodySchema = z
  .object({
    items: z.array(z.object({}).passthrough()).min(1),
    shippingAddress: z.any().optional(),
    purchaseMode: z.string().optional(),
    paymentMethod: z.string().optional(),
    subscriptionConfig: z.any().optional(),
  })
  .passthrough();

export const transparentVerifyBodySchema = z
  .object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1),
    intentId: z.string().optional(),
  })
  .passthrough();

export const transparentStatusBodySchema = z
  .object({
    status: z.string().min(1),
    reason: z.string().optional(),
  })
  .passthrough();

export const objectIdParamSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();
