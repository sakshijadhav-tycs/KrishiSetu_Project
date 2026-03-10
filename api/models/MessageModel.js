import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: [true, "Message content is required"],
    },
    relatedOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// 🚨 'module.exports' ko hata kar 'export default' karein
const Message = mongoose.model("Message", MessageSchema);
export default Message;