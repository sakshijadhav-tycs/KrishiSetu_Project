import mongoose from "mongoose";

const DealSchema = new mongoose.Schema(
  {
    farmerId: {
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
    discountType: {
      type: String,
      enum: ["percentage", "fixedPrice"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
      index: true,
    },
    endDate: {
      type: Date,
      required: true,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    disabledBy: {
      type: String,
      enum: ["farmer", "admin", "system", ""],
      default: "",
    },
    disabledReason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

DealSchema.index({ productId: 1, isEnabled: 1, startDate: 1, endDate: 1 });

const Deal = mongoose.models.Deal || mongoose.model("Deal", DealSchema);

export default Deal;
