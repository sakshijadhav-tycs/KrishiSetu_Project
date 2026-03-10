import mongoose from "mongoose";

const CheckoutIntentSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cartSnapshot: {
      type: [
        {
          productId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            required: true,
          },
          farmerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
          },
          productName: { type: String, required: true },
          quantity: { type: Number, required: true, min: 1 },
          price: { type: Number, required: true, min: 0 },
          total: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },
    pricingSnapshot: {
      productSubtotal: { type: Number, required: true, min: 0 },
      gstAmount: { type: Number, required: true, min: 0 },
      deliveryCharge: { type: Number, required: true, min: 0 },
      commissionAmount: { type: Number, required: true, min: 0 },
      totalAmount: { type: Number, required: true, min: 0 },
      commissionPercent: { type: Number, required: true, min: 0 },
      gstPercent: { type: Number, required: true, min: 0 },
    },
    shippingAddress: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      zipCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },
    purchaseMode: {
      type: String,
      enum: ["OneTime", "Subscription"],
      default: "OneTime",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod", "cash"],
      default: "razorpay",
    },
    subscriptionConfig: {
      frequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
      },
      startDate: { type: Date },
      durationDays: { type: Number, min: 1, default: 30 },
    },
    subscriptionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription",
      },
    ],
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    status: {
      type: String,
      enum: ["created", "paid", "expired", "failed"],
      default: "created",
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    processedMainOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainOrder",
      default: null,
    },
  },
  { timestamps: true }
);

CheckoutIntentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const CheckoutIntent =
  mongoose.models.CheckoutIntent ||
  mongoose.model("CheckoutIntent", CheckoutIntentSchema);

export default CheckoutIntent;
