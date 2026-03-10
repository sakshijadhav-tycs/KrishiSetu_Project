import mongoose from "mongoose";

/**
 * Stock Reservation Schema
 * Tracks reserved stock when order is initiated but not paid yet
 */
const StockReservationSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reservedQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    // Reservation expires if payment not completed within timeout
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      index: true,
    },
    status: {
      type: String,
      enum: ["reserved", "confirmed", "released", "expired"],
      default: "reserved",
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Index for finding active reservations
StockReservationSchema.index({ product: 1, status: 1 });
StockReservationSchema.index({ order: 1, status: 1 });

// Auto-delete expired reservations after 24 hours
StockReservationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });

const StockReservation =
  mongoose.models.StockReservation ||
  mongoose.model("StockReservation", StockReservationSchema);

export default StockReservation;
