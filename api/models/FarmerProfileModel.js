import mongoose from "mongoose";

const FarmerProfileSchema = new mongoose.Schema(
  {
    // User reference jo farmer profile ko owner se connect karta hai
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Form field: FARM NAME
    farmerName: {
      type: String,
      required: [true, "Please add a farmer name"],
      trim: true,
    },
    // Form field: LOCATION (e.g., Khor, Pune)
    location: {
      type: String,
      required: [true, "Please add farm location"],
      trim: true,
    },
    // Latitude coordinate of farm location
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    // Longitude coordinate of farm location
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    // Full address from map selection
    locationAddress: {
      type: String,
      default: "",
    },
    // Form field: TOTAL AREA (e.g., 10 acres)
    totalArea: {
      type: String,
      required: [true, "Please add total area details"],
    },
    // Form field: AREA UNDER CULTIVATION
    cultivationArea: {
      type: String,
      required: [true, "Please add cultivation area details"],
    },
    // Form field: AGRICULTURE METHOD
    agricultureMethod: {
      type: String,
      required: [true, "Please select an agriculture method"],
      enum: ["Organic", "Traditional", "Modern", ""], // Optional: Ensure it matches select options
    },
    // Form field: FARMER INFORMATION / BIO
    description: {
      type: String,
      required: [true, "Please add farmer information or bio"],
    },
    
    // --- Additional Fields (Future Use ke liye) ---
    farmImages: [String],
    farmingPractices: [String],
    establishedYear: {
      type: Number,
    },
    socialMedia: {
      facebook: String,
      instagram: String,
      twitter: String,
    },
    businessHours: {
      monday: { open: String, close: String },
      tuesday: { open: String, close: String },
      wednesday: { open: String, close: String },
      thursday: { open: String, close: String },
      friday: { open: String, close: String },
      saturday: { open: String, close: String },
      sunday: { open: String, close: String },
    },
    acceptsPickup: {
      type: Boolean,
      default: false,
    },
    acceptsDelivery: {
      type: Boolean,
      default: false,
    },
    deliveryRadius: {
      type: Number,
      default: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // createdAt aur updatedAt automatic manage honge
  }
);

const FarmerProfile = mongoose.model("FarmerProfile", FarmerProfileSchema);
export default FarmerProfile;