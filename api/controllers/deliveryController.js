/**
 * Delivery Controller
 * Handles delivery tracking, agent assignment, and real-time GPS updates
 */

import {
  DeliveryAgent,
  DeliveryTracking,
} from "../models/DeliveryModels.js";
import Order from "../models/OrderModel.js";
import { sendToUser } from "../utils/socketHandler.js";

/**
 * Create delivery tracking record
 * Called when order is confirmed and ready for delivery
 * @route POST /api/delivery/create
 * @access Private
 */
export const createDeliveryTracking = async (req, res) => {
  try {
    const { orderId, estimatedDeliveryTime } = req.body;

    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Extract delivery address from order
    const deliveryAddress = order.deliveryDetails?.address;
    if (!deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: "Delivery address not found in order",
      });
    }

    // Create delivery tracking record
    const deliveryTracking = await DeliveryTracking.create({
      order: orderId,
      status: "pending",
      estimatedDeliveryTime:
        estimatedDeliveryTime || new Date(Date.now() + 24 * 60 * 60 * 1000),
      deliveryAddress: {
        street: deliveryAddress.street,
        city: deliveryAddress.city,
        state: deliveryAddress.state,
        zipCode: deliveryAddress.zipCode,
      },
      attemptCount: 0,
    });

    // Update order status to indicate delivery has been initiated
    order.status = "pending_delivery";
    await order.save();

    res.status(201).json({
      success: true,
      message: "Delivery tracking created",
      data: deliveryTracking,
    });
  } catch (error) {
    console.error("Create delivery tracking error:", error);
    res.status(500).json({
      success: false,
      message: "Error creating delivery tracking",
      error: error.message,
    });
  }
};

/**
 * Assign delivery agent to order
 * @route PUT /api/delivery/:trackingId/assign
 * @access Private (Admin)
 */
export const assignDeliveryAgent = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { agentId } = req.body;

    // Check if agent exists
    const agent = await DeliveryAgent.findById(agentId);
    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Delivery agent not found",
      });
    }

    // Check if agent is active and verified
    if (!agent.isVerified || agent.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Agent not available for delivery",
      });
    }

    // Check agent's workload
    if (agent.activeDeliveries >= agent.maxDeliveries) {
      return res.status(400).json({
        success: false,
        message: "Agent has reached maximum delivery capacity",
      });
    }

    // Update delivery tracking
    const delivery = await DeliveryTracking.findByIdAndUpdate(
      trackingId,
      {
        agent: agentId,
        status: "assigned",
      },
      { new: true }
    );

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery tracking not found",
      });
    }

    // Update agent's active deliveries
    agent.activeDeliveries += 1;
    await agent.save();

    res.status(200).json({
      success: true,
      message: "Agent assigned successfully",
      data: delivery,
    });
  } catch (error) {
    console.error("Assign agent error:", error);
    res.status(500).json({
      success: false,
      message: "Error assigning agent",
      error: error.message,
    });
  }
};

/**
 * Update delivery location (GPS tracking)
 * Real-time location update from delivery agent
 * @route PUT /api/delivery/:trackingId/location
 * @access Private (Agent)
 */
export const updateDeliveryLocation = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { lat, lng, address, status } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const delivery = await DeliveryTracking.findById(trackingId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery tracking not found",
      });
    }

    // Add to location history
    delivery.locationHistory.push({
      coordinates: { lat, lng },
      timestamp: new Date(),
      address: address || "Location updated",
      status: status || delivery.status,
    });

    // Update current location
    delivery.currentLocation = {
      coordinates: { lat, lng },
      address: address || "In transit",
      updatedAt: new Date(),
    };

    // Update status if provided
    if (status && ["picked_up", "in_transit", "reached_destination"].includes(status)) {
      delivery.status = status;
    }

    await delivery.save();

    // Emit real-time location update to customer
    const order = await Order.findById(delivery.order);
    if (order) {
      // sendToUser(socketIO, order.consumer, "delivery:location-updated", {
      //   trackingId,
      //   coordinates: { lat, lng },
      //   status: delivery.status,
      //   estimatedTime: delivery.estimatedDeliveryTime,
      // });
    }

    res.status(200).json({
      success: true,
      message: "Location updated",
      data: {
        trackingId,
        coordinates: { lat, lng },
        status: delivery.status,
      },
    });
  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating location",
      error: error.message,
    });
  }
};

/**
 * Mark delivery as completed
 * Submit proof of delivery (signature, photo, notes)
 * @route PUT /api/delivery/:trackingId/complete
 * @access Private (Agent)
 */
