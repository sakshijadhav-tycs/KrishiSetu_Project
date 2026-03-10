import ActivityLog from "../models/ActivityLogModel.js";

/**
 * Helper to persist an admin activity log entry.
 * Call this from controllers after a successful admin action.
 */
export const logAdminAction = async ({
  req,
  action,
  resourceType,
  resourceId,
  description = "",
  metadata = {},
}) => {
  try {
    if (!req.user || req.user.role !== "admin") return;

    await ActivityLog.create({
      admin: req.user._id,
      action,
      resourceType,
      resourceId: String(resourceId),
      description,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      metadata,
    });
  } catch (err) {
    // Logging failures should never break the main request flow
    console.error("ActivityLog error:", err.message);
  }
};

