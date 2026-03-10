import User from "../models/UserModel.js";
import Order from "../models/OrderModel.js";
import MainOrder from "../models/MainOrderModel.js";
import Product from "../models/ProductModel.js";
import Complaint from "../models/ComplaintModel.js";
import ActivityLog from "../models/ActivityLogModel.js";

// GET /api/admin/dashboard
export const getAdminDashboard = async (req, res) => {
  try {
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setMonth(yearAgo.getMonth() - 11);
    yearAgo.setHours(0, 0, 0, 0);

    const [farmerCount, productCount, orderCount, splitOrderCount, complaintCount] =
      await Promise.all([
        User.countDocuments({ role: "farmer" }),
        Product.countDocuments({ isActive: true }),
        Order.countDocuments({}),
        MainOrder.countDocuments({}),
        Complaint.countDocuments({}),
      ]);

    const [regularMonthly, splitMonthly] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: yearAgo },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalAmount: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      MainOrder.aggregate([
        {
          $match: {
            createdAt: { $gte: yearAgo },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalAmount: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const monthMap = new Map();
    [...regularMonthly, ...splitMonthly].forEach((row) => {
      const key = `${row._id.year}-${row._id.month}`;
      const prev = monthMap.get(key) || {
        _id: row._id,
        totalAmount: 0,
        ordersCount: 0,
      };
      prev.totalAmount += Number(row.totalAmount || 0);
      prev.ordersCount += Number(row.ordersCount || 0);
      monthMap.set(key, prev);
    });
    const monthlySales = Array.from(monthMap.values()).sort((a, b) =>
      a._id.year === b._id.year ? a._id.month - b._id.month : a._id.year - b._id.year
    );

    const complaintDistribution = await Complaint.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const legacyComplaintDistribution = complaintDistribution.map((item) => {
      const map = {
        Pending: "open",
        "In Review": "in_review",
        Resolved: "resolved",
        Rejected: "closed",
      };
      return { ...item, _id: map[item._id] || item._id };
    });

    const recentActivity = await ActivityLog.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("admin", "name email");

    return res.json({
      success: true,
      data: {
        kpis: {
          farmers: farmerCount,
          products: productCount,
          orders: orderCount + splitOrderCount,
          singleVendorOrders: orderCount,
          splitOrders: splitOrderCount,
          complaints: complaintCount,
        },
        monthlySales,
        complaintDistribution: legacyComplaintDistribution,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load dashboard data" });
  }
};

