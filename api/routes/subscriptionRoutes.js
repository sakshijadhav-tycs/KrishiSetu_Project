import express from "express";
import {
  createSubscription,
  getMySubscriptions,
  cancelSubscription,
  pauseSubscription,
  resumeSubscription,
  getUpcomingDeliveries,
} from "../controllers/subscriptionController.js";
import { verifyToken, isConsumer } from "../utils/authMiddleware.js";

const router = express.Router();

// Consumer creates a subscription manually (optional)
router.post("/", verifyToken, isConsumer, createSubscription);

// List own active subscriptions
router.get("/me", verifyToken, isConsumer, getMySubscriptions);
router.get("/upcoming-deliveries", verifyToken, isConsumer, getUpcomingDeliveries);

// Cancel subscription
router.put("/:id/cancel", verifyToken, isConsumer, cancelSubscription);
router.put("/:id/pause", verifyToken, isConsumer, pauseSubscription);
router.put("/:id/resume", verifyToken, isConsumer, resumeSubscription);

export default router;

