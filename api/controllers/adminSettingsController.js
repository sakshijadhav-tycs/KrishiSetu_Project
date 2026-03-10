import Settings from "../models/SettingsModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";

const ensureSettingsDoc = async () => {
  let settings = await Settings.findOne();
  if (!settings) {
    settings = await Settings.create({});
  }
  return settings;
};

// GET /api/admin/settings
export const getPlatformSettings = async (req, res) => {
  try {
    const settings = await ensureSettingsDoc();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error("Admin get settings error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load settings" });
  }
};

// PUT /api/admin/settings
export const updatePlatformSettings = async (req, res) => {
  try {
    const settings = await ensureSettingsDoc();

    Object.assign(settings, req.body || {});
    await settings.save();

    await logAdminAction({
      req,
      action: "UPDATE_SETTINGS",
      resourceType: "settings",
      resourceId: settings._id,
      description: "Platform settings updated",
    });

    return res.json({
      success: true,
      message: "Settings updated",
      data: settings,
    });
  } catch (error) {
    console.error("Admin update settings error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update settings" });
  }
};

