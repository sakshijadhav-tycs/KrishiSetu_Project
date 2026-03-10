import Message from "../models/MessageModel.js";
import User from "../models/UserModel.js";

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { receiver, content, relatedOrder } = req.body;

    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver,
      content,
      relatedOrder,
    });

    res.status(201).json({
      success: true,
      data: message,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get conversation between two users
// @route   GET /api/messages/:userId
// @access  Private
export const getConversation = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id },
        { senderId: req.user._id, receiverId: req.params.userId },
        { senderId: req.params.userId, receiverId: req.user._id },
        { customerId: req.user._id, farmerId: req.params.userId },
        { customerId: req.params.userId, farmerId: req.user._id },
      ],
    })
      .sort("createdAt")
      .populate("sender", "name role")
      .populate("receiver", "name role");

    res.json({
      success: true,
      count: messages.length,
      data: messages,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Get all conversations for a user
// @route   GET /api/messages
// @access  Private
export const getConversations = async (req, res) => {
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id },
        { senderId: req.user._id },
        { receiverId: req.user._id },
        { customerId: req.user._id },
        { farmerId: req.user._id },
      ],
    })
      .sort("-createdAt")
      .populate("sender", "name role")
      .populate("receiver", "name role");

    const conversations = {};
    const currentUserId = req.user._id.toString();

    messages.forEach((message) => {
      const senderId = (
        message.sender?._id ||
        message.sender ||
        message.senderId ||
        message.customerId
      )?.toString?.();
      const receiverId = (
        message.receiver?._id ||
        message.receiver ||
        message.receiverId ||
        message.farmerId
      )?.toString?.();

      if (!senderId || !receiverId) return;
      if (senderId !== currentUserId && receiverId !== currentUserId) return;

      const otherUserId = senderId === currentUserId ? receiverId : senderId;
      if (!otherUserId) return;

      const otherUserObj =
        senderId === currentUserId ? message.receiver : message.sender;
      const conversationId = otherUserId;

      if (!conversations[conversationId]) {
        conversations[conversationId] = {
          user: {
            _id: otherUserId,
            name: otherUserObj?.name || "Customer",
            role: otherUserObj?.role || "consumer",
          },
          lastMessage: {
            content: message.content,
            createdAt: message.createdAt,
            isRead: message.isRead,
          },
          unreadCount: receiverId === currentUserId && !message.isRead ? 1 : 0,
        };
      } else if (receiverId === currentUserId && !message.isRead) {
        conversations[conversationId].unreadCount += 1;
      }
    });

    res.json({
      success: true,
      count: Object.keys(conversations).length,
      data: Object.values(conversations),
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:userId
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      { sender: req.params.userId, receiver: req.user._id, isRead: false },
      { isRead: true }
    );

    res.json({
      success: true,
      message: "Messages marked as read",
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};
