import User from "../models/UserModel.js";

export const FARMER_ACCOUNT_STATUS = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};

const LEGACY_STATUS_MAP = {
  active: FARMER_ACCOUNT_STATUS.PENDING,
  approved: FARMER_ACCOUNT_STATUS.APPROVED,
  rejected: FARMER_ACCOUNT_STATUS.REJECTED,
  suspended: FARMER_ACCOUNT_STATUS.SUSPENDED,
};

export const normalizeFarmerAccountStatus = (status) => {
  if (!status) return FARMER_ACCOUNT_STATUS.PENDING;
  return LEGACY_STATUS_MAP[status] || status;
};

export const getSuspensionRemainingDays = (suspensionEndDate) => {
  if (!suspensionEndDate) return 0;
  const now = new Date();
  const end = new Date(suspensionEndDate);
  if (end <= now) return 0;
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

export const autoReactivateExpiredSuspensions = async () => {
  const now = new Date();
  await User.updateMany(
    {
      role: "farmer",
      accountStatus: { $in: [FARMER_ACCOUNT_STATUS.SUSPENDED, "suspended"] },
      suspensionEndDate: { $exists: true, $ne: null, $lt: now },
    },
    {
      $set: {
        accountStatus: FARMER_ACCOUNT_STATUS.APPROVED,
      },
      $unset: {
        suspensionStartDate: 1,
        suspensionEndDate: 1,
        suspensionReason: 1,
      },
    }
  );
};

export const getFarmerAccountBlockReason = (farmer) => {
  const status = normalizeFarmerAccountStatus(farmer?.accountStatus);
  if (status === FARMER_ACCOUNT_STATUS.APPROVED) {
    return { blocked: false, status };
  }

  if (status === FARMER_ACCOUNT_STATUS.REJECTED) {
    return {
      blocked: true,
      status,
      message: "Account Rejected",
      reason: farmer?.rejectionReason || "Your account has been rejected by admin.",
    };
  }

  if (status === FARMER_ACCOUNT_STATUS.SUSPENDED) {
    return {
      blocked: true,
      status,
      message: "Account Suspended",
      reason: farmer?.suspensionReason || "Your account is under suspension.",
      suspensionStartDate: farmer?.suspensionStartDate || null,
      suspensionEndDate: farmer?.suspensionEndDate || null,
      remainingDays: getSuspensionRemainingDays(farmer?.suspensionEndDate),
    };
  }

  return {
    blocked: true,
    status,
    message: "Account Pending",
    reason: "Your account is waiting for admin approval.",
  };
};
