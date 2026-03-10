import Notification from "../models/NotificationModel.js";
import { deactivateExpiredNotifications } from "./adminNotificationController.js";

const normalizeUserRole = (role) => {
  if (role === "farmer") return "farmer";
  return "customer";
};

// GET /api/notifications
export const getVisibleNotificationsForUser = async (req, res) => {
  try {
    await deactivateExpiredNotifications();
    const now = new Date();
    const userRole = normalizeUserRole(req.user.role);

    const notifications = await Notification.find({
      isActive: true,
      startDateTime: { $lte: now },
      $or: [{ isPermanent: true }, { endDateTime: { $gte: now } }],
      targetRole: { $in: ["all", userRole] },
    })
      .select("title message targetRole startDateTime endDateTime isPermanent createdAt")
      .sort({ startDateTime: -1, createdAt: -1 });

    return res.json({
      success: true,
      count: notifications.length,
      data: notifications,
    });
  } catch (error) {
    console.error("Get visible notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
};
