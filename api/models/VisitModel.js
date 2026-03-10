import mongoose from "mongoose";

const VisitSchema = new mongoose.Schema(
  {
    visitId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedDate: {
      type: Date,
      required: [true, "Please select a visit date"],
    },
    proposedDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected", "Cancelled"],
      default: "Pending",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },

    // Legacy compatibility fields
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    date: {
      type: Date,
    },
    slot: {
      type: String,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      latitude: Number,
      longitude: Number,
    },
  },
  {
    timestamps: true,
  }
);

VisitSchema.pre("validate", function (next) {
  if (!this.customer && this.customerId) this.customer = this.customerId;
  if (!this.farmer && this.farmerId) this.farmer = this.farmerId;
  if (!this.customerId && this.customer) this.customerId = this.customer;
  if (!this.farmerId && this.farmer) this.farmerId = this.farmer;

  if (!this.requestedDate && this.date) this.requestedDate = this.date;
  if (!this.date && this.requestedDate) this.date = this.requestedDate;

  if (!this.message && this.notes) this.message = this.notes;
  if (!this.notes && this.message) this.notes = this.message;
  next();
});

const Visit = mongoose.models.Visit || mongoose.model("Visit", VisitSchema);
export default Visit;
