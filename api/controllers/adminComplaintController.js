import Complaint from "../models/ComplaintModel.js";
import User from "../models/UserModel.js";
import Notification from "../models/NotificationModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";
import { sendEmail } from "../utils/sendEmail.js";
import { FARMER_ACCOUNT_STATUS } from "../utils/accountStatus.js";

const sendComplaintUpdateNotification = async (complaint, message) => {
  try {
    const targetUser = await User.findById(complaint.userId).select("email name");
    if (!targetUser) return;

    await Notification.create({
      title: "Complaint Update",
      message,
      target: "custom",
      recipients: [targetUser._id],
      sentBy: null,
      isBroadcast: false,
    });

    if (targetUser.email) {
      await sendEmail({
        email: targetUser.email,
        subject: `KrishiSetu Complaint Update: ${complaint.complaintId}`,
        html: `<p>Hi ${targetUser.name},</p><p>${message}</p>`,
      });
    }
  } catch (error) {
    console.error("Complaint notification error:", error.message);
  }
};

// GET /api/admin/complaints
export const getAllComplaints = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) {
      const statusMap = {
        open: "Pending",
        in_review: "In Review",
        resolved: "Resolved",
        closed: "Rejected",
      };
      filter.status = statusMap[status] || status;
    }

    const complaints = await Complaint.find(filter)
      .populate("userId", "name email role")
      .populate("createdBy", "name email role")
      .populate("orderId", "_id totalAmount status")
      .populate("order", "_id totalAmount status")
      .sort({ createdAt: -1 });

    const mappedComplaints = complaints.map((complaint) => {
      const statusMap = {
        Pending: "open",
        "In Review": "in_review",
        Resolved: "resolved",
        Rejected: "closed",
      };
      const obj = complaint.toObject();
      return {
        ...obj,
        createdBy: obj.createdBy || obj.userId,
        order: obj.order || obj.orderId,
        legacyStatus: statusMap[obj.status] || obj.status,
      };
    });

    return res.json({
      success: true,
      count: mappedComplaints.length,
      data: mappedComplaints,
    });
  } catch (error) {
    console.error("Admin get complaints error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load complaints" });
  }
};

// PATCH /api/admin/complaints/:id
export const updateComplaint = async (req, res) => {
  try {
    const { status, adminNote, adminNotes } = req.body;
    const allowedStatuses = ["Pending", "In Review", "Resolved", "Rejected"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint status",
      });
    }

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    const noteToSave =
      typeof adminNote === "string"
        ? adminNote
        : typeof adminNotes === "string"
        ? adminNotes
        : null;

    if (noteToSave !== null) {
      complaint.adminNote = noteToSave;
      complaint.adminNotes = noteToSave;
    }
    if (status) complaint.status = status;

    await complaint.save();

    await logAdminAction({
      req,
      action: "UPDATE_COMPLAINT",
      resourceType: "complaint",
      resourceId: complaint._id,
      description: `Complaint ${complaint.complaintId} updated with status ${complaint.status}`,
    });

    await sendComplaintUpdateNotification(
      complaint,
      `Complaint ${complaint.complaintId} status is now "${complaint.status}". ${complaint.adminNote ? `Admin note: ${complaint.adminNote}` : ""}`
    );

    return res.json({
      success: true,
      message: "Complaint updated",
      data: complaint,
    });
  } catch (error) {
    console.error("Admin update complaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to update complaint" });
  }
};

// POST /api/admin/complaints/:id/suspend-user
export const suspendComplaintUser = async (req, res) => {
  try {
    const { suspensionEndDate, suspensionReason } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    const user = await User.findById(complaint.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (user.role !== "farmer") {
      return res.status(400).json({
        success: false,
        message: "Only farmer accounts can be suspended with this action",
      });
    }

    const end = suspensionEndDate ? new Date(suspensionEndDate) : null;
    if (!end || Number.isNaN(end.getTime()) || end <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "Valid future suspensionEndDate is required",
      });
    }

    user.accountStatus = FARMER_ACCOUNT_STATUS.SUSPENDED;
    user.suspensionStartDate = new Date();
    user.suspensionEndDate = end;
    user.suspensionReason = suspensionReason || `Suspended due to complaint ${complaint.complaintId}`;
    user.rejectionReason = "";
    await user.save();

    await logAdminAction({
      req,
      action: "SUSPEND_USER_FROM_COMPLAINT",
      resourceType: "user",
      resourceId: user._id,
      description: `Farmer suspended from complaint ${complaint.complaintId}`,
    });

    await sendComplaintUpdateNotification(
      complaint,
      `Your account has been suspended by admin related to complaint ${complaint.complaintId}.`
    );

    return res.json({
      success: true,
      message: "User suspended successfully",
      data: user,
    });
  } catch (error) {
    console.error("Suspend user from complaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to suspend user" });
  }
};

// POST /api/admin/complaints/:id/send-warning
export const sendComplaintWarning = async (req, res) => {
  try {
    const { warningMessage } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res
        .status(404)
        .json({ success: false, message: "Complaint not found" });
    }

    const user = await User.findById(complaint.userId).select("name email");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const message =
      warningMessage ||
      `Admin warning for complaint ${complaint.complaintId}. Please review platform policy and take corrective action.`;

    await Notification.create({
      title: "Admin Warning",
      message,
      target: "custom",
      recipients: [user._id],
      sentBy: req.user._id,
      isBroadcast: false,
    });

    if (user.email) {
      await sendEmail({
        email: user.email,
        subject: "KrishiSetu Admin Warning",
        html: `<p>Hi ${user.name},</p><p>${message}</p>`,
      });
    }

    await logAdminAction({
      req,
      action: "SEND_COMPLAINT_WARNING",
      resourceType: "complaint",
      resourceId: complaint._id,
      description: `Warning sent for complaint ${complaint.complaintId}`,
    });

    return res.json({
      success: true,
      message: "Warning sent successfully",
    });
  } catch (error) {
    console.error("Send complaint warning error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to send warning" });
  }
};
