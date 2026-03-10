import Order from "../models/OrderModel.js";
import MainOrder from "../models/MainOrderModel.js";
import OrderItem from "../models/OrderItemModel.js";
import mongoose from "mongoose";
import Product from "../models/ProductModel.js";
import User from "../models/UserModel.js";
import Category from "../models/CategoryModel.js";

const buildDateMatch = (from, to) => {
  if (!from && !to) return null;
  const createdAt = {};
  if (from) createdAt.$gte = new Date(from);
  if (to) createdAt.$lte = new Date(to);
  return createdAt;
};

const clampInt = (value, min, max, fallback) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const resolveTopMetric = (value) => {
  const v = String(value || "revenue").toLowerCase();
  if (v === "orders") return "orders";
  if (v === "quantity") return "quantity";
  return "revenue";
};

const resolveSortOrder = (value) => {
  const v = String(value || "desc").toLowerCase();
  return v === "asc" ? "asc" : "desc";
};

const buildDateRangeFromQuery = (query = {}) => {
  const now = new Date();
  const range = String(query.range || "30d").toLowerCase();
  const setEndOfDay = (d) => {
    const out = new Date(d);
    out.setHours(23, 59, 59, 999);
    return out;
  };

  if (range === "custom") {
    const from = query.from ? new Date(query.from) : null;
    const to = query.to ? setEndOfDay(query.to) : null;
    if (from && Number.isNaN(from.getTime())) {
      throw new Error("Invalid custom from date");
    }
    if (to && Number.isNaN(to.getTime())) {
      throw new Error("Invalid custom to date");
    }
    return {
      range: "custom",
      from,
      to,
      label:
        from && to
          ? `${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`
          : "Custom Range",
    };
  }

  const days = range === "7d" ? 7 : 30;
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    range: `${days}d`,
    from,
    to: now,
    label: days === 7 ? "Last 7 Days" : "Last 30 Days",
  };
};

const getMatchingProductFilters = async ({ categoryId = "", farmerId = "", search = "" }) => {
  const q = {};
  if (categoryId) q.category = categoryId;
  if (farmerId) q.farmer = farmerId;
  if (String(search || "").trim()) {
    q.name = { $regex: String(search).trim(), $options: "i" };
  }

  if (!Object.keys(q).length) {
    return {
      productIdSet: null,
      productMetaMap: null,
    };
  }

  const products = await Product.find(q).select("_id name category farmer").lean();
  const productIdSet = new Set(products.map((p) => String(p._id)));
  const productMetaMap = new Map(
    products.map((p) => [
      String(p._id),
      {
        productName: p.name || "",
        categoryId: p.category ? String(p.category) : "",
        farmerId: p.farmer ? String(p.farmer) : "",
      },
    ])
  );
  return { productIdSet, productMetaMap };
};

