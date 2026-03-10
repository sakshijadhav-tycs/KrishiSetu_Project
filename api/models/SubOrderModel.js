import mongoose from "mongoose";

const SubOrderSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainOrder",
      required: true,
      index: true,
    },
    mainOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainOrder",
      index: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    productSubtotal: {
      type: Number,
      min: 0,
      default: 0,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    payoutAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    gstShare: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deliveryShare: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    payoutStatus: {
      type: String,
      enum: ["Pending", "Eligible", "Transferred", "OnHold"],
      default: "Pending",
      index: true,
    },
    payoutDate: {
      type: Date,
      default: null,
    },
    fulfillmentStatus: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Processing",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Returned",
      ],
      default: "Pending",
      index: true,
    },
    orderStatus: {
      type: String,
      trim: true,
      default: "Pending",
      index: true,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    returnWindowEndsAt: {
      type: Date,
      default: null,
    },
    autoSettleAt: {
      type: Date,
      default: null,
    },
    settlementTrigger: {
      type: String,
      enum: ["auto", "manual", ""],
      default: "",
    },
    settlementStatus: {
      type: String,
      enum: ["Pending", "InReview", "Settled", "OnHold"],
      default: "Pending",
      index: true,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: "",
    },
    returnRequest: {
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "None"],
        default: "None",
      },
      reason: {
        type: String,
        trim: true,
        default: "",
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      reviewedBy: {
        type: String,
        enum: ["Farmer", "Admin", ""],
        default: "",
      },
      reviewedAt: {
        type: Date,
        default: null,
      },
    },
  },
  { timestamps: true }
);

SubOrderSchema.pre("validate", function syncCompatFields(next) {
  if (!this.mainOrderId && this.orderId) this.mainOrderId = this.orderId;
  if (!this.orderId && this.mainOrderId) this.orderId = this.mainOrderId;
  if ((!this.productSubtotal || this.productSubtotal === 0) && Number(this.subtotal) > 0) {
    this.productSubtotal = this.subtotal;
  }
  if (!this.orderStatus && this.fulfillmentStatus) this.orderStatus = this.fulfillmentStatus;
  if (!this.fulfillmentStatus && this.orderStatus) this.fulfillmentStatus = this.orderStatus;
  if (this.payoutStatus === "Transferred") this.settlementStatus = "Settled";
  if (this.payoutStatus === "OnHold") this.settlementStatus = "OnHold";
  next();
});

SubOrderSchema.index({ farmerId: 1, payoutStatus: 1, createdAt: -1 });
SubOrderSchema.index({ payoutStatus: 1, autoSettleAt: 1, fulfillmentStatus: 1 });
SubOrderSchema.index({ payoutStatus: 1, returnWindowEndsAt: 1, fulfillmentStatus: 1 });
SubOrderSchema.index({ orderId: 1, payoutStatus: 1 });

const SubOrder =
  mongoose.models.SubOrder || mongoose.model("SubOrder", SubOrderSchema);

export default SubOrder;
