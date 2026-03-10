import Deal from "../models/DealModel.js";
import Order from "../models/OrderModel.js";
import OrderItem from "../models/OrderItemModel.js";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import { computeDealPrice, validateDealInput } from "../utils/dealPricing.js";

const resolveDealStatus = (deal, now = new Date()) => {
  if (!deal?.isEnabled) return "disabled";
  if (new Date(deal.endDate) < now) return "expired";
  if (new Date(deal.startDate) > now) return "scheduled";
  return "active";
};

const disableExpiredDeals = async () => {
  const now = new Date();
  await Deal.updateMany(
    { isEnabled: true, endDate: { $lt: now } },
    { $set: { isEnabled: false, disabledBy: "system", disabledReason: "Deal expired" } }
  );
};

const normalizeDealDateBoundary = (value, boundary = "start") => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return d;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    if (boundary === "start") {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 999);
    }
  }
  return d;
};

const computeDealRevenue = async (deal) => {
  const dealProductId = deal?.productId?._id || deal?.productId;
  if (!dealProductId) {
    return { revenue: 0, units: 0 };
  }

  const rangeStart = new Date(deal.startDate);
  const rangeEnd = new Date(deal.endDate);
  const completedOrPaidOrderMatch = {
    $or: [
      { paymentStatus: "paid" },
      { status: { $in: ["delivered", "completed"] } },
    ],
  };

  const [regularAgg, splitAgg] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          "items.product": dealProductId,
          createdAt: { $gte: rangeStart, $lte: rangeEnd },
          ...completedOrPaidOrderMatch,
        },
      },
      { $unwind: "$items" },
      { $match: { "items.product": dealProductId } },
      {
        $group: {
          _id: null,
          revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
          units: { $sum: "$items.quantity" },
        },
      },
    ]),
    OrderItem.aggregate([
      {
        $lookup: {
          from: "mainorders",
          localField: "orderId",
          foreignField: "_id",
          as: "mainOrder",
        },
      },
      { $unwind: "$mainOrder" },
      {
        $match: {
          productId: dealProductId,
          "mainOrder.createdAt": { $gte: rangeStart, $lte: rangeEnd },
          $or: [
            { "mainOrder.paymentStatus": "paid" },
            { "mainOrder.orderStatus": "delivered" },
            { "mainOrder.status": "delivered" },
          ],
        },
      },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          units: { $sum: "$quantity" },
        },
      },
    ]),
  ]);

  const regular = regularAgg[0] || {};
  const split = splitAgg[0] || {};
  return {
    revenue: Number(regular.revenue || 0) + Number(split.revenue || 0),
    units: Number(regular.units || 0) + Number(split.units || 0),
  };
};

export const createDeal = async (req, res) => {
  try {
    await disableExpiredDeals();

    if (req.user?.role !== "farmer") {
      return res.status(403).json({
        success: false,
        message: "Only farmers can create deals",
      });
    }
    const { productId, discountType, discountValue, startDate, endDate, isEnabled = true } = req.body;
    const normalizedStartDate = normalizeDealDateBoundary(startDate, "start");
    const normalizedEndDate = normalizeDealDateBoundary(endDate, "end");

    const product = await Product.findById(productId).select("price farmer");
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }
    if (String(product.farmer) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: "You can create deals only for your own products" });
    }

    const errorMessage = validateDealInput({
      productPrice: product.price,
      discountType,
      discountValue,
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    });
    if (errorMessage) {
      return res.status(400).json({ success: false, message: errorMessage });
    }

    const overlappingActive = await Deal.findOne({
      productId,
      isEnabled: true,
      $or: [
        {
          startDate: { $lte: normalizedEndDate },
          endDate: { $gte: normalizedStartDate },
        },
      ],
    });
    if (overlappingActive) {
      return res.status(400).json({
        success: false,
        message: "An active/scheduled deal already exists for this period",
      });
    }

    const deal = await Deal.create({
      farmerId: req.user._id,
      productId,
      discountType,
      discountValue: Number(discountValue),
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
      isEnabled: Boolean(isEnabled),
      disabledBy: "",
    });

    return res.status(201).json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to create deal" });
  }
};

