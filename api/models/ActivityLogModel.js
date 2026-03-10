import mongoose from "mongoose";

const ActivityLogSchema = new mongoose.Schema(
  {
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ admin: 1, createdAt: -1 });
ActivityLogSchema.index({ resourceType: 1, resourceId: 1 });

const ActivityLog =
  mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", ActivityLogSchema);

export default ActivityLog;