const toObjectIdList = (idSet) =>
  Array.from(idSet || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

const aggregateProductPerformance = async ({
  from,
  to,
  productIdSet = null,
  productMetaMap = null,
}) => {
  const regularMatch = {
    status: { $in: ["delivered", "completed"] },
  };
  if (from || to) {
    regularMatch.createdAt = {};
    if (from) regularMatch.createdAt.$gte = from;
    if (to) regularMatch.createdAt.$lte = to;
  }

  const splitMainMatch = {
    paymentStatus: "paid",
    orderStatus: "delivered",
  };
  const scopedProductIds = productIdSet ? toObjectIdList(productIdSet) : null;
  if (from || to) {
    splitMainMatch.createdAt = {};
    if (from) splitMainMatch.createdAt.$gte = from;
    if (to) splitMainMatch.createdAt.$lte = to;
  }

  const splitOrderIds = await MainOrder.find(splitMainMatch).distinct("_id");
  if (!splitOrderIds.length) {
    const [regularOnly] = await Promise.all([
      Order.aggregate([
        { $match: regularMatch },
        { $unwind: "$items" },
        ...(productIdSet
          ? [{ $match: { "items.product": { $in: scopedProductIds } } }]
          : []),
        {
          $group: {
            _id: "$items.product",
            quantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
            revenue: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$items.quantity", 0] },
                  { $ifNull: ["$items.price", 0] },
                ],
              },
            },
            orderIds: { $addToSet: "$_id" },
            farmerIds: { $addToSet: "$items.farmer" },
          },
        },
        {
          $project: {
            quantity: 1,
            revenue: 1,
            orders: { $size: "$orderIds" },
            farmerIds: 1,
          },
        },
      ]),
    ]);

    const merged = new Map();
    for (const row of regularOnly) {
      const key = String(row._id);
      merged.set(key, {
        productId: key,
        quantity: Number(row.quantity || 0),
        revenue: Number(row.revenue || 0),
        orders: Number(row.orders || 0),
        farmerIds: (row.farmerIds || []).map((id) => String(id)),
      });
    }

    return mergeProductMeta(merged, productMetaMap);
  }

  const [regularData, splitData] = await Promise.all([
    Order.aggregate([
      { $match: regularMatch },
      { $unwind: "$items" },
      ...(productIdSet
        ? [{ $match: { "items.product": { $in: scopedProductIds } } }]
        : []),
      {
        $group: {
          _id: "$items.product",
          quantity: { $sum: { $ifNull: ["$items.quantity", 0] } },
          revenue: {
            $sum: {
              $multiply: [
                { $ifNull: ["$items.quantity", 0] },
                { $ifNull: ["$items.price", 0] },
              ],
            },
          },
          orderIds: { $addToSet: "$_id" },
          farmerIds: { $addToSet: "$items.farmer" },
        },
      },
      {
        $project: {
          quantity: 1,
          revenue: 1,
          orders: { $size: "$orderIds" },
          farmerIds: 1,
        },
      },
    ]),
    OrderItem.aggregate([
      { $match: { orderId: { $in: splitOrderIds } } },
      ...(productIdSet
        ? [{ $match: { productId: { $in: scopedProductIds } } }]
        : []),
      {
        $group: {
          _id: "$productId",
          quantity: { $sum: { $ifNull: ["$quantity", 0] } },
          revenue: { $sum: { $ifNull: ["$total", 0] } },
          orderIds: { $addToSet: "$orderId" },
          farmerIds: { $addToSet: "$farmerId" },
        },
      },
      {
        $project: {
          quantity: 1,
          revenue: 1,
          orders: { $size: "$orderIds" },
          farmerIds: 1,
        },
      },
    ]),
  ]);

  const merged = new Map();
  const upsert = (row) => {
    const key = String(row._id);
    const prev = merged.get(key) || {
      productId: key,
      quantity: 0,
      revenue: 0,
      orders: 0,
      farmerIds: [],
    };
    prev.quantity += Number(row.quantity || 0);
    prev.revenue += Number(row.revenue || 0);
    prev.orders += Number(row.orders || 0);
    prev.farmerIds = Array.from(
      new Set([
        ...prev.farmerIds,
        ...((row.farmerIds || []).filter(Boolean).map((id) => String(id))),
      ])
    );
    merged.set(key, prev);
  };

  regularData.forEach(upsert);
  splitData.forEach(upsert);
  return mergeProductMeta(merged, productMetaMap);
};

const mergeProductMeta = async (mergedMap, productMetaMap = null) => {
  const productIds = Array.from(mergedMap.keys());
  if (!productIds.length) return [];

  let productDetails = [];
  if (productMetaMap) {
    productDetails = productIds.map((id) => ({
      _id: id,
      name: productMetaMap.get(id)?.productName || "",
      category: productMetaMap.get(id)?.categoryId || null,
      farmer: productMetaMap.get(id)?.farmerId || null,
    }));
  } else {
    productDetails = await Product.find({ _id: { $in: productIds } })
      .select("_id name category farmer")
      .lean();
  }

  const detailMap = new Map(
    productDetails.map((p) => [
      String(p._id),
      {
        productName: p.name || "Unknown Product",
        categoryId: p.category ? String(p.category) : "",
        farmerId: p.farmer ? String(p.farmer) : "",
      },
    ])
  );

  return productIds
    .map((id) => {
      const metric = mergedMap.get(id);
      const meta = detailMap.get(id) || {};
      return {
        productId: id,
        productName: meta.productName || "Unknown Product",
        categoryId: meta.categoryId || "",
        farmerId: meta.farmerId || metric.farmerIds?.[0] || "",
        orders: Number(metric.orders || 0),
        quantity: Number(metric.quantity || 0),
        revenue: Number(metric.revenue || 0),
      };
    })
    .filter((row) => row.productName);
};

