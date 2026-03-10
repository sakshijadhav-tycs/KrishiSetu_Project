import User from "../models/UserModel.js";
import Order from "../models/OrderModel.js";

export const getAllCustomersForAdmin = async (req, res) => {
  try {
    const customers = await User.find({ role: { $in: ["consumer", "user"] } })
      .select("name email phone createdAt profileImage isBlocked blockedAt blockedReason")
      .sort({ createdAt: -1 })
      .lean();

    const customerIds = customers.map((c) => c._id);
    const orderStats = await Order.aggregate([
      { $match: { consumer: { $in: customerIds } } },
      { $group: { _id: "$consumer", totalOrders: { $sum: 1 } } },
    ]);

    const orderMap = new Map(orderStats.map((item) => [String(item._id), Number(item.totalOrders || 0)]));
    const data = customers.map((customer) => ({
      ...customer,
      totalOrders: orderMap.get(String(customer._id)) || 0,
      accountStatus: customer.isBlocked ? "Blocked" : "Active",
    }));

    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load customers", error: error.message });
  }
};

export const updateCustomerBlockStatus = async (req, res) => {
  try {
    const { isBlocked, reason } = req.body;
    const customer = await User.findOne({ _id: req.params.id, role: { $in: ["consumer", "user"] } });
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const nextBlocked = Boolean(isBlocked);
    customer.isBlocked = nextBlocked;
    customer.blockedAt = nextBlocked ? new Date() : null;
    customer.blockedReason = nextBlocked ? String(reason || "").trim() : "";
    await customer.save();

    return res.json({
      success: true,
      message: nextBlocked ? "Customer blocked successfully" : "Customer unblocked successfully",
      data: {
        _id: customer._id,
        isBlocked: customer.isBlocked,
        blockedAt: customer.blockedAt,
        blockedReason: customer.blockedReason,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update customer status", error: error.message });
  }
};

export const getCustomerOrderHistory = async (req, res) => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: { $in: ["consumer", "user"] } }).select("name email");
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const orders = await Order.find({ consumer: customer._id })
      .populate("items.product", "name")
      .populate("items.farmer", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: {
        customer,
        orders,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to load order history", error: error.message });
  }
};
