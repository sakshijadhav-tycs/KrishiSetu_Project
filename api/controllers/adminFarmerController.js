import User from "../models/UserModel.js";
import Order from "../models/OrderModel.js";
import Review from "../models/ReviewModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";
import {
  autoReactivateExpiredSuspensions,
  FARMER_ACCOUNT_STATUS,
  getSuspensionRemainingDays,
  normalizeFarmerAccountStatus,
} from "../utils/accountStatus.js";

const maskAadhaar = (value = "") => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 12) return "";
  return `XXXX XXXX ${digits.slice(-4)}`;
};

const hasSubmittedVerificationDetails = (farmer) => {
  const aadhaarDigits = String(farmer?.aadhaar_number || "").replace(/\D/g, "");
  const mobileDigits = String(farmer?.mobile_number || "").replace(/\D/g, "");
  return aadhaarDigits.length === 12 && mobileDigits.length === 10;
};

const getFarmerAdminActions = (farmer) => {
  const accountStatus = normalizeFarmerAccountStatus(farmer?.accountStatus);
  const verificationStatus = String(
    farmer?.verification?.verificationStatus || farmer?.verification_status || "unverified"
  ).toLowerCase();
  const canVerify = hasSubmittedVerificationDetails(farmer);

  const actions = {
    canApprove: false,
    canReject: false,
    canSuspend: false,
    canLiftSuspension: false,
    canVerify,
    canRevokeVerification: verificationStatus === "verified",
  };

  if (accountStatus === FARMER_ACCOUNT_STATUS.SUSPENDED) {
    actions.canLiftSuspension = true;
    actions.canReject = true;
  } else if (accountStatus === FARMER_ACCOUNT_STATUS.REJECTED) {
    actions.canApprove = true;
  } else if (accountStatus === FARMER_ACCOUNT_STATUS.APPROVED) {
    actions.canSuspend = true;
  } else {
    actions.canApprove = true;
    actions.canReject = true;
  }

  if (accountStatus !== FARMER_ACCOUNT_STATUS.APPROVED) {
    actions.canVerify = false;
    actions.canRevokeVerification = false;
  } else if (verificationStatus === "verified") {
    actions.canVerify = false;
  } else {
    actions.canRevokeVerification = false;
  }

  return {
    ...actions,
    visibleActions: Object.entries(actions)
      .filter(([, allowed]) => Boolean(allowed))
      .map(([key]) => key),
  };
};

const enrichSuspension = (farmer) => {
  const normalizedStatus = normalizeFarmerAccountStatus(farmer.accountStatus);
  const remainingDays = getSuspensionRemainingDays(farmer.suspensionEndDate);
  return {
    ...farmer,
    accountStatus: normalizedStatus,
    suspension: {
      start: farmer.suspensionStartDate || null,
      end: farmer.suspensionEndDate || null,
      reason: farmer.suspensionReason || "",
      remainingDays,
      isActive:
        normalizedStatus === FARMER_ACCOUNT_STATUS.SUSPENDED && remainingDays > 0,
    },
    adminActions: getFarmerAdminActions({
      ...farmer,
      accountStatus: normalizedStatus,
    }),
  };
};

