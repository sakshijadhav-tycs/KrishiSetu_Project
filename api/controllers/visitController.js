import Visit from "../models/VisitModel.js";
import User from "../models/UserModel.js";
import {
  autoReactivateExpiredSuspensions,
  FARMER_ACCOUNT_STATUS,
  normalizeFarmerAccountStatus,
} from "../utils/accountStatus.js";

const buildVisitId = () =>
  `VIS-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

// @desc    Create a new visit request
// @route   POST /api/visits
// @access  Private (Customer)
export const createVisit = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();

    const { farmerId, requestedDate, date, message, notes } = req.body;

    if (req.user.role !== "consumer") {
      return res.status(403).json({ success: false, message: "Only customers can request visits" });
    }

    const farmer = await User.findById(farmerId).select(
      "role accountStatus visitFeatureSuspended visitFeatureSuspendedUntil"
    );
    if (!farmer || farmer.role !== "farmer") {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const farmerStatus = normalizeFarmerAccountStatus(farmer.accountStatus);
    if (farmerStatus !== FARMER_ACCOUNT_STATUS.APPROVED) {
      return res.status(403).json({
        success: false,
        message: "Visit requests are disabled for this farmer",
      });
    }

    if (farmer.visitFeatureSuspended) {
      const isExpired =
        farmer.visitFeatureSuspendedUntil &&
        new Date(farmer.visitFeatureSuspendedUntil) < new Date();

      if (isExpired) {
        farmer.visitFeatureSuspended = false;
        farmer.visitFeatureSuspendedReason = "";
        farmer.visitFeatureSuspendedUntil = null;
        await farmer.save();
      } else {
        return res.status(403).json({
          success: false,
          message: "Visit requests are currently suspended for this farmer",
        });
      }
    }

    const effectiveRequestedDate = requestedDate || date;
    const visitDate = new Date(effectiveRequestedDate);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    if (!effectiveRequestedDate || Number.isNaN(visitDate.getTime())) {
      return res.status(400).json({ success: false, message: "Valid requestedDate is required" });
    }
    if (visitDate < startOfToday) {
      return res.status(400).json({ success: false, message: "Cannot request a visit in the past" });
    }

    const visit = await Visit.create({
      visitId: buildVisitId(),
      customerId: req.user._id,
      farmerId,
      requestedDate: visitDate,
      message: message || notes || "",
      status: "Pending",
    });

    res.status(201).json(visit);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get logged in user's visits
// @route   GET /api/visits/my-visits
// @access  Private
export const getMyVisits = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === "consumer") {
      filter = { customerId: req.user._id };
    } else if (req.user.role === "farmer") {
      filter = { farmerId: req.user._id };
    } else {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const visits = await Visit.find(filter)
      .populate("farmerId", "name email phone")
      .populate("customerId", "name email phone")
      .sort({ requestedDate: -1 });

    res.json(visits);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get visit requests for a farmer
// @route   GET /api/visits/requests
// @access  Private (Farmer)
export const getVisitRequests = async (req, res) => {
  try {
    if (req.user.role !== "farmer") {
      return res.status(403).json({ success: false, message: "Not authorized as a farmer" });
    }

    const visits = await Visit.find({ farmerId: req.user._id })
      .populate("customerId", "name email phone")
      .sort({ requestedDate: -1 });

    res.json(visits);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update visit status
// @route   PUT /api/visits/:id
// @access  Private (Farmer/Admin)
export const updateVisitStatus = async (req, res) => {
  try {
    const { status, proposedDate } = req.body;
    const allowedStatuses = ["Accepted", "Rejected", "Cancelled", "Pending"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid visit status" });
    }

    const visit = await Visit.findById(req.params.id);
    if (!visit) {
      return res.status(404).json({ success: false, message: "Visit not found" });
    }

    if (
      visit.farmerId.toString() !== req.user._id.toString() &&
      visit.customerId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ success: false, message: "Not authorized to update this visit" });
    }

    if (status) visit.status = status;
    if (proposedDate) visit.proposedDate = new Date(proposedDate);

    const updatedVisit = await visit.save();
    res.json(updatedVisit);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