export const updateDeal = async (req, res) => {
  try {
    await disableExpiredDeals();

    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    const isOwnerFarmer = req.user?.role === "farmer" && String(deal.farmerId) === String(req.user._id);
    const isAdmin = req.user?.role === "admin";
    if (!isOwnerFarmer && !isAdmin) {
      return res.status(403).json({ success: false, message: "Not authorized to update this deal" });
    }

    const product = await Product.findById(deal.productId).select("price");
    if (!product) {
      return res.status(404).json({ success: false, message: "Deal product not found" });
    }

    const patch = {
      discountType: req.body.discountType ?? deal.discountType,
      discountValue: req.body.discountValue ?? deal.discountValue,
      startDate: normalizeDealDateBoundary(req.body.startDate ?? deal.startDate, "start"),
      endDate: normalizeDealDateBoundary(req.body.endDate ?? deal.endDate, "end"),
      isEnabled: typeof req.body.isEnabled === "boolean" ? req.body.isEnabled : deal.isEnabled,
    };

    const errorMessage = validateDealInput({
      productPrice: product.price,
      discountType: patch.discountType,
      discountValue: patch.discountValue,
      startDate: patch.startDate,
      endDate: patch.endDate,
    });
    if (errorMessage) {
      return res.status(400).json({ success: false, message: errorMessage });
    }

    if (patch.isEnabled) {
      const overlappingActive = await Deal.findOne({
        _id: { $ne: deal._id },
        productId: deal.productId,
        isEnabled: true,
        startDate: { $lte: patch.endDate },
        endDate: { $gte: patch.startDate },
      }).lean();
      if (overlappingActive) {
        return res.status(400).json({
          success: false,
          message: "Another active/scheduled deal already overlaps this period",
        });
      }
    }

    if (!patch.isEnabled) {
      deal.disabledBy = isAdmin ? "admin" : "farmer";
      deal.disabledReason = req.body.disabledReason || "";
    } else {
      deal.disabledBy = "";
      deal.disabledReason = "";
    }

    deal.discountType = patch.discountType;
    deal.discountValue = Number(patch.discountValue);
    deal.startDate = patch.startDate;
    deal.endDate = patch.endDate;
    deal.isEnabled = patch.isEnabled;
    await deal.save();

    return res.json({ success: true, data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to update deal" });
  }
};

export const getMyDeals = async (req, res) => {
  try {
    await disableExpiredDeals();

    if (req.user?.role !== "farmer") {
      return res.status(403).json({ success: false, message: "Only farmers can access this endpoint" });
    }
    const { status = "all" } = req.query;
    const deals = await Deal.find({ farmerId: req.user._id })
      .populate("productId", "name price images")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const withMetrics = await Promise.all(
      deals.map(async (deal) => {
        const revenue = await computeDealRevenue(deal);
        const discountedPrice = computeDealPrice({
          originalPrice: deal.productId?.price,
          discountType: deal.discountType,
          discountValue: deal.discountValue,
        });
        return {
          ...deal,
          dealStatus: resolveDealStatus(deal, now),
          revenue,
          pricing: {
            originalPrice: Number(deal.productId?.price || 0),
            discountedPrice,
          },
        };
      })
    );

    const filtered = status === "all"
      ? withMetrics
      : withMetrics.filter((d) => d.dealStatus === String(status).toLowerCase());

    return res.json({ success: true, count: filtered.length, data: filtered });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch deals" });
  }
};

export const getAdminDeals = async (req, res) => {
  try {
    await disableExpiredDeals();

    const { status = "all" } = req.query;
    const now = new Date();
    const deals = await Deal.find({})
      .populate("productId", "name price")
      .populate("farmerId", "name email")
      .sort({ createdAt: -1 })
      .lean();

    const withMetrics = await Promise.all(
      deals.map(async (deal) => {
        const revenue = await computeDealRevenue(deal);
        return {
          ...deal,
          dealStatus: resolveDealStatus(deal, now),
          revenue,
        };
      })
    );

    const filtered = status === "all"
      ? withMetrics
      : withMetrics.filter((d) => d.dealStatus === String(status).toLowerCase());

    const topPerformingDeals = [...withMetrics]
      .sort((a, b) => Number(b.revenue?.revenue || 0) - Number(a.revenue?.revenue || 0))
      .slice(0, 10);

    const totalDealRevenue = withMetrics.reduce(
      (sum, item) => sum + Number(item.revenue?.revenue || 0),
      0
    );

    const topProductMap = new Map();
    for (const item of withMetrics) {
      const key = String(item.productId?._id || item.productId || "");
      if (!key) continue;
      const existing = topProductMap.get(key) || {
        productId: item.productId?._id || item.productId,
        productName: item.productId?.name || "Unknown Product",
        revenue: 0,
        units: 0,
      };
      existing.revenue += Number(item.revenue?.revenue || 0);
      existing.units += Number(item.revenue?.units || 0);
      topProductMap.set(key, existing);
    }
    const topPerformingProducts = [...topProductMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const topFarmerMap = new Map();
    for (const item of withMetrics) {
      const key = String(item.farmerId?._id || item.farmerId || "");
      if (!key) continue;
      const existing = topFarmerMap.get(key) || {
        farmerId: item.farmerId?._id || item.farmerId,
        farmerName: item.farmerId?.name || "Unknown Farmer",
        revenue: 0,
        units: 0,
      };
      existing.revenue += Number(item.revenue?.revenue || 0);
      existing.units += Number(item.revenue?.units || 0);
      topFarmerMap.set(key, existing);
    }
    const topFarmersByDealSales = [...topFarmerMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return res.json({
      success: true,
      count: filtered.length,
      data: filtered,
      topPerformingDeals,
      analytics: {
        totalDealRevenue: Number(totalDealRevenue.toFixed(2)),
        topPerformingProducts,
        topFarmersByDealSales,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch admin deals" });
  }
};

export const disableDealByAdmin = async (req, res) => {
  try {
    const deal = await Deal.findById(req.params.id);
    if (!deal) {
      return res.status(404).json({ success: false, message: "Deal not found" });
    }

    deal.isEnabled = false;
    deal.disabledBy = "admin";
    deal.disabledReason = req.body?.reason || "Disabled by admin moderation";
    await deal.save();

    return res.json({ success: true, message: "Deal disabled", data: deal });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to disable deal" });
  }
};

export const getPublicActiveDeals = async (req, res) => {
  try {
    await disableExpiredDeals();
    const now = new Date();

    const approvedFarmerIds = await User.find({
      role: "farmer",
      accountStatus: { $in: ["approved"] },
    }).distinct("_id");

    const deals = await Deal.find({
      isEnabled: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .populate({
        path: "productId",
        select: "name images price unit isActive farmer category",
        populate: [
          { path: "farmer", select: "name accountStatus kyc verified_badge verification_status" },
          { path: "category", select: "name" },
        ],
      })
      .sort({ createdAt: -1 })
      .lean();

    const activeDeals = deals
      .filter(
        (deal) =>
          deal?.productId &&
          deal.productId.isActive === true &&
          approvedFarmerIds.some((id) => String(id) === String(deal.productId?.farmer?._id || deal.productId?.farmer))
      )
      .map((deal) => {
        const originalPrice = Number(deal.productId?.price || 0);
        const discountedPrice = computeDealPrice({
          originalPrice,
          discountType: deal.discountType,
          discountValue: deal.discountValue,
        });
        if (discountedPrice === null) return null;
        return {
          ...deal.productId,
          pricing: {
            originalPrice,
            finalPrice: discountedPrice,
            hasDeal: true,
          },
          activeDeal: {
            _id: deal._id,
            discountType: deal.discountType,
            discountValue: deal.discountValue,
            startDate: deal.startDate,
            endDate: deal.endDate,
            badge: "🔥 Limited Time Deal",
            originalPrice,
            discountedPrice,
          },
        };
      })
      .filter(Boolean);

    return res.json({ success: true, count: activeDeals.length, data: activeDeals });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || "Failed to fetch active deals" });
  }
};
