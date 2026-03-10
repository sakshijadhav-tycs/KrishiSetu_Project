import mongoose from "mongoose";
import Product from "../../../models/ProductModel.js";
import Settings from "../../../models/SettingsModel.js";
import MainOrder from "../../../models/MainOrderModel.js";
import SubOrder from "../../../models/SubOrderModel.js";
import OrderItem from "../../../models/OrderItemModel.js";
import CheckoutIntent from "../../../models/CheckoutIntentModel.js";

export const getPricingSettings = async () => {
  const settings = await Settings.findOne().lean();
  const configuredCommission = Number(settings?.defaultCommissionPercent);
  const commissionPercent =
    Number.isFinite(configuredCommission) && configuredCommission > 0
      ? configuredCommission
      : 10;
  return {
    commissionPercent,
    gstPercent: 5,
    deliveryCharge: 50,
    returnWindowDays: 3,
    autoSettlementDays: 2,
  };
};

export const findProductsByIds = async (productIds) => {
  return Product.find({ _id: { $in: productIds }, isActive: true })
    .select("name price quantityAvailable countInStock farmer isActive")
    .lean();
};

export const createCheckoutIntent = async (payload) => {
  return CheckoutIntent.create(payload);
};

export const getCheckoutIntentById = async (intentId) => {
  if (!mongoose.Types.ObjectId.isValid(intentId)) return null;
  return CheckoutIntent.findById(intentId);
};

export const getCheckoutIntentByRazorpayOrderId = async (razorpayOrderId) => {
  return CheckoutIntent.findOne({ razorpayOrderId });
};

export const markIntentPaid = async (intent, session) => {
  intent.status = "paid";
  await intent.save(session ? { session } : {});
};

export const markIntentProcessed = async (intent, mainOrderId, session) => {
  intent.processedMainOrderId = mainOrderId;
  await intent.save(session ? { session } : {});
};

export const createMainOrder = async (payload, session) => {
  const [doc] = await MainOrder.create([payload], session ? { session } : {});
  return doc;
};

export const createSubOrders = async (payloads, session) => {
  return SubOrder.insertMany(payloads, session ? { session } : {});
};

export const createOrderItems = async (payloads, session) => {
  return OrderItem.insertMany(payloads, session ? { session } : {});
};

export const reduceStockForItems = async (cartSnapshot, session) => {
  for (const item of cartSnapshot) {
    const productQuery = Product.findById(item.productId);
    if (session) {
      productQuery.session(session);
    }
    const product = await productQuery;
    if (!product) {
      throw new Error(`Product not found: ${item.productId}`);
    }
    const availableStock = Number(product.countInStock ?? product.quantityAvailable ?? 0);
    if (availableStock < item.quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    if (product.countInStock !== undefined) {
      product.countInStock -= item.quantity;
    }
    if (product.quantityAvailable !== undefined) {
      product.quantityAvailable -= item.quantity;
    }
    await product.save(session ? { session } : {});
  }
};

export const getMainOrderById = async (orderId) => {
  return MainOrder.findById(orderId).lean();
};

export const getCustomerMainOrders = async (customerId) => {
  return MainOrder.find({ customerId }).sort({ createdAt: -1 }).lean();
};

export const getSubOrdersByMainOrderId = async (orderId) => {
  return SubOrder.find({ orderId })
    .sort({ createdAt: -1 })
    .populate("farmerId", "name")
    .lean();
};

export const getOrderItemsByMainOrderId = async (orderId) => {
  return OrderItem.find({ orderId }).sort({ createdAt: 1 }).lean();
};

export const getFarmerSubOrders = async (farmerId, extraQuery = {}) => {
  const docs = await SubOrder.find({ farmerId, ...extraQuery })
    .sort({ createdAt: -1 })
    .populate("orderId", "orderType")
    .lean();

  const mainOrderIds = docs
    .map((doc) => doc?.orderId?._id || doc?.orderId)
    .filter(Boolean)
    .map((id) => id.toString());

  if (!mainOrderIds.length) return docs;

  const groupedCounts = await SubOrder.aggregate([
    { $match: { orderId: { $in: mainOrderIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$orderId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(groupedCounts.map((row) => [String(row._id), Number(row.count || 0)]));

  return docs.map((doc) => {
    const mainOrderId = String(doc?.orderId?._id || doc?.orderId || "");
    return {
      ...doc,
      mainOrderSubOrderCount: countMap.get(mainOrderId) || 0,
    };
  });
};

export const getSubOrderById = async (subOrderId) => {
  return SubOrder.findById(subOrderId);
};

export const saveSubOrder = async (subOrder, session = null) => {
  return subOrder.save(session ? { session } : {});
};

export const getAdminFinancialSummary = async () => {
  const [mainStats] = await MainOrder.aggregate([
    {
      $group: {
        _id: null,
        totalCommission: { $sum: "$platformCommissionAmount" },
        totalGst: { $sum: "$gstAmount" },
        totalDelivery: { $sum: "$deliveryCharge" },
        totalOrderValue: { $sum: "$totalAmount" },
      },
    },
  ]);

  const [subStats] = await SubOrder.aggregate([
    {
      $group: {
        _id: null,
        totalPayoutsPending: {
          $sum: {
            $cond: [{ $in: ["$payoutStatus", ["Pending", "Eligible"]] }, "$payoutAmount", 0],
          },
        },
        totalPayoutsTransferred: {
          $sum: {
            $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "$payoutAmount", 0],
          },
        },
      },
    },
  ]);

  return {
    totalCommission: Number(mainStats?.totalCommission || 0),
    totalGst: Number(mainStats?.totalGst || 0),
    totalDelivery: Number(mainStats?.totalDelivery || 0),
    totalOrderValue: Number(mainStats?.totalOrderValue || 0),
    totalPayoutsPending: Number(subStats?.totalPayoutsPending || 0),
    totalPayoutsTransferred: Number(subStats?.totalPayoutsTransferred || 0),
  };
};

export const getSubOrdersForSettlementSweep = async (now) => {
  return SubOrder.find({
    payoutStatus: { $in: ["Pending", "Eligible"] },
    fulfillmentStatus: "Delivered",
    $or: [{ returnWindowEndsAt: { $lte: now } }, { autoSettleAt: { $lte: now } }],
  });
};

export const getOverdueEligibleSubOrdersStats = async (now = new Date()) => {
  const [row] = await SubOrder.aggregate([
    {
      $match: {
        payoutStatus: "Eligible",
        fulfillmentStatus: "Delivered",
        autoSettleAt: { $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        amount: { $sum: "$payoutAmount" },
      },
    },
  ]);

  return {
    count: Number(row?.count || 0),
    amount: Number(row?.amount || 0),
  };
};