const buildTopProductsPayload = async ({
  limit,
  metric,
  range,
  from,
  to,
  categoryId,
  farmerId,
  search,
  page,
  sortBy,
  sortOrder,
}) => {
  const resolvedMetric = resolveTopMetric(metric || sortBy);
  const resolvedLimit = clampInt(limit, 1, 50, 5);
  const resolvedPage = clampInt(page, 1, 5000, 1);
  const resolvedSortOrder = resolveSortOrder(sortOrder);
  const { from: rangeFrom, to: rangeTo, range: rangeKey, label } = buildDateRangeFromQuery({
    range,
    from,
    to,
  });

  const { productIdSet, productMetaMap } = await getMatchingProductFilters({
    categoryId: String(categoryId || "").trim(),
    farmerId: String(farmerId || "").trim(),
    search: String(search || "").trim(),
  });

  const aggregated = await aggregateProductPerformance({
    from: rangeFrom,
    to: rangeTo,
    productIdSet,
    productMetaMap,
  });

  const sorted = aggregated.sort((a, b) => {
    const diff = Number(a[resolvedMetric] || 0) - Number(b[resolvedMetric] || 0);
    if (diff === 0) return String(a.productName || "").localeCompare(String(b.productName || ""));
    return resolvedSortOrder === "asc" ? diff : -diff;
  });

  const total = sorted.length;
  const skip = (resolvedPage - 1) * resolvedLimit;
  const paged = sorted.slice(skip, skip + resolvedLimit);

  return {
    data: paged,
    meta: {
      metric: resolvedMetric,
      range: rangeKey,
      from: rangeFrom,
      to: rangeTo,
      rangeLabel: label,
      completedOnly: true,
      total,
      page: resolvedPage,
      limit: resolvedLimit,
      hasMore: skip + resolvedLimit < total,
    },
  };
};

