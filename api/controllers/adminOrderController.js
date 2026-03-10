import Order from "../models/OrderModel.js";
import MainOrder from "../models/MainOrderModel.js";
import SubOrder from "../models/SubOrderModel.js";
import Subscription from "../models/SubscriptionModel.js";
import { logAdminAction } from "../middleware/activityLogger.js";
import { runRegularSettlementSweep } from "../services/settlementService.js";
import { runSettlementSweep } from "../modules/transparentOrders/services/transparentOrderService.js";

// GET /api/admin/orders
export const getAdminOrders = async (req, res) => {
  try {
    setImmediate(async () => {
      try {
        await Promise.all([
          runSettlementSweep({ source: "read:admin_orders_non_blocking" }),
          runRegularSettlementSweep(new Date(), {
            source: "read:admin_orders_non_blocking",
          }),
        ]);
      } catch (err) {
        console.error("[admin-orders-self-heal] error:", err.message);
      }
    });

    const {
      page = 1,
      limit = 20,
      status,
      from,
      to,
      search,
      category = "all",
      paymentMethod = "all",
    } = req.query;

    const query = {};
    const normalizedCategory = String(category).toLowerCase();
    const normalizedPayment = String(paymentMethod).toLowerCase();

    if (status && status !== "all") {
      if (status === "delivered") {
        query.status = { $in: ["delivered", "completed"] };
      } else {
        query.status = status;
      }
    }

    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    if (search) {
      query._id = { $regex: search, $options: "i" };
    }

    if (normalizedCategory === "subscription") {
      query.isSubscriptionOrder = true;
    } else if (normalizedCategory === "single") {
      query.isSubscriptionOrder = { $ne: true };
    }

    if (normalizedPayment === "razorpay") {
      query.paymentMethod = "razorpay";
    } else if (normalizedPayment === "cod") {
      query.paymentMethod = { $in: ["cod", "cash"] };
    }

    const skip = (Number(page) - 1) * Number(limit);

    if (normalizedCategory === "split") {
      const splitQuery = {};
      if (status && status !== "all") {
        splitQuery.orderStatus = status;
      }
      if (from || to) {
        splitQuery.createdAt = {};
        if (from) splitQuery.createdAt.$gte = new Date(from);
        if (to) splitQuery.createdAt.$lte = new Date(to);
      }
      if (normalizedPayment === "razorpay") {
        splitQuery.paymentMethod = "razorpay";
      } else if (normalizedPayment === "cod") {
        splitQuery.paymentMethod = { $in: ["cod", "cash"] };
      }

      const [splitOrders, totalSplit] = await Promise.all([
        MainOrder.find(splitQuery)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(Number(limit))
          .populate("customerId", "name email"),
        MainOrder.countDocuments(splitQuery),
      ]);

      const mapped = splitOrders.map((row) => ({
        _id: row._id,
        consumer: row.customerId,
        totalAmount: row.totalAmount,
        paymentStatus: row.paymentStatus,
        paymentMethod: row.paymentMethod || (row.paymentStatus === "paid" ? "razorpay" : "unknown"),
        status: row.status || row.orderStatus,
        orderType: row.orderType || "split",
        orderCategory: row.orderType === "subscription" ? "subscription" : "split",
        trackingId: row.trackingId || "",
        expectedDeliveryDate: row.expectedDeliveryDate || null,
        createdAt: row.createdAt,
      }));
      const splitSubscriptionOrders = mapped.filter((row) => row.orderCategory === "subscription").length;

      return res.json({
        success: true,
        data: mapped,
        overview: {
          totalOrders: totalSplit,
          splitOrders: totalSplit,
          singleVendorOrders: 0,
          subscriptionOrders: splitSubscriptionOrders,
        },
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalSplit,
        },
        stats: [],
      });
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("consumer", "name email")
        .populate("items.product", "name"),
      Order.countDocuments(query),
    ]);
    const mappedOrders = orders.map((row) => ({
      ...row.toObject(),
      orderCategory: row.isSubscriptionOrder ? "subscription" : "single",
    }));

    const stats = await Order.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    const [
      mainOrderStats,
      subOrderPayoutStats,
      subOrderDeliveryStats,
      regularOrderTypeStats,
      regularPayoutStats,
      activeSubscriptions,
      overdueSubOrderPayoutStats,
      overdueRegularPayoutStats,
    ] =
      await Promise.all([
        MainOrder.aggregate([
          {
            $group: {
              _id: null,
              splitOrders: { $sum: 1 },
              subscriptionOrders: {
                $sum: { $cond: [{ $eq: ["$orderType", "subscription"] }, 1, 0] },
              },
              paidOrders: {
                $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] },
              },
              deliveredOrders: {
                $sum: {
                  $cond: [{ $in: ["$orderStatus", ["delivered", "partially_delivered"]] }, 1, 0],
                },
              },
              cancelledOrders: {
                $sum: { $cond: [{ $eq: ["$orderStatus", "cancelled"] }, 1, 0] },
              },
              disputedOrders: {
                $sum: { $cond: [{ $eq: ["$orderStatus", "disputed"] }, 1, 0] },
              },
              totalCommissionEarned: { $sum: "$platformCommissionAmount" },
              totalGstCollected: { $sum: "$gstAmount" },
              totalDeliveryEarnings: { $sum: "$deliveryCharge" },
            },
          },
        ]),
        SubOrder.aggregate([
          {
            $group: {
              _id: null,
              pendingPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Pending"] }, "$payoutAmount", 0] },
              },
              eligiblePayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Eligible"] }, "$payoutAmount", 0] },
              },
              transferredPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "$payoutAmount", 0] },
              },
              onHoldPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "OnHold"] }, 1, 0] },
              },
            },
          },
        ]),
        SubOrder.aggregate([
          {
            $group: {
              _id: null,
              deliveredSubOrders: {
                $sum: { $cond: [{ $eq: ["$fulfillmentStatus", "Delivered"] }, 1, 0] },
              },
            },
          },
        ]),
        Order.aggregate([
          {
            $group: {
              _id: null,
              singleVendorOrders: { $sum: 1 },
              codOrders: {
                $sum: {
                  $cond: [{ $in: ["$paymentMethod", ["cod", "cash"]] }, 1, 0],
                },
              },
              paidOrders: { $sum: { $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0] } },
              cancelledOrders: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
              subscriptionOrders: {
                $sum: { $cond: [{ $eq: ["$isSubscriptionOrder", true] }, 1, 0] },
              },
              totalCommissionEarned: { $sum: { $ifNull: ["$commissionAmount", 0] } },
            },
          },
        ]),
        Order.aggregate([
          {
            $group: {
              _id: null,
              pendingPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Pending"] }, "$payoutAmount", 0] },
              },
              eligiblePayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Eligible"] }, "$payoutAmount", 0] },
              },
              transferredPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "$payoutAmount", 0] },
              },
              onHoldPayouts: {
                $sum: { $cond: [{ $eq: ["$payoutStatus", "OnHold"] }, 1, 0] },
              },
            },
          },
        ]),
        Subscription.countDocuments({ status: { $in: ["active", "paused"] } }),
        SubOrder.aggregate([
          {
            $match: {
              payoutStatus: "Eligible",
              fulfillmentStatus: "Delivered",
              autoSettleAt: { $lte: new Date() },
            },
          },
          {
            $group: {
              _id: null,
              overdueEligiblePayoutCount: { $sum: 1 },
              overdueEligiblePayoutAmount: { $sum: "$payoutAmount" },
            },
          },
        ]),
        Order.aggregate([
          {
            $match: {
              payoutStatus: "Eligible",
              autoSettleAt: { $lte: new Date() },
              status: { $nin: ["cancelled", "rejected", "CANCELLED_BY_FARMER"] },
            },
          },
          {
            $group: {
              _id: null,
              overdueEligiblePayoutCount: { $sum: 1 },
              overdueEligiblePayoutAmount: { $sum: "$payoutAmount" },
            },
          },
        ]),
      ]);

    const splitStats = mainOrderStats[0] || {};
    const payoutStats = subOrderPayoutStats[0] || {};
    const deliveredSplit = subOrderDeliveryStats[0] || {};
    const regularStats = regularOrderTypeStats[0] || {};
    const regularPayout = regularPayoutStats[0] || {};
    const overdueSub = overdueSubOrderPayoutStats[0] || {};
    const overdueRegular = overdueRegularPayoutStats[0] || {};
    const totalOrdersCombined = Number(total || 0) + Number(splitStats.splitOrders || 0);

    return res.json({
      success: true,
      data: mappedOrders,
      overview: {
        totalOrders: totalOrdersCombined,
        splitOrders: Number(splitStats.splitOrders || 0),
        singleVendorOrders: Number(regularStats.singleVendorOrders || 0),
        codOrders: Number(regularStats.codOrders || 0),
        paidOrders:
          Number(regularStats.paidOrders || 0) + Number(splitStats.paidOrders || 0),
        deliveredOrders:
          Number(deliveredSplit.deliveredSubOrders || 0) + Number(splitStats.deliveredOrders || 0),
        cancelledOrders:
          Number(regularStats.cancelledOrders || 0) + Number(splitStats.cancelledOrders || 0),
        pendingPayouts: Number(payoutStats.pendingPayouts || 0) + Number(regularPayout.pendingPayouts || 0),
        eligiblePayouts: Number(payoutStats.eligiblePayouts || 0) + Number(regularPayout.eligiblePayouts || 0),
        transferredPayouts: Number(payoutStats.transferredPayouts || 0) + Number(regularPayout.transferredPayouts || 0),
        totalCommissionEarned: Number(splitStats.totalCommissionEarned || 0) + Number(regularStats.totalCommissionEarned || 0),
        totalGSTCollected: Number(splitStats.totalGstCollected || 0),
        totalDeliveryEarnings: Number(splitStats.totalDeliveryEarnings || 0),
        disputedOrders:
          Number(payoutStats.onHoldPayouts || 0) + Number(regularPayout.onHoldPayouts || 0),
        subscriptionOrders:
          Number(regularStats.subscriptionOrders || 0) +
          Number(splitStats.subscriptionOrders || 0),
        activeSubscriptions: Number(activeSubscriptions || 0),
        overdueEligiblePayoutCount:
          Number(overdueSub.overdueEligiblePayoutCount || 0) +
          Number(overdueRegular.overdueEligiblePayoutCount || 0),
        overdueEligiblePayoutAmount:
          Number(overdueSub.overdueEligiblePayoutAmount || 0) +
          Number(overdueRegular.overdueEligiblePayoutAmount || 0),
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
      },
      stats,
    });
  } catch (error) {
    console.error("Admin get orders error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load orders" });
  }
};

