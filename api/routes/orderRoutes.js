import express from "express";
import {
  createOrder,
  verifyPayment,
  getConsumerOrders,
  getFarmerOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  cancelOrderByFarmer,
  getAllOrders,
  downloadInvoice,
  downloadReceipt,
  confirmCODPayment,
} from "../controllers/orderController.js";

import {
  verifyToken,
  isConsumer,
  isFarmer,
  isAdmin,
} from "../utils/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { sensitiveRateLimiter } from "../middleware/rateLimiter.js";
import {
  cancelReasonBodySchema,
  createOrderBodySchema,
  updateOrderStatusBodySchema,
} from "../validators/orderSchemas.js";
import { verifyOrderPaymentBodySchema } from "../validators/paymentSchemas.js";

const router = express.Router();

// --- 1. Consumer Routes ---
router.post(
  "/",
  verifyToken,
  isConsumer,
  validateRequest({ body: createOrderBodySchema }),
  createOrder
);
router.post(
  "/verify",
  verifyToken,
  isConsumer,
  validateRequest({ body: verifyOrderPaymentBodySchema }),
  verifyPayment
);
router.get("/consumer", verifyToken, isConsumer, getConsumerOrders);
router.put(
  "/:id/cancel",
  verifyToken,
  isConsumer,
  sensitiveRateLimiter,
  validateRequest({ body: cancelReasonBodySchema }),
  cancelOrder
);

// --- 2. Farmer Routes ---
router.get("/farmer", verifyToken, isFarmer, getFarmerOrders);
router.post(
  "/:id/cancel-by-farmer",
  verifyToken,
  isFarmer,
  sensitiveRateLimiter,
  validateRequest({ body: cancelReasonBodySchema }),
  cancelOrderByFarmer
);
router.post(
  "/:id/confirm-cod-payment",
  verifyToken,
  isFarmer,
  (req, res, next) => {
    if (req.user?.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin cannot confirm COD payments"
      });
    }
    next();
  },
  confirmCODPayment
);

// --- 3. Shared Routes ---
router.get("/:id", verifyToken, getOrder);
router.put("/:id", verifyToken, validateRequest({ body: updateOrderStatusBodySchema }), updateOrderStatus);
router.get("/:id/invoice", verifyToken, downloadInvoice);
router.get("/:id/receipt", verifyToken, downloadReceipt);

// --- 4. Admin Routes ---
router.get("/", verifyToken, isAdmin, getAllOrders);

export default router;