// GET /api/admin/analytics/sales
export const getSalesOverview = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateMatch = buildDateMatch(from, to);

    const regularMatch = {
      paymentStatus: "paid",
      ...(dateMatch ? { createdAt: dateMatch } : {}),
    };
    const splitMatch = {
      paymentStatus: "paid",
      ...(dateMatch ? { createdAt: dateMatch } : {}),
    };

    const [regularSummary, splitSummary, subscriptionRegularCount, subscriptionSplitCount] = await Promise.all([
      Order.aggregate([
        { $match: regularMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      MainOrder.aggregate([
        { $match: splitMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      Order.countDocuments({
        isSubscriptionOrder: true,
        ...(dateMatch ? { createdAt: dateMatch } : {}),
      }),
      MainOrder.countDocuments({
        orderType: "subscription",
        ...(dateMatch ? { createdAt: dateMatch } : {}),
      }),
    ]);

    const reg = regularSummary[0] || { totalRevenue: 0, ordersCount: 0 };
    const split = splitSummary[0] || { totalRevenue: 0, ordersCount: 0 };

    return res.json({
      success: true,
      data: {
        totalRevenue: Number(reg.totalRevenue || 0) + Number(split.totalRevenue || 0),
        ordersCount: Number(reg.ordersCount || 0) + Number(split.ordersCount || 0),
        regularOrdersCount: Number(reg.ordersCount || 0),
        splitOrdersCount: Number(split.ordersCount || 0),
        subscriptionOrdersCount:
          Number(subscriptionRegularCount || 0) + Number(subscriptionSplitCount || 0),
      },
    });
  } catch (error) {
    console.error("Admin sales overview error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load sales overview" });
  }
};

// GET /api/admin/analytics/top-products
export const getTopProducts = async (req, res) => {
  try {
    const payload = await buildTopProductsPayload({
      limit: req.query.limit || 5,
      metric: req.query.metric || "revenue",
      range: req.query.range || "30d",
      from: req.query.from,
      to: req.query.to,
      categoryId: req.query.categoryId,
      farmerId: req.query.farmerId,
      search: req.query.search,
      page: 1,
      sortBy: req.query.metric || "revenue",
      sortOrder: "desc",
    });

    const data = payload.data.map((row) => ({
      _id: row.productId,
      name: row.productName,
      ordersCount: row.orders,
      totalSold: row.quantity,
      totalRevenue: row.revenue,
      categoryId: row.categoryId,
      farmerId: row.farmerId,
    }));

    return res.json({
      success: true,
      data,
      meta: payload.meta,
    });
  } catch (error) {
    console.error("Admin top products error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load top products" });
  }
};

// GET /api/admin/analytics/products-table
export const getProductsAnalyticsTable = async (req, res) => {
  try {
    const payload = await buildTopProductsPayload({
      limit: req.query.limit || 20,
      metric: req.query.metric || req.query.sortBy || "revenue",
      range: req.query.range || "30d",
      from: req.query.from,
      to: req.query.to,
      categoryId: req.query.categoryId,
      farmerId: req.query.farmerId,
      search: req.query.search,
      page: req.query.page || 1,
      sortBy: req.query.sortBy || req.query.metric || "revenue",
      sortOrder: req.query.sortOrder || "desc",
    });

    const categoryIds = Array.from(
      new Set(payload.data.map((row) => row.categoryId).filter(Boolean))
    );
    const farmerIds = Array.from(new Set(payload.data.map((row) => row.farmerId).filter(Boolean)));
    const [categories, farmers] = await Promise.all([
      categoryIds.length
        ? Category.find({ _id: { $in: categoryIds } }).select("_id name").lean()
        : [],
      farmerIds.length ? User.find({ _id: { $in: farmerIds } }).select("_id name").lean() : [],
    ]);
    const categoryMap = new Map(categories.map((row) => [String(row._id), row.name]));
    const farmerMap = new Map(farmers.map((row) => [String(row._id), row.name]));

    return res.json({
      success: true,
      data: payload.data.map((row) => ({
        ...row,
        categoryName: categoryMap.get(String(row.categoryId)) || "",
        farmerName: farmerMap.get(String(row.farmerId)) || "",
      })),
      pagination: {
        page: payload.meta.page,
        limit: payload.meta.limit,
        total: payload.meta.total,
      },
      meta: payload.meta,
    });
  } catch (error) {
    console.error("Admin products analytics table error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load products analytics table" });
  }
};

// GET /api/admin/analytics/products-export
export const exportProductsAnalyticsCsv = async (req, res) => {
  try {
    const payload = await buildTopProductsPayload({
      limit: 10000,
      metric: req.query.metric || req.query.sortBy || "revenue",
      range: req.query.range || "30d",
      from: req.query.from,
      to: req.query.to,
      categoryId: req.query.categoryId,
      farmerId: req.query.farmerId,
      search: req.query.search,
      page: 1,
      sortBy: req.query.sortBy || req.query.metric || "revenue",
      sortOrder: req.query.sortOrder || "desc",
    });

    const categoryIds = Array.from(
      new Set(payload.data.map((row) => row.categoryId).filter(Boolean))
    );
    const farmerIds = Array.from(new Set(payload.data.map((row) => row.farmerId).filter(Boolean)));

    const [categories, farmers] = await Promise.all([
      categoryIds.length
        ? Category.find({ _id: { $in: categoryIds } }).select("_id name").lean()
        : [],
      farmerIds.length ? User.find({ _id: { $in: farmerIds } }).select("_id name").lean() : [],
    ]);

    const categoryMap = new Map(categories.map((row) => [String(row._id), row.name]));
    const farmerMap = new Map(farmers.map((row) => [String(row._id), row.name]));

    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "Product ID",
      "Product Name",
      "Category",
      "Farmer",
      "Orders",
      "Quantity",
      "Revenue",
    ];
    const lines = [headers.map(escapeCsv).join(",")];
    payload.data.forEach((row) => {
      lines.push(
        [
          row.productId,
          row.productName,
          categoryMap.get(String(row.categoryId)) || "",
          farmerMap.get(String(row.farmerId)) || "",
          Number(row.orders || 0),
          Number(row.quantity || 0),
          Number(row.revenue || 0).toFixed(2),
        ]
          .map(escapeCsv)
          .join(",")
      );
    });

    const filename = `product-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(lines.join("\n"));
  } catch (error) {
    console.error("Admin products analytics export error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to export products analytics CSV" });
  }
};

// GET /api/admin/analytics/monthly-revenue
export const getMonthlyRevenue = async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const [regularData, splitData] = await Promise.all([
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: { month: { $month: "$createdAt" } },
            totalRevenue: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
      MainOrder.aggregate([
        {
          $match: {
            createdAt: { $gte: start, $lt: end },
            paymentStatus: "paid",
          },
        },
        {
          $group: {
            _id: { month: { $month: "$createdAt" } },
            totalRevenue: { $sum: "$totalAmount" },
            ordersCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    const monthMap = new Map();
    [...regularData, ...splitData].forEach((row) => {
      const month = Number(row._id?.month || 0);
      if (!month) return;
      const prev = monthMap.get(month) || { _id: { month }, totalRevenue: 0, ordersCount: 0 };
      prev.totalRevenue += Number(row.totalRevenue || 0);
      prev.ordersCount += Number(row.ordersCount || 0);
      monthMap.set(month, prev);
    });

    const data = Array.from(monthMap.values()).sort((a, b) => a._id.month - b._id.month);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Admin monthly revenue error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load monthly revenue" });
  }
};