export const completeDelivery = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const {
      recipientName,
      recipientPhone,
      signature,
      photo,
      deliveryNotes,
      otpCode,
    } = req.body;

    const delivery = await DeliveryTracking.findById(trackingId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery tracking not found",
      });
    }

    // Update delivery with proof
    delivery.status = "delivered";
    delivery.actualDeliveryTime = new Date();
    delivery.proofOfDelivery = {
      recipientName,
      recipientPhone,
      signature, // Base64 or URL
      photo, // Photo URL
      deliveryNotes,
    };

    if (otpCode) {
      delivery.otpVerified = true;
      delivery.otpVerificationTime = new Date();
    }

    await delivery.save();

    // Update order status
    const order = await Order.findByIdAndUpdate(
      delivery.order,
      { status: "completed" },
      { new: true }
    );

    // Update agent stats
    const agent = await DeliveryAgent.findById(delivery.agent);
    if (agent) {
      agent.totalDeliveries += 1;
      agent.completedDeliveries += 1;
      agent.activeDeliveries = Math.max(0, agent.activeDeliveries - 1);
      await agent.save();
    }

    res.status(200).json({
      success: true,
      message: "Delivery completed successfully",
      data: delivery,
    });
  } catch (error) {
    console.error("Complete delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Error completing delivery",
      error: error.message,
    });
  }
};

/**
 * Delivery failed - mark and add failure reason
 * @route PUT /api/delivery/:trackingId/failed
 * @access Private (Agent)
 */
export const failDelivery = async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { failureReason, attemptCount } = req.body;

    const delivery = await DeliveryTracking.findById(trackingId);
    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery tracking not found",
      });
    }

    delivery.status = "failed";
    delivery.failureReason = failureReason || "Customer not available";
    delivery.attemptCount = attemptCount || delivery.attemptCount + 1;

    await delivery.save();

    // Update agent stats
    const agent = await DeliveryAgent.findById(delivery.agent);
    if (agent) {
      agent.failedDeliveries += 1;
      agent.activeDeliveries = Math.max(0, agent.activeDeliveries - 1);
      await agent.save();
    }

    res.status(200).json({
      success: true,
      message: "Delivery marked as failed",
      data: delivery,
    });
  } catch (error) {
    console.error("Fail delivery error:", error);
    res.status(500).json({
      success: false,
      message: "Error marking delivery as failed",
      error: error.message,
    });
  }
};

/**
 * Get delivery tracking details
 * @route GET /api/delivery/:trackingId
 * @access Private
 */
export const getDeliveryTracking = async (req, res) => {
  try {
    const { trackingId } = req.params;

    const delivery = await DeliveryTracking.findById(trackingId)
      .populate("order", "totalAmount status")
      .populate("agent", "name phone vehicleNumber rating");

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: "Delivery tracking not found",
      });
    }

    res.status(200).json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    console.error("Get delivery tracking error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching delivery tracking",
      error: error.message,
    });
  }
};

/**
 * Get delivery agents near location
 * Find available agents for assignment
 * @route GET /api/delivery/agents/nearby
 * @access Private (Admin)
 */
export const getNearbyAgents = async (req, res) => {
  try {
    const { lat, lng, maxDistance = 50 } = req.query; // maxDistance in km

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required",
      });
    }

    const agents = await DeliveryAgent.find({
      isVerified: true,
      status: "active",
      $expr: {
        $lt: ["$activeDeliveries", "$maxDeliveries"],
      },
      // Simple distance check (can use geospatial if indexed)
      "serviceArea.coordinates": {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: maxDistance * 1000, // convert km to meters
        },
      },
    }).select("name phone rating activeDeliveries totalDeliveries vehicleType");

    res.status(200).json({
      success: true,
      count: agents.length,
      data: agents,
    });
  } catch (error) {
    console.error("Get nearby agents error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching nearby agents",
      error: error.message,
    });
  }
};

/**
 * Get agent details and performance
 * @route GET /api/delivery/agents/:agentId
 * @access Public
 */
export const getAgentDetails = async (req, res) => {
  try {
    const { agentId } = req.params;

    const agent = await DeliveryAgent.findById(agentId).select(
      "-bankDetails"
    );

    if (!agent) {
      return res.status(404).json({
        success: false,
        message: "Agent not found",
      });
    }

    // Calculate performance metrics
    const successRate =
      agent.totalDeliveries > 0
        ? Math.round((agent.completedDeliveries / agent.totalDeliveries) * 100)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        ...agent.toObject(),
        performanceMetrics: {
          successRate,
          totalDeliveries: agent.totalDeliveries,
          completedDeliveries: agent.completedDeliveries,
          failedDeliveries: agent.failedDeliveries,
          rating: agent.rating,
          activeDeliveries: agent.activeDeliveries,
        },
      },
    });
  } catch (error) {
    console.error("Get agent details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching agent details",
      error: error.message,
    });
  }
};
