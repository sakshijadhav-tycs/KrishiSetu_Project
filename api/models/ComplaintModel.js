import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
  {
    complaintId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userRole: {
      type: String,
      enum: ["Customer", "Farmer"],
      required: true,
    },
    complaintType: {
      type: String,
      enum: [
        "Order Issue",
        "Payment Issue",
        "Product Quality Issue",
        "Account Issue",
        "Other",
      ],
      required: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    description: {
      type: String,
      required: [true, "Please provide complaint details"],
      trim: true,
    },
    imageUrl: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["Pending", "In Review", "Resolved", "Rejected"],
      default: "Pending",
    },
    adminNote: {
      type: String,
      default: "",
      trim: true,
    },

    // Legacy compatibility fields used by older UI/data
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    againstUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    type: {
      type: String,
      default: "other",
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    adminNotes: {
      type: String,
      default: "",
      trim: true,
    },
    attachments: [String],
  },
  {
    timestamps: true,
  }
);

ComplaintSchema.pre("validate", function (next) {
  if (!this.createdBy) this.createdBy = this.userId;
  if (!this.order && this.orderId) this.order = this.orderId;
  if (!this.orderId && this.order) this.orderId = this.order;

  if (!this.title) {
    this.title = this.complaintType || "Complaint";
  }

  if (this.adminNote && !this.adminNotes) {
    this.adminNotes = this.adminNote;
  }
  if (this.adminNotes && !this.adminNote) {
    this.adminNote = this.adminNotes;
  }
  next();
});

const Complaint =
  mongoose.models.Complaint || mongoose.model("Complaint", ComplaintSchema);

export default Complaint;
