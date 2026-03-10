import { z } from "zod";

export const registerBodySchema = z
  .object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(["consumer", "farmer", "admin", "user"]).optional(),
    phone: z.string().min(1),
    address: z.any().optional(),
  })
  .passthrough();

export const loginBodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .passthrough();

export const emailOnlyBodySchema = z
  .object({
    email: z.string().email(),
  })
  .passthrough();

export const resetPasswordBodySchema = z
  .object({
    email: z.string().email(),
    otp: z.string().min(4),
    newPassword: z.string().min(6),
  })
  .passthrough();
