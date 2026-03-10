import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide a notification title"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Please provide a notification message"],
      trim: true,
    },

    // New role targeting field
    targetRole: {
      type: String,
      enum: ["all", "farmer", "customer"],
      default: "all",
      index: true,
    },
    startDateTime: {
      type: Date,
      default: Date.now,
      index: true,
    },
    endDateTime: {
      type: Date,
      default: null,
      index: true,
    },
    isPermanent: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Legacy compatibility fields
    target: {
      type: String,
      enum: ["all", "farmers", "customers", "custom"],
      default: "all",
    },
    recipients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isBroadcast: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

NotificationSchema.pre("validate", function (next) {
  // Sync legacy -> new target role
  if (!this.targetRole && this.target) {
    if (this.target === "farmers") this.targetRole = "farmer";
    else if (this.target === "customers") this.targetRole = "customer";
    else this.targetRole = "all";
  }

  // Sync new -> legacy target
  if (!this.target) {
    if (this.targetRole === "farmer") this.target = "farmers";
    else if (this.targetRole === "customer") this.target = "customers";
    else this.target = "all";
  }

  if (!this.createdBy && this.sentBy) this.createdBy = this.sentBy;
  if (!this.sentBy && this.createdBy) this.sentBy = this.createdBy;
  if (!this.startDateTime) this.startDateTime = new Date();

  // Validate end time rules
  if (this.isPermanent) {
    this.endDateTime = null;
  } else if (!this.endDateTime) {
    return next(new Error("endDateTime is required for non-permanent notification"));
  }

  if (this.endDateTime && this.startDateTime && this.endDateTime <= this.startDateTime) {
    return next(new Error("endDateTime must be greater than startDateTime"));
  }

  next();
});

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", NotificationSchema);

export default Notification;
