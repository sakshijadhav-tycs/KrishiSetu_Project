import mongoose from "mongoose";

const SettlementJobRunSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      index: true,
    },
    source: {
      type: String,
      trim: true,
      default: "",
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["running", "success", "failed", "skipped_locked"],
      default: "running",
      index: true,
    },
    scanned: {
      type: Number,
      default: 0,
      min: 0,
    },
    promoted: {
      type: Number,
      default: 0,
      min: 0,
    },
    transferred: {
      type: Number,
      default: 0,
      min: 0,
    },
    skipped: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdueEligibleCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    overdueEligibleAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    skippedReasons: {
      type: Map,
      of: Number,
      default: {},
    },
    durationMs: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      trim: true,
      default: "",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

SettlementJobRunSchema.index({ jobName: 1, startedAt: -1 });

const SettlementJobRun =
  mongoose.models.SettlementJobRun ||
  mongoose.model("SettlementJobRun", SettlementJobRunSchema);

export default SettlementJobRun;
