import Notification from "../models/NotificationModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";

const resolveTargetRole = (target) => {
  if (target === "farmer" || target === "farmers") return "farmer";
  if (target === "customer" || target === "customers") return "customer";
  return "all";
};

const computeEndDateFromDuration = (startDate, durationValue, durationUnit) => {
  if (!durationValue) return null;
  const numeric = Number(durationValue);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;

  const msPerUnit = durationUnit === "days" ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000;
  return new Date(startDate.getTime() + numeric * msPerUnit);
};

const deriveStatus = (notification, now = new Date()) => {
  if (!notification.isActive) return "Inactive";
  const start = new Date(notification.startDateTime);
  if (now < start) return "Scheduled";
  if (notification.isPermanent) return "Active";
  if (!notification.endDateTime) return "Active";
  return now <= new Date(notification.endDateTime) ? "Active" : "Expired";
};

const getRemainingTime = (notification, now = new Date()) => {
  if (notification.isPermanent || !notification.endDateTime) return null;
  const diff = new Date(notification.endDateTime).getTime() - now.getTime();
  if (diff <= 0) return "Expired";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
};

const deactivateExpiredNotifications = async () => {
  const now = new Date();
  await Notification.updateMany(
    {
      isActive: true,
      isPermanent: false,
      endDateTime: { $ne: null, $lt: now },
    },
    { $set: { isActive: false } }
  );
};

// POST /api/admin/notifications
export const createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      targetRole,
      target,
      displayType = "permanent",
      startDateTime,
      endDateTime,
      durationValue,
      durationUnit = "hours",
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, message: "Message is required" });
    }

    const role = resolveTargetRole(targetRole || target);
    const start = startDateTime ? new Date(startDateTime) : new Date();
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid startDateTime" });
    }

    let permanent = displayType === "permanent";
    let resolvedEndDate = null;

    if (!permanent) {
      resolvedEndDate = endDateTime ? new Date(endDateTime) : null;

      if (!resolvedEndDate || Number.isNaN(resolvedEndDate.getTime())) {
        resolvedEndDate = computeEndDateFromDuration(start, durationValue, durationUnit);
      }

      if (!resolvedEndDate || Number.isNaN(resolvedEndDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "Valid endDateTime or duration is required for custom expiry",
        });
      }

      if (resolvedEndDate <= start) {
        return res.status(400).json({
          success: false,
          message: "End time must be greater than start time",
        });
      }
    }

    const notification = await Notification.create({
      title: String(title).trim(),
      message: String(message).trim(),
      targetRole: role,
      startDateTime: start,
      endDateTime: permanent ? null : resolvedEndDate,
      isPermanent: permanent,
      isActive: true,
      createdBy: req.user._id,
      // legacy mirrored fields
      target: role === "farmer" ? "farmers" : role === "customer" ? "customers" : "all",
      sentBy: req.user._id,
      isBroadcast: true,
    });

    await logAdminAction({
      req,
      action: "CREATE_NOTIFICATION",
      resourceType: "notification",
      resourceId: notification._id,
      description: `Notification created for targetRole: ${role}`,
    });

    return res.status(201).json({
      success: true,
      message: "Notification created",
      data: notification,
    });
  } catch (error) {
    console.error("Admin create notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create notification",
    });
  }
};

// GET /api/admin/notifications
export const getNotificationsForAdmin = async (req, res) => {
  try {
    await deactivateExpiredNotifications();
    const now = new Date();

    const notifications = await Notification.find({})
      .populate("createdBy", "name email")
      .populate("sentBy", "name email")
      .sort({ createdAt: -1 });

    const enriched = notifications.map((n) => {
      const obj = n.toObject();
      return {
        ...obj,
        status: deriveStatus(obj, now),
        remainingTime: getRemainingTime(obj, now),
      };
    });

    return res.json({
      success: true,
      count: enriched.length,
      data: enriched,
    });
  } catch (error) {
    console.error("Admin get notifications error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load notifications",
    });
  }
};

// PATCH /api/admin/notifications/:id/deactivate
export const deactivateNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notification.isActive = false;
    await notification.save();

    await logAdminAction({
      req,
      action: "DEACTIVATE_NOTIFICATION",
      resourceType: "notification",
      resourceId: notification._id,
      description: `Notification "${notification.title}" deactivated`,
    });

    return res.json({
      success: true,
      message: "Notification deactivated",
      data: notification,
    });
  } catch (error) {
    console.error("Admin deactivate notification error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to deactivate notification",
    });
  }
};

export { deactivateExpiredNotifications, deriveStatus };
