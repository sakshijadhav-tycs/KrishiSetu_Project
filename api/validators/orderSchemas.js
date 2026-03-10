import { z } from "zod";

export const createOrderBodySchema = z
  .object({
    items: z.array(z.object({}).passthrough()).min(1),
    paymentMethod: z.string().min(1),
    orderType: z.string().min(1),
    pickupDetails: z.any().optional(),
    deliveryDetails: z.any().optional(),
    notes: z.string().optional(),
    subscription: z.any().optional(),
  })
  .passthrough();

export const cancelReasonBodySchema = z
  .object({
    reason: z.string().min(1),
  })
  .passthrough();

export const updateOrderStatusBodySchema = z
  .object({
    status: z.string().min(1),
    note: z.string().optional(),
  })
  .passthrough();
