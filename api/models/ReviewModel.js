// models/ReviewModel.js
import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    customerName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true },
    // Allows admin to hide inappropriate reviews from public views
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

ReviewSchema.index({ farmerId: 1, customerId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
