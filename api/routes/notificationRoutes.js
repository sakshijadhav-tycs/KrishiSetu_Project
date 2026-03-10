import express from "express";
import { verifyToken } from "../utils/authMiddleware.js";
import { getVisibleNotificationsForUser } from "../controllers/notificationController.js";

const router = express.Router();

router.get("/", verifyToken, getVisibleNotificationsForUser);

export default router;
