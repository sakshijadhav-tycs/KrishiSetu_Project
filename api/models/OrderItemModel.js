import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MainOrder",
      required: true,
      index: true,
    },
    subOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubOrder",
      required: true,
      index: true,
    },
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

OrderItemSchema.index({ orderId: 1, productId: 1 });
OrderItemSchema.index({ farmerId: 1, createdAt: -1 });
OrderItemSchema.index({ productId: 1, createdAt: -1 });

const OrderItem =
  mongoose.models.OrderItem || mongoose.model("OrderItem", OrderItemSchema);

export default OrderItem;
