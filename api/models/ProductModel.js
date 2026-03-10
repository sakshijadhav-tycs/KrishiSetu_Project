import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: [true, "Please add a product name"],
      trim: true,
    },
    // Optional localized names/descriptions for multilingual support
    name_hi: {
      type: String,
      trim: true,
    },
    name_mr: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Please add a description"],
    },
    description_hi: {
      type: String,
      trim: true,
    },
    description_mr: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    price: {
      type: Number,
      required: [true, "Please add a price"],
    },
    unit: {
      type: String,
      required: [true, "Please add a unit (e.g., kg, gram, bunch)"],
    },
    quantityAvailable: {
      type: Number,
      required: [true, "Please add available quantity"],
    },
    // --- Naya field stock alert ke liye ---
    minStockLevel: {
      type: Number,
      default: 5, // Jab quantity 5 se kam hogi tab alert dikhega
    },
    images: [String],
    isOrganic: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    harvestDate: Date,
    availableUntil: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", ProductSchema);
export default Product;