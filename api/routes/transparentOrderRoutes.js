import express from "express";
import {
  createCheckoutOrder,
  downloadMainOrderInvoice,
  getAdminReturnRequests,
  getAdminFinanceSummary,
  getFarmerSubOrderList,
  getMainOrderDetails,
  getMyMainOrders,
  reviewReturnRequest,
  setSubOrderDelivered,
  setSubOrderStatus,
  submitReturnRequest,
  transferSubOrderPayout,
  triggerSettlementSweep,
  verifyPaymentAndSplitOrder,
} from "../modules/transparentOrders/controllers/transparentOrderController.js";
import {
  isAdmin,
  isConsumer,
  isFarmer,
  verifyToken,
} from "../utils/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { paymentRateLimiter, sensitiveRateLimiter } from "../middleware/rateLimiter.js";
import {
  objectIdParamSchema,
  transparentCheckoutBodySchema,
  transparentStatusBodySchema,
  transparentVerifyBodySchema,
} from "../validators/transparentSchemas.js";

const router = express.Router();

router.use(verifyToken);

// Consumer flow
router.post(
  "/checkout/create-order",
  isConsumer,
  paymentRateLimiter,
  validateRequest({ body: transparentCheckoutBodySchema }),
  createCheckoutOrder
);
router.post(
  "/checkout/verify",
  isConsumer,
  paymentRateLimiter,
  validateRequest({ body: transparentVerifyBodySchema }),
  verifyPaymentAndSplitOrder
);
router.get("/my-orders", isConsumer, getMyMainOrders);
router.post("/:id/return-request", isConsumer, submitReturnRequest);

// Farmer transparency and settlement visibility
router.get("/farmer/sub-orders", isFarmer, getFarmerSubOrderList);
router.patch(
  "/farmer/sub-orders/:id/delivered",
  isFarmer,
  sensitiveRateLimiter,
  validateRequest({ params: objectIdParamSchema }),
  setSubOrderDelivered
);
router.patch(
  "/farmer/sub-orders/:id/status",
  isFarmer,
  sensitiveRateLimiter,
  validateRequest({ params: objectIdParamSchema, body: transparentStatusBodySchema }),
  setSubOrderStatus
);
router.patch(
  "/farmer/sub-orders/:id/return-request",
  isFarmer,
  sensitiveRateLimiter,
  validateRequest({ params: objectIdParamSchema }),
  reviewReturnRequest
);

// Admin non-middleman governance actions
router.get("/admin/summary", isAdmin, getAdminFinanceSummary);
router.get("/admin/return-requests", isAdmin, getAdminReturnRequests);
router.post("/admin/settlement/sweep", isAdmin, sensitiveRateLimiter, triggerSettlementSweep);
router.patch(
  "/admin/sub-orders/:id/transfer",
  isAdmin,
  sensitiveRateLimiter,
  validateRequest({ params: objectIdParamSchema }),
  transferSubOrderPayout
);
router.get("/:id/invoice", validateRequest({ params: objectIdParamSchema }), downloadMainOrderInvoice);
router.get("/:id", validateRequest({ params: objectIdParamSchema }), getMainOrderDetails);

export default router;
