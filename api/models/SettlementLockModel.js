import mongoose from "mongoose";

const SettlementLockSchema = new mongoose.Schema(
  {
    lockName: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    owner: {
      type: String,
      trim: true,
      default: "",
    },
    lockedUntil: {
      type: Date,
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const SettlementLock =
  mongoose.models.SettlementLock ||
  mongoose.model("SettlementLock", SettlementLockSchema);

export default SettlementLock;
