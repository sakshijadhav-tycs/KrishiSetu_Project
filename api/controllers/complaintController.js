import Complaint from "../models/ComplaintModel.js";

const buildComplaintId = () =>
  `CMP-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

const allowedTypes = [
  "Order Issue",
  "Payment Issue",
  "Product Quality Issue",
  "Account Issue",
  "Other",
];

// POST /api/complaints
export const raiseComplaint = async (req, res) => {
  try {
    const { complaintType, orderId, description } = req.body;
    if (!allowedTypes.includes(complaintType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid complaint type",
      });
    }

    if (!description || String(description).trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    if (!["consumer", "farmer"].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Only customers and farmers can raise complaints",
      });
    }

    const complaint = await Complaint.create({
      complaintId: buildComplaintId(),
      userId: req.user._id,
      userRole: req.user.role === "farmer" ? "Farmer" : "Customer",
      complaintType,
      orderId: orderId || null,
      description: String(description).trim(),
      imageUrl: req.file ? req.file.path.replace(/\\/g, "/") : "",
      status: "Pending",
      title: complaintType,
      type: "other",
      createdBy: req.user._id,
      order: orderId || null,
      attachments: req.file ? [req.file.path.replace(/\\/g, "/")] : [],
    });

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: complaint,
    });
  } catch (error) {
    console.error("Raise complaint error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to submit complaint" });
  }
};

// GET /api/complaints/my
export const getMyComplaints = async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user._id })
      .select("complaintId complaintType status adminNote createdAt updatedAt orderId description imageUrl")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      count: complaints.length,
      data: complaints,
    });
  } catch (error) {
    console.error("Get my complaints error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load complaints" });
  }
};
