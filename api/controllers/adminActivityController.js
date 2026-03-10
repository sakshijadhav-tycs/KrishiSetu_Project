import ActivityLog from "../models/ActivityLogModel.js";

// GET /api/admin/activity-logs
export const getActivityLogs = async (req, res) => {
  try {
    const { adminId, action, limit = 50 } = req.query;
    const filter = {};

    if (adminId) filter.admin = adminId;
    if (action) filter.action = action;

    const logs = await ActivityLog.find(filter)
      .populate("admin", "name email")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error("Admin get activity logs error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load activity logs",
    });
  }
};

