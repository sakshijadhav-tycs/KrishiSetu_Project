import mongoose from "mongoose";

const EmailLogSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, trim: true, index: true },
    subject: { type: String, required: true, trim: true },
    eventType: { type: String, trim: true, default: "generic", index: true },
    entityType: { type: String, trim: true, default: "" },
    entityId: { type: String, trim: true, default: "" },
    dedupeKey: { type: String, trim: true, default: "", index: true },
    status: {
      type: String,
      enum: ["queued", "sent", "failed"],
      default: "queued",
      index: true,
    },
    attempts: { type: Number, min: 0, default: 0 },
    lastError: { type: String, trim: true, default: "" },
    sentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EmailLogSchema.index(
  { dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: "string", $ne: "" } } }
);

const EmailLog = mongoose.models.EmailLog || mongoose.model("EmailLog", EmailLogSchema);

export default EmailLog;
