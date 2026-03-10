import Visit from "../models/VisitModel.js";
import User from "../models/UserModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";

// GET /api/admin/visits
export const getAllVisitsForAdmin = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const visits = await Visit.find(filter)
      .populate("customerId", "name email")
      .populate("farmerId", "name email")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: visits.length,
      data: visits,
    });
  } catch (error) {
    console.error("Admin visits fetch error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load visit logs",
    });
  }
};

// PATCH /api/admin/visits/:id/cancel
export const cancelVisitByAdmin = async (req, res) => {
  try {
    const visit = await Visit.findById(req.params.id);
    if (!visit) {
      return res.status(404).json({ success: false, message: "Visit not found" });
    }

    visit.status = "Cancelled";
    await visit.save();

    await logAdminAction({
      req,
      action: "CANCEL_VISIT",
      resourceType: "visit",
      resourceId: visit._id,
      description: `Visit ${visit.visitId} cancelled by admin`,
    });

    return res.json({
      success: true,
      message: "Visit cancelled",
      data: visit,
    });
  } catch (error) {
    console.error("Admin cancel visit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel visit",
    });
  }
};

// PATCH /api/admin/visits/farmers/:farmerId/suspend
export const suspendFarmerFromVisits = async (req, res) => {
  try {
    const { until, reason } = req.body;
    const farmer = await User.findOne({ _id: req.params.farmerId, role: "farmer" });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    farmer.visitFeatureSuspended = true;
    farmer.visitFeatureSuspendedReason = reason || "Suspended from visit feature by admin";
    farmer.visitFeatureSuspendedUntil = until ? new Date(until) : null;
    await farmer.save();

    await logAdminAction({
      req,
      action: "SUSPEND_FARMER_VISITS",
      resourceType: "farmer",
      resourceId: farmer._id,
      description: "Farmer suspended from visit requests",
    });

    return res.json({
      success: true,
      message: "Farmer visit feature suspended",
      data: farmer,
    });
  } catch (error) {
    console.error("Suspend farmer visit error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to suspend farmer from visits",
    });
  }
};

// PATCH /api/admin/visits/farmers/:farmerId/lift
export const liftFarmerVisitSuspension = async (req, res) => {
  try {
    const farmer = await User.findOne({ _id: req.params.farmerId, role: "farmer" });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    farmer.visitFeatureSuspended = false;
    farmer.visitFeatureSuspendedReason = "";
    farmer.visitFeatureSuspendedUntil = null;
    await farmer.save();

    await logAdminAction({
      req,
      action: "LIFT_FARMER_VISIT_SUSPENSION",
      resourceType: "farmer",
      resourceId: farmer._id,
      description: "Farmer visit suspension lifted",
    });

    return res.json({
      success: true,
      message: "Farmer visit suspension lifted",
      data: farmer,
    });
  } catch (error) {
    console.error("Lift farmer visit suspension error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to lift visit suspension",
    });
  }
};
