import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema(
  {
    // Backward-compatible fields
    consumer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Restored normalized structure
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly", "monthly"],
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
    },
    nextDeliveryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "paused", "cancelled"],
      default: "active",
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    durationDays: {
      type: Number,
      min: 1,
      default: 30,
    },
    pauseReason: {
      type: String,
      trim: true,
      default: "",
    },
    lastOrderDate: {
      type: Date,
    },
    nextOrderDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

SubscriptionSchema.pre("validate", function mapLegacyFields(next) {
  if (!this.customerId && this.consumer) this.customerId = this.consumer;
  if (!this.productId && this.product) this.productId = this.product;
  if (!this.farmerId && this.farmer) this.farmerId = this.farmer;
  if (!this.consumer && this.customerId) this.consumer = this.customerId;
  if (!this.product && this.productId) this.product = this.productId;
  if (!this.farmer && this.farmerId) this.farmer = this.farmerId;
  if (!this.nextDeliveryDate && this.nextOrderDate) this.nextDeliveryDate = this.nextOrderDate;
  if (!this.nextOrderDate && this.nextDeliveryDate) this.nextOrderDate = this.nextDeliveryDate;
  if (!this.startDate) this.startDate = this.createdAt || new Date();
  if (!this.status) this.status = this.isActive ? "active" : "cancelled";
  if (this.status === "active") this.isActive = true;
  if (["paused", "cancelled"].includes(this.status)) this.isActive = false;
  if (this.status === "cancelled" && !this.cancelledAt) this.cancelledAt = new Date();
  next();
});

SubscriptionSchema.index({ status: 1, nextDeliveryDate: 1 });
SubscriptionSchema.index({ isActive: 1, nextDeliveryDate: 1 });
SubscriptionSchema.index({ customerId: 1, status: 1, createdAt: -1 });
SubscriptionSchema.index({ farmerId: 1, status: 1, nextDeliveryDate: 1 });

const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", SubscriptionSchema);

export default Subscription;