// GET /api/admin/orders/:id
export const getAdminOrderById = async (req, res) => {
  try {
    let order = await Order.findById(req.params.id)
      .populate("consumer", "name email phone address")
      .populate("items.product", "name price images")
      .populate("items.farmer", "name email phone");

    if (!order) {
      const mainOrder = await MainOrder.findById(req.params.id)
        .populate("customerId", "name email phone address")
        .lean();
      if (!mainOrder) {
        return res
          .status(404)
          .json({ success: false, message: "Order not found" });
      }
      return res.json({
        success: true,
        data: {
          _id: mainOrder._id,
          consumer: mainOrder.customerId,
          totalAmount: mainOrder.totalAmount,
          paymentStatus: mainOrder.paymentStatus,
          paymentMethod: mainOrder.paymentMethod || "razorpay",
          status: mainOrder.status || mainOrder.orderStatus,
          orderCategory: mainOrder.orderType === "subscription" ? "subscription" : "split",
          trackingId: mainOrder.trackingId || "",
          expectedDeliveryDate: mainOrder.expectedDeliveryDate || null,
          createdAt: mainOrder.createdAt,
          items: [],
        },
      });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    console.error("Admin get order detail error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load order detail" });
  }
};

// POST /api/admin/orders/:id/flag
export const flagOrder = async (req, res) => {
  try {
    const { reason } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    await logAdminAction({
      req,
      action: "FLAG_ORDER",
      resourceType: "order",
      resourceId: order._id,
      description: `Order flagged as suspicious`,
      metadata: { reason },
    });

    return res.json({
      success: true,
      message: "Order flagged successfully",
    });
  } catch (error) {
    console.error("Admin flag order error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to flag order" });
  }
};

// POST /api/admin/orders/:id/note
export const addOrderNote = async (req, res) => {
  try {
    const { note } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    await logAdminAction({
      req,
      action: "ADD_NOTE",
      resourceType: "order",
      resourceId: order._id,
      description: "Admin note added to order",
      metadata: { note },
    });

    return res.json({
      success: true,
      message: "Note added successfully",
    });
  } catch (error) {
    console.error("Admin add order note error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to add note" });
  }
};

