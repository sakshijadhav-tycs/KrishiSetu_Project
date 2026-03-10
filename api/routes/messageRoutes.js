import express from "express";
import {
  sendMessage,
  getConversation,
  getConversations,
  markAsRead,
} from "../controllers/messageController.js"; // .js extension zaroori hai
import { verifyToken } from "../utils/authMiddleware.js"; // .js extension zaroori hai

const router = express.Router();

router.post("/", verifyToken, sendMessage);
router.get("/", verifyToken, getConversations);
router.get("/:userId", verifyToken, getConversation);
router.put("/read/:userId", verifyToken, markAsRead);

// 🚨 Sabse important line jo error fix karegi:
export default router;