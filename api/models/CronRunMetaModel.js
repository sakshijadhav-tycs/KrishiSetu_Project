import mongoose from "mongoose";

const CronRunMetaSchema = new mongoose.Schema(
  {
    jobName: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    source: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    status: {
      type: String,
      enum: ["success", "failed"],
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    finishedAt: {
      type: Date,
      required: true,
    },
    durationMs: {
      type: Number,
      required: true,
      min: 0,
    },
    failureReason: {
      type: String,
      default: "",
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { timestamps: true }
);

CronRunMetaSchema.index({ jobName: 1, startedAt: -1 });
CronRunMetaSchema.index({ status: 1, startedAt: -1 });

const CronRunMeta =
  mongoose.models.CronRunMeta || mongoose.model("CronRunMeta", CronRunMetaSchema);

export default CronRunMeta;
