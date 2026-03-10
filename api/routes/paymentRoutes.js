import express from "express";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
} from "../controllers/paymentController.js";
import { verifyToken, isConsumer } from "../utils/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { paymentRateLimiter } from "../middleware/rateLimiter.js";
import {
  createRazorpayOrderBodySchema,
  verifyRazorpayPaymentBodySchema,
} from "../validators/paymentSchemas.js";

const router = express.Router();

// All payment routes require authentication
router.use(verifyToken, isConsumer);
router.use(paymentRateLimiter);
router.use((req, res, next) => {
  if (req.user?.role === "admin") {
    return res.status(403).json({
      success: false,
      message: "Admins cannot modify payment records"
    });
  }
  next();
});

// Razorpay payment endpoints
router.post(
  "/razorpay/create-order",
  validateRequest({ body: createRazorpayOrderBodySchema }),
  createRazorpayOrder
);
router.post(
  "/razorpay/verify",
  validateRequest({ body: verifyRazorpayPaymentBodySchema }),
  verifyRazorpayPayment
);

export default router;