// GET /api/admin/farmers
export const getAllFarmersForAdmin = async (req, res) => {
  try {
    await autoReactivateExpiredSuspensions();

    const farmers = await User.find({ role: "farmer" }).select("-password").lean();
    const farmerIds = farmers.map((f) => f._id);

    const [orderStats, reviewStats] = await Promise.all([
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.farmer",
            totalSales: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      Review.aggregate([
        {
          $group: {
            _id: "$farmerId",
            avgRating: { $avg: "$rating" },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
    ]);

    const orderMap = new Map(orderStats.map((o) => [String(o._id), o]));
    const reviewMap = new Map(reviewStats.map((r) => [String(r._id), r]));

    const enrichedFarmers = farmers.map((f) => {
      const orders = orderMap.get(String(f._id));
      const reviews = reviewMap.get(String(f._id));
      return enrichSuspension({
        ...f,
        verification: {
          aadhaarNumberMasked: maskAadhaar(f.aadhaar_number),
          mobileNumber: f.mobile_number || "",
          verificationStatus: f.verification_status || "unverified",
          otpVerified: Boolean(f.otp_verified),
          verifiedBadge: Boolean(f.verified_badge),
          kycSubmittedAt: f.kyc_submitted_at || null,
          kycVerifiedAt: f.kyc_verified_at || null,
          rejectionReason: f.verification_rejection_reason || "",
        },
        performance: {
          totalSales: orders?.totalSales || 0,
          ordersCount: orders?.ordersCount || 0,
          avgRating: reviews?.avgRating || null,
          totalReviews: reviews?.totalReviews || 0,
        },
      });
    });

    return res.json({
      success: true,
      count: enrichedFarmers.length,
      data: enrichedFarmers,
    });
  } catch (error) {
    console.error("Get farmers (admin) error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load farmers" });
  }
};

// PATCH /api/admin/farmers/:id/verification
export const updateFarmerVerification = async (req, res) => {
  try {
    const { status, reason = "" } = req.body;
    const farmer = await User.findOne({ _id: req.params.id, role: "farmer" });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const normalizedStatus = String(status || "").toLowerCase();
    if (!["verified", "unverified"].includes(normalizedStatus)) {
      return res.status(400).json({
        success: false,
        message: "Verification status must be either verified or unverified",
      });
    }

    if (normalizedStatus === "verified" && !hasSubmittedVerificationDetails(farmer)) {
      return res.status(400).json({
        success: false,
        message:
          "Farmer cannot be marked verified until Aadhaar number and mobile number are submitted",
      });
    }

    farmer.verification_status = normalizedStatus;
    farmer.otp_verified = normalizedStatus === "verified";
    farmer.verified_badge = normalizedStatus === "verified";
    farmer.kyc_submitted_at = farmer.kyc_submitted_at || new Date();
    farmer.kyc_verified_at = normalizedStatus === "verified" ? new Date() : null;
    farmer.verification_rejection_reason =
      normalizedStatus === "unverified" ? reason || "" : "";

    await farmer.save();

    await logAdminAction({
      req,
      action: "UPDATE_FARMER_VERIFICATION",
      resourceType: "farmer",
      resourceId: farmer._id,
      description: `Farmer verification marked as ${normalizedStatus}`,
    });

    return res.json({
      success: true,
      message: `Farmer verification updated to ${normalizedStatus}`,
      data: enrichSuspension({
        ...farmer.toObject(),
        verification: {
          aadhaarNumberMasked: maskAadhaar(farmer.aadhaar_number),
          mobileNumber: farmer.mobile_number || "",
          verificationStatus: farmer.verification_status || "unverified",
          otpVerified: Boolean(farmer.otp_verified),
          verifiedBadge: Boolean(farmer.verified_badge),
          kycSubmittedAt: farmer.kyc_submitted_at || null,
          kycVerifiedAt: farmer.kyc_verified_at || null,
          rejectionReason: farmer.verification_rejection_reason || "",
        },
      }),
    });
  } catch (error) {
    console.error("Update farmer verification error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update farmer verification" });
  }
};

// PATCH /api/admin/farmers/:id/status
export const updateFarmerStatus = async (req, res) => {
  try {
    const {
      status,
      rejectionReason = "",
      suspensionStartDate = null,
      suspensionEndDate = null,
      suspensionReason = "",
    } = req.body;

    const allowed = [
      FARMER_ACCOUNT_STATUS.PENDING,
      FARMER_ACCOUNT_STATUS.APPROVED,
      FARMER_ACCOUNT_STATUS.REJECTED,
      FARMER_ACCOUNT_STATUS.SUSPENDED,
      "approved",
      "rejected",
      "suspended",
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
      });
    }

    const farmer = await User.findOne({ _id: req.params.id, role: "farmer" });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const normalizedStatus = normalizeFarmerAccountStatus(status);
    farmer.accountStatus = normalizedStatus;

    if (normalizedStatus === FARMER_ACCOUNT_STATUS.REJECTED) {
      farmer.rejectionReason =
        rejectionReason || "Rejected by admin after account review.";
      farmer.suspensionStartDate = null;
      farmer.suspensionEndDate = null;
      farmer.suspensionReason = "";
    } else if (normalizedStatus === FARMER_ACCOUNT_STATUS.SUSPENDED) {
      const start = suspensionStartDate ? new Date(suspensionStartDate) : new Date();
      const end = suspensionEndDate ? new Date(suspensionEndDate) : null;

      if (!end || Number.isNaN(end.getTime()) || end <= start) {
        return res.status(400).json({
          success: false,
          message: "Valid suspensionEndDate is required and must be after start date",
        });
      }

      farmer.suspensionStartDate = start;
      farmer.suspensionEndDate = end;
      farmer.suspensionReason = suspensionReason || "Suspended by admin.";
      farmer.rejectionReason = "";
    } else if (normalizedStatus === FARMER_ACCOUNT_STATUS.APPROVED) {
      farmer.rejectionReason = "";
      farmer.suspensionStartDate = null;
      farmer.suspensionEndDate = null;
      farmer.suspensionReason = "";
    }

    await farmer.save();

    await logAdminAction({
      req,
      action: "UPDATE_FARMER_STATUS",
      resourceType: "farmer",
      resourceId: farmer._id,
      description: `Farmer status changed to ${normalizedStatus}`,
    });

    const farmerObj = farmer.toObject();
    return res.json({
      success: true,
      message: "Farmer status updated",
      data: enrichSuspension(farmerObj),
    });
  } catch (error) {
    console.error("Update farmer status error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update farmer status" });
  }
};

// PATCH /api/admin/farmers/:id/lift-suspension
export const liftFarmerSuspension = async (req, res) => {
  try {
    const farmer = await User.findOne({ _id: req.params.id, role: "farmer" });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    farmer.accountStatus = FARMER_ACCOUNT_STATUS.APPROVED;
    farmer.suspensionStartDate = null;
    farmer.suspensionEndDate = null;
    farmer.suspensionReason = "";
    farmer.rejectionReason = "";
    await farmer.save();

    await logAdminAction({
      req,
      action: "LIFT_FARMER_SUSPENSION",
      resourceType: "farmer",
      resourceId: farmer._id,
      description: "Farmer suspension lifted by admin",
    });

    return res.json({
      success: true,
      message: "Suspension lifted and farmer reactivated",
      data: enrichSuspension(farmer.toObject()),
    });
  } catch (error) {
    console.error("Lift farmer suspension error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to lift suspension" });
  }
};
