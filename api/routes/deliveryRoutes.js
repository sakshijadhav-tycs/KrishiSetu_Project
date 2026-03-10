/**
 * Delivery Routes
 * Handle delivery tracking, agent assignment, and GPS updates
 */

import express from "express";
import { verifyToken, isAdmin } from "../utils/authMiddleware.js";
import {
  createDeliveryTracking,
  assignDeliveryAgent,
  updateDeliveryLocation,
  completeDelivery,
  failDelivery,
  getDeliveryTracking,
  getNearbyAgents,
  getAgentDetails,
} from "../controllers/deliveryController.js";

const router = express.Router();

/**
 * Create delivery tracking
 * @route POST /api/delivery/create
 * @access Private
 */
router.post("/create", verifyToken, createDeliveryTracking);

/**
 * Assign delivery agent
 * @route PUT /api/delivery/:trackingId/assign
 * @access Private (Admin)
 */
router.put("/:trackingId/assign", verifyToken, isAdmin, assignDeliveryAgent);

/**
 * Update delivery location (GPS tracking)
 * @route PUT /api/delivery/:trackingId/location
 * @access Private (Agent)
 */
router.put("/:trackingId/location", verifyToken, updateDeliveryLocation);

/**
 * Complete delivery
 * @route PUT /api/delivery/:trackingId/complete
 * @access Private (Agent)
 */
router.put("/:trackingId/complete", verifyToken, completeDelivery);

/**
 * Mark delivery as failed
 * @route PUT /api/delivery/:trackingId/failed
 * @access Private (Agent)
 */
router.put("/:trackingId/failed", verifyToken, failDelivery);

/**
 * Get delivery tracking details
 * @route GET /api/delivery/:trackingId
 * @access Private
 */
router.get("/:trackingId", verifyToken, getDeliveryTracking);

/**
 * Get nearby agents
 * @route GET /api/delivery/agents/nearby
 * @access Private (Admin)
 */
router.get("/agents/nearby", verifyToken, isAdmin, getNearbyAgents);

/**
 * Get agent details
 * @route GET /api/delivery/agents/:agentId
 * @access Public
 */
router.get("/agents/:agentId", getAgentDetails);

export default router;
