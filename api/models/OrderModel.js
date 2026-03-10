import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  // ✅ ADDED: Har product ke saath uska farmer store hoga
  farmer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, "Quantity cannot be less than 1"],
  },
  price: {
    type: Number,
    required: true, 
  },
  image: {
    type: String, // Backup for image URL
  }
});

const OrderSchema = new mongoose.Schema(
  {
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // ⚠️ NOTE: Maine yahan se global 'farmer' field hata di hai kyunki 
    // ab farmers 'items' array ke andar har product ke saath honge.
    items: [OrderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      default: 0.0,
    },
    orderType: {
      type: String,
      enum: ["pickup", "delivery"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "accepted",
        "processing",
        "shipped",
        "out_for_delivery",
        "delivered",
        "completed",
        "rejected",
        "cancelled",
        "CANCELLED_BY_FARMER",
      ],
      default: "pending",
    },
    cancelledBy: {
      type: String,
      enum: ["CONSUMER", "FARMER", "ADMIN", "SYSTEM", null],
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
    cancellationLogs: [
      {
        cancelledBy: {
          type: String,
          enum: ["CONSUMER", "FARMER", "ADMIN", "SYSTEM"],
          required: true,
        },
        reason: {
          type: String,
          trim: true,
          default: "",
        },
        statusBefore: {
          type: String,
          trim: true,
          default: "",
        },
        statusAfter: {
          type: String,
          trim: true,
          default: "",
        },
        cancelledAt: {
          type: Date,
          default: Date.now,
        },
        cancelledByUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
      },
    ],
    pickupDetails: {
      date: Date,
      time: String,
      location: String,
    },
    deliveryDetails: {
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
      },
      date: Date,
      time: String,
    },
    trackingId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod", "cash", "bank_transfer", "other"],
      default: "cod",
      // Standardized: "razorpay" for online, "cod" for cash on delivery
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "unpaid"],
      default: "pending",
    },
    // Settlement/accounting alignment fields (optional, non-breaking)
    commissionPercentApplied: {
      type: Number,
    },
    commissionAmount: {
      type: Number,
    },
    platformFee: {
      type: Number,
    },
    farmerEarning: {
      type: Number,
    },
    payoutAmount: {
      type: Number,
    },
    payoutStatus: {
      type: String,
    },
    settlementStatus: {
      type: String,
    },
    autoSettleAt: {
      type: Date,
    },
    payoutAttemptedAt: {
      type: Date,
    },
    providerPayoutId: {
      type: String,
      default: "",
    },
    payoutError: {
      type: String,
      default: "",
    },
    refund: {
      status: {
        type: String,
        enum: ["none", "initiated", "processed", "failed", "not_required"],
        default: "none",
      },
      amount: {
        type: Number,
        default: 0,
      },
      razorpayRefundId: {
        type: String,
        default: "",
      },
      refundedAt: {
        type: Date,
        default: null,
      },
      failureReason: {
        type: String,
        trim: true,
        default: "",
      },
    },
    razorpay_order_id: {
      type: String,
      // Required canonical storage field for Razorpay order ID
    },
    razorpay_payment_id: {
      type: String,
      // Required canonical storage field for Razorpay payment ID
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    razorpay_signature: {
      type: String,
      // Stores Razorpay signature for audit trail and verification
    },
    // --- INVOICE & RECEIPT FIELDS ---
    invoiceUrl: {
      type: String,
      // Path to generated invoice PDF (for COD orders)
    },
    receiptUrl: {
      type: String,
      // Path to generated receipt PDF (for paid orders)
    },
    receiptLocalPath: {
      type: String,
      default: "",
      // Local fallback path retained for attachments/downloads
    },
    receiptGenerated: {
      type: Boolean,
      default: false,
      // Flag to prevent duplicate receipt generation
    },
    invoiceGeneratedAt: {
      type: Date,
      // Timestamp when invoice was generated
    },
    receiptGeneratedAt: {
      type: Date,
      // Timestamp when receipt was generated
    },
    // --- PAYMENT TIMEOUT & WEBHOOK FIELDS ---
    paymentExpiresAt: {
      type: Date,
      // Payment expires after 30 minutes if not confirmed
      default: () => new Date(Date.now() + 30 * 60 * 1000),
    },
    webhookReceivedAt: {
      type: Date,
      // Tracks when webhook confirmation was received
    },
    // Stock reservation status - for inventory management
    stockReservationStatus: {
      type: String,
      enum: ["pending", "reserved", "confirmed", "released"],
      default: "pending",
    },
    isSubscriptionOrder: {
      type: Boolean,
      default: false,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },
    subscriptionCycleLabel: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// ✅ Index for payment timeout handling - find expired unpaid orders
OrderSchema.index({ 
  paymentStatus: 1, 
  paymentExpiresAt: 1 
});

// ✅ Index for webhook idempotency - find orders by razorpay payment ID
OrderSchema.index({ 
  razorpayPaymentId: 1 
}, { sparse: true });

OrderSchema.index({
  razorpay_payment_id: 1
}, { sparse: true });

// ✅ Index for consumer order history queries
OrderSchema.index({ 
  consumer: 1, 
  createdAt: -1 
});

// ✅ Index for farmer order queries (multi-farmer support)
OrderSchema.index({ 
  "items.farmer": 1, 
  createdAt: -1 
});

// ✅ Index for admin order filtering by status
OrderSchema.index({ 
  status: 1, 
  createdAt: -1 
});

OrderSchema.index({
  "items.product": 1,
  status: 1,
  createdAt: -1,
});

OrderSchema.index({
  payoutStatus: 1,
  autoSettleAt: 1,
  status: 1,
});

OrderSchema.index({
  razorpay_order_id: 1,
}, { sparse: true });

const Order = mongoose.models.Order || mongoose.model("Order", OrderSchema);

export default Order;
