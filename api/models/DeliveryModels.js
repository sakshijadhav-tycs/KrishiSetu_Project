import mongoose from "mongoose";

/**
 * Delivery Agent Schema
 * Represents a delivery agent who can be assigned orders
 */
const DeliveryAgentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please provide agent name"],
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    phone: {
      type: String,
      required: [true, "Please provide phone number"],
    },
    // Vehicle information
    vehicleType: {
      type: String,
      enum: ["bicycle", "two-wheeler", "car", "van", "truck"],
      required: true,
    },
    vehicleNumber: {
      type: String,
      trim: true,
    },
    // Service area
    serviceArea: {
      coordinates: {
        lat: Number,
        lng: Number,
      },
      radius: {
        type: Number,
        default: 10, // km
      },
      city: String,
      state: String,
    },
    // Badge and verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: Date,
    verificationDocument: String, // URL to verification doc
    // Rating and performance
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    completedDeliveries: {
      type: Number,
      default: 0,
    },
    failedDeliveries: {
      type: Number,
      default: 0,
    },
    // Status
    status: {
      type: String,
      enum: ["active", "inactive", "on-leave", "suspended"],
      default: "active",
    },
    // Current location (for real-time tracking)
    currentLocation: {
      coordinates: {
        lat: Number,
        lng: Number,
      },
      updatedAt: Date,
    },
    // Assigned orders count
    activeDeliveries: {
      type: Number,
      default: 0,
    },
    maxDeliveries: {
      type: Number,
      default: 10, // Max orders per day
    },
    // Earnings
    totalEarnings: {
      type: Number,
      default: 0,
    },
    bankDetails: {
      accountHolder: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for location-based queries
DeliveryAgentSchema.index({ "serviceArea.coordinates": "2dsphere" });
DeliveryAgentSchema.index({ status: 1, isVerified: 1 });

/**
 * Delivery Tracking Schema
 * Tracks delivery progress and location updates
 */
const DeliveryTrackingSchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DeliveryAgent",
    },
    // Delivery details
    estimatedDeliveryTime: {
      type: Date,
    },
    actualDeliveryTime: {
      type: Date,
    },
    // Status tracking
    status: {
      type: String,
      enum: [
        "pending",
        "assigned",
        "picked_up",
        "in_transit",
        "reached_destination",
        "delivered",
        "failed",
        "cancelled",
      ],
      default: "pending",
    },
    // Location updates (GPS trail)
    locationHistory: [
      {
        coordinates: {
          lat: Number,
          lng: Number,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        address: String,
        status: String,
      },
    ],
    // Current location
    currentLocation: {
      coordinates: {
        lat: Number,
        lng: Number,
      },
      address: String,
      updatedAt: {
        type: Date,
        default: Date.now,
      },
    },
    // Delivery address
    deliveryAddress: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      coordinates: {
        lat: Number,
        lng: Number,
      },
    },
    // Proof of delivery
    proofOfDelivery: {
      signature: String, // Base64 or URL
      photo: String, // Photo of delivery
      recipientName: String,
      recipientPhone: String,
      deliveryNotes: String,
    },
    // Performance metrics
    delayReason: String,
    distance: {
      type: Number, // in km
    },
    duration: {
      type: Number, // in minutes
    },
    // Customer interactions
    attemptCount: {
      type: Number,
      default: 0,
    },
    failureReason: String,
    customerFeedback: {
      rating: {
        type: Number,
        min: 1,
        max: 5,
      },
      comment: String,
    },
    // OTP verification for delivery
    otpCode: String,
    otpVerified: {
      type: Boolean,
      default: false,
    },
    otpVerificationTime: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for fast querying
DeliveryTrackingSchema.index({ order: 1 });
DeliveryTrackingSchema.index({ agent: 1, status: 1 });
DeliveryTrackingSchema.index({ status: 1, createdAt: -1 });
DeliveryTrackingSchema.index({ "currentLocation.coordinates": "2dsphere" });

const DeliveryAgent =
  mongoose.models.DeliveryAgent ||
  mongoose.model("DeliveryAgent", DeliveryAgentSchema);

const DeliveryTracking =
  mongoose.models.DeliveryTracking ||
  mongoose.model("DeliveryTracking", DeliveryTrackingSchema);

export { DeliveryAgent, DeliveryTracking };
