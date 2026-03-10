import mongoose from "mongoose";

const MainOrderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    gstAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    deliveryCharge: {
      type: Number,
      required: true,
      min: 0,
    },
    platformCommissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ["razorpay", "cod", "cash", "bank_transfer", "other", "unknown"],
      default: "razorpay",
      index: true,
    },
    orderType: {
      type: String,
      enum: ["split", "single", "subscription"],
      default: "split",
      index: true,
    },
    purchaseMode: {
      type: String,
      enum: ["OneTime", "Subscription"],
      default: "OneTime",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    orderStatus: {
      type: String,
      enum: [
        "created",
        "pending",
        "partially_confirmed",
        "confirmed",
        "processing",
        "partially_delivered",
        "delivered",
        "cancelled",
        "disputed",
      ],
      default: "created",
      index: true,
    },
    status: {
      type: String,
      default: "created",
      index: true,
    },
    razorpayOrderId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpayPaymentId: {
      type: String,
      index: true,
      sparse: true,
    },
    razorpaySignature: {
      type: String,
    },
    commissionPercentApplied: {
      type: Number,
      required: true,
      min: 0,
    },
    gstPercentApplied: {
      type: Number,
      required: true,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceUrl: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceGeneratedAt: {
      type: Date,
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: "",
    },
    receiptLocalPath: {
      type: String,
      trim: true,
      default: "",
    },
    receiptGenerated: {
      type: Boolean,
      default: false,
    },
    receiptGeneratedAt: {
      type: Date,
    },
    expectedDeliveryDate: {
      type: Date,
      default: null,
    },
    trackingId: {
      type: String,
      trim: true,
      default: "",
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
      default: null,
      index: true,
    },
    subscriptionIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription",
      },
    ],
  },
  { timestamps: true }
);

MainOrderSchema.pre("validate", function syncStatus(next) {
  if (!this.status && this.orderStatus) this.status = this.orderStatus;
  if (!this.orderStatus && this.status) this.orderStatus = this.status;
  next();
});

MainOrderSchema.index({
  orderStatus: 1,
  paymentStatus: 1,
  createdAt: -1,
});
MainOrderSchema.index({ customerId: 1, createdAt: -1 });
MainOrderSchema.index({ purchaseMode: 1, createdAt: -1 });

const MainOrder =
  mongoose.models.MainOrder || mongoose.model("MainOrder", MainOrderSchema);

export default MainOrder;
