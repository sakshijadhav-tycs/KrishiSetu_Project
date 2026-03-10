import mongoose from "mongoose";
import crypto from "crypto";
import { requireRazorpayInstance } from "../../../config/razorpay.js";
import MainOrder from "../../../models/MainOrderModel.js";
import User from "../../../models/UserModel.js";
import OrderItem from "../../../models/OrderItemModel.js";
import SubOrder from "../../../models/SubOrderModel.js";
import Subscription from "../../../models/SubscriptionModel.js";
import { generateTransparentInvoicePDF } from "../../../utils/pdfGenerator.js";
import {
  createCheckoutIntent,
  createMainOrder,
  createOrderItems,
  createSubOrders,
  findProductsByIds,
  getAdminFinancialSummary,
  getCheckoutIntentById,
  getCheckoutIntentByRazorpayOrderId,
  getCustomerMainOrders,
  getFarmerSubOrders,
  getMainOrderById,
  getOrderItemsByMainOrderId,
  getPricingSettings,
  getSubOrderById,
  getSubOrdersByMainOrderId,
  getOverdueEligibleSubOrdersStats,
  getSubOrdersForSettlementSweep,
  markIntentPaid,
  markIntentProcessed,
  reduceStockForItems,
  saveSubOrder,
} from "../repositories/transparentOrderRepository.js";
import { computeDealPrice, getActiveDealsByProductIds } from "../../../utils/dealPricing.js";
import { executeSettlementJob } from "../../../services/settlementReliabilityService.js";

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const toIso = (value) => {
  try {
    return new Date(value).toISOString();
  } catch {
    return "";
  }
};
const normalizePurchaseMode = (value) =>
  String(value || "").toLowerCase() === "subscription" ? "Subscription" : "OneTime";
const normalizePaymentMethod = (value) =>
  String(value || "").toLowerCase() === "razorpay" ? "razorpay" : "cod";
const normalizeStartOfDay = (value) => {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) throw new Error("Invalid subscription start date");
  d.setHours(0, 0, 0, 0);
  return d;
};
const isTodayOrPast = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() <= today.getTime();
};
const addDays = (date, days = 0) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const getIntervalDays = (frequency) =>
  frequency === "daily" ? 1 : frequency === "weekly" ? 7 : 30;

const buildTrackingId = (orderLike) => {
  const seed = String(orderLike?._id || `${Date.now()}`);
  return `KS-SPLIT-${seed.slice(-8).toUpperCase()}`;
};

const normalizeReturnRequest = (returnRequest = {}) => ({
  status: String(returnRequest?.status || "None"),
  reason: String(returnRequest?.reason || ""),
  requestedAt: returnRequest?.requestedAt || null,
  reviewedBy: String(returnRequest?.reviewedBy || ""),
  reviewedAt: returnRequest?.reviewedAt || null,
});

const getReturnMeta = (subOrder, now = new Date()) => {
  const returnRequest = normalizeReturnRequest(subOrder?.returnRequest);
  const delivered =
    String(subOrder?.fulfillmentStatus || "").trim().toLowerCase() === "delivered";
  const returnWindowEndsAt = subOrder?.returnWindowEndsAt
    ? new Date(subOrder.returnWindowEndsAt)
    : null;
  const returnWindowOpen =
    Boolean(returnWindowEndsAt) && returnWindowEndsAt.getTime() > now.getTime();
  const returnEligible =
    delivered &&
    returnWindowOpen &&
    returnRequest.status !== "Pending" &&
    returnRequest.status !== "Approved";

  return {
    returnRequest,
    returnEligible,
    returnWindowOpen,
    returnWindowEndsAt: subOrder?.returnWindowEndsAt || null,
  };
};

const validateAndBuildCartSnapshot = async (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    throw new Error("Cart items are required");
  }

  const productIds = cartItems.map((item) => item.productId);
  const products = await findProductsByIds(productIds);
  const productMap = new Map(products.map((p) => [String(p._id), p]));
  const activeDealsByProductId = await getActiveDealsByProductIds(productIds);

  const snapshot = [];
  for (const rawItem of cartItems) {
    const product = productMap.get(String(rawItem.productId));
    if (!product) {
      throw new Error(`Invalid product in cart: ${rawItem.productId}`);
    }
    const quantity = Number(rawItem.quantity || 0);
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error(`Invalid quantity for ${product.name}`);
    }
    const available = Number(product.countInStock ?? product.quantityAvailable ?? 0);
    if (available < quantity) {
      throw new Error(`Insufficient stock for ${product.name}`);
    }

    const activeDeal = activeDealsByProductId.get(String(product._id));
    const price = Number(
      computeDealPrice({
        originalPrice: product.price,
        discountType: activeDeal?.discountType,
        discountValue: activeDeal?.discountValue,
      }) ?? product.price ?? 0
    );
    const total = round2(price * quantity);
    snapshot.push({
      productId: product._id,
      farmerId: product.farmer,
      productName: product.name,
      quantity,
      price,
      total,
    });
  }

  return snapshot;
};

const calculatePricing = (cartSnapshot, settings) => {
  const productSubtotal = round2(
    cartSnapshot.reduce((sum, item) => sum + Number(item.total || 0), 0)
  );
  const commissionAmount = round2(
    (productSubtotal * Number(settings.commissionPercent || 0)) / 100
  );
  const gstAmount = round2(
    (productSubtotal * Number(settings.gstPercent || 0)) / 100
  );
  const deliveryCharge = round2(Number(settings.deliveryCharge || 0));
  const totalAmount = round2(productSubtotal + gstAmount + deliveryCharge);

  return {
    productSubtotal,
    gstAmount,
    deliveryCharge,
    commissionAmount,
    totalAmount,
    commissionPercent: Number(settings.commissionPercent || 0),
    gstPercent: Number(settings.gstPercent || 0),
  };
};

const groupByFarmer = (cartSnapshot) => {
  const map = new Map();
  for (const item of cartSnapshot) {
    const farmerKey = String(item.farmerId);
    if (!map.has(farmerKey)) {
      map.set(farmerKey, []);
    }
    map.get(farmerKey).push(item);
  }
  return map;
};

const computeSubOrderAmounts = (farmerItems, pricing) => {
  const subtotal = round2(farmerItems.reduce((sum, i) => sum + i.total, 0));
  const ratio = pricing.productSubtotal > 0 ? subtotal / pricing.productSubtotal : 0;
  const commissionAmount = round2((subtotal * pricing.commissionPercent) / 100);
  const payoutAmount = round2(subtotal - commissionAmount);
  const gstShare = round2(pricing.gstAmount * ratio);
  const deliveryShare = round2(pricing.deliveryCharge * ratio);
  return { subtotal, commissionAmount, payoutAmount, gstShare, deliveryShare };
};

const aggregateMainOrderStatus = (statuses = []) => {
  const clean = statuses.map((s) => String(s || "").trim());
  if (!clean.length) return "pending";
  const normalized = clean.map((status) =>
    status === "Returned" ? "Delivered" : status
  );

  const all = (value) => normalized.every((s) => s === value);
  const has = (value) => normalized.some((s) => s === value);

  if (all("Pending")) return "pending";
  if (all("Accepted")) return "confirmed";
  if (all("Delivered")) return "delivered";
  if (all("Cancelled")) return "cancelled";

  if (has("Delivered")) return "partially_delivered";
  if (has("Accepted")) return "partially_confirmed";
  if (has("Processing") || has("Shipped") || has("Out for Delivery")) return "processing";

  return "pending";
};

const isTransactionNotSupportedError = (error) => {
  const message = String(error?.message || "");
  return (
    error?.code === 20 ||
    error?.codeName === "IllegalOperation" ||
    message.includes("Transaction numbers are only allowed on a replica set member or mongos")
  );
};

const createMainAndSubOrdersFromSnapshot = async ({
  customerId,
  cartSnapshot,
  pricingSnapshot,
  purchaseMode = "OneTime",
  paymentMethod = "razorpay",
  orderType = "split",
  paymentStatus = "pending",
  orderStatus = "pending",
  notes = "",
  razorpay_order_id = "",
  razorpay_payment_id = "",
  razorpay_signature = "",
  subscriptionIds = [],
  session = null,
}) => {
  const groupedByFarmer = groupByFarmer(cartSnapshot);
  const resolvedOrderType =
    orderType === "subscription"
      ? "subscription"
      : groupedByFarmer.size > 1
        ? "split"
        : "single";

  const normalizedSubs = Array.isArray(subscriptionIds)
    ? subscriptionIds.filter(Boolean)
    : [];
  const primarySubscriptionId = normalizedSubs.length ? normalizedSubs[0] : null;

  const mainOrder = await createMainOrder(
    {
      customerId,
      productSubtotal: pricingSnapshot.productSubtotal,
      gstAmount: pricingSnapshot.gstAmount,
      deliveryCharge: pricingSnapshot.deliveryCharge,
      platformCommissionAmount: pricingSnapshot.commissionAmount,
      totalAmount: pricingSnapshot.totalAmount,
      paymentMethod,
      purchaseMode,
      orderType: resolvedOrderType,
      paymentStatus,
      orderStatus,
      status: orderStatus,
      razorpayOrderId: razorpay_order_id || undefined,
      razorpayPaymentId: razorpay_payment_id || undefined,
      razorpaySignature: razorpay_signature || undefined,
      commissionPercentApplied: pricingSnapshot.commissionPercent,
      gstPercentApplied: pricingSnapshot.gstPercent,
      notes,
      expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      subscriptionId: primarySubscriptionId,
      subscriptionIds: normalizedSubs,
    },
    session
  );
  mainOrder.trackingId = buildTrackingId(mainOrder);
  await mainOrder.save(session ? { session } : {});

  const subOrderPayloads = [];
  const orderItemPayloads = [];
  const settings = await getPricingSettings();

  for (const [farmerId, farmerItems] of groupedByFarmer.entries()) {
    const amounts = computeSubOrderAmounts(farmerItems, pricingSnapshot);
    const returnWindowEndsAt = new Date(
      Date.now() + settings.returnWindowDays * 24 * 60 * 60 * 1000
    );
    const autoSettleAt = new Date(
      returnWindowEndsAt.getTime() + settings.autoSettlementDays * 24 * 60 * 60 * 1000
    );

    subOrderPayloads.push({
      orderId: mainOrder._id,
      farmerId,
      subtotal: amounts.subtotal,
      commissionAmount: amounts.commissionAmount,
      payoutAmount: amounts.payoutAmount,
      gstShare: amounts.gstShare,
      deliveryShare: amounts.deliveryShare,
      payoutStatus: "Pending",
      fulfillmentStatus: "Pending",
      returnWindowEndsAt,
      autoSettleAt,
    });
  }

  const createdSubOrders = await createSubOrders(subOrderPayloads, session);
  const subOrderByFarmer = new Map(createdSubOrders.map((s) => [String(s.farmerId), s]));

  for (const item of cartSnapshot) {
    const linkedSubOrder = subOrderByFarmer.get(String(item.farmerId));
    orderItemPayloads.push({
      orderId: mainOrder._id,
      subOrderId: linkedSubOrder._id,
      farmerId: item.farmerId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      total: item.total,
    });
  }

  await createOrderItems(orderItemPayloads, session);

  return {
    mainOrderId: mainOrder._id,
    subOrdersCount: createdSubOrders.length,
    totals: {
      productSubtotal: mainOrder.productSubtotal,
      commission: mainOrder.platformCommissionAmount,
      gst: mainOrder.gstAmount,
      delivery: mainOrder.deliveryCharge,
      total: mainOrder.totalAmount,
    },
  };
};

const createSplitOrdersFromIntent = async ({
  intent,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  session = null,
}) => {
  await reduceStockForItems(intent.cartSnapshot, session);
  await markIntentPaid(intent, session);

  const purchaseMode = normalizePurchaseMode(intent.purchaseMode);
  const orderType = purchaseMode === "Subscription" ? "subscription" : "split";
  const subscriptionIds = intent.subscriptionIds || [];

  const payload = await createMainAndSubOrdersFromSnapshot({
    customerId: intent.customerId,
    cartSnapshot: intent.cartSnapshot,
    pricingSnapshot: intent.pricingSnapshot,
    purchaseMode,
    paymentMethod: "razorpay",
    orderType,
    paymentStatus: "paid",
    notes:
      purchaseMode === "Subscription"
        ? "Subscription first order (paid)"
        : "Transparent multi-vendor split order",
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    subscriptionIds,
    session,
  });

  await markIntentProcessed(intent, payload.mainOrderId, session);
  return payload;
};

const createSubscriptionsForCart = async ({
  customerId,
  cartSnapshot,
  frequency,
  startDate,
  durationDays = 30,
  session = null,
}) => {
  if (!["daily", "weekly", "monthly"].includes(String(frequency || "").toLowerCase())) {
    throw new Error("Invalid subscription frequency");
  }

  const existing = await Subscription.find({
    customerId,
    productId: { $in: cartSnapshot.map((item) => item.productId) },
    status: { $in: ["active", "paused"] },
  });
  if (existing.length) {
    throw new Error("Active or paused subscription already exists for one or more cart products");
  }

  const docs = cartSnapshot.map((item) => ({
    consumer: customerId,
    farmer: item.farmerId,
    product: item.productId,
    customerId,
    farmerId: item.farmerId,
    productId: item.productId,
    quantity: Number(item.quantity || 1),
    frequency: String(frequency).toLowerCase(),
    startDate,
    durationDays,
    endDate: addDays(startDate, Number(durationDays || 30)),
    nextDeliveryDate: new Date(startDate),
    nextOrderDate: new Date(startDate),
    status: "active",
    isActive: true,
    cancelledAt: null,
  }));

  return Subscription.insertMany(docs, session ? { session } : {});
};

const shiftNextDeliveryForProcessedSubscriptions = async (intent, session = null) => {
  const purchaseMode = normalizePurchaseMode(intent?.purchaseMode);
  if (purchaseMode !== "Subscription") return;

  const subscriptionIds = Array.isArray(intent?.subscriptionIds)
    ? intent.subscriptionIds.filter(Boolean)
    : [];
  if (!subscriptionIds.length) return;

  const frequency = String(intent?.subscriptionConfig?.frequency || "").toLowerCase();
  if (!["daily", "weekly", "monthly"].includes(frequency)) return;

  const baseDate = normalizeStartOfDay(intent?.subscriptionConfig?.startDate || new Date());
  const nextDate = addDays(baseDate, getIntervalDays(frequency));

  await Subscription.updateMany(
    { _id: { $in: subscriptionIds } },
    {
      $set: {
        lastOrderDate: new Date(),
        nextDeliveryDate: nextDate,
        nextOrderDate: nextDate,
      },
    },
    session ? { session } : {}
  );
};

export const createTransparentCheckoutOrder = async ({
  customerId,
  cartItems,
  shippingAddress,
  purchaseMode = "OneTime",
  paymentMethod = "razorpay",
  subscriptionConfig = {},
}) => {
  const settings = await getPricingSettings();
  const cartSnapshot = await validateAndBuildCartSnapshot(cartItems);
  const pricing = calculatePricing(cartSnapshot, settings);
  const normalizedMode = normalizePurchaseMode(purchaseMode);
  const normalizedPayment = normalizePaymentMethod(paymentMethod);

  if (normalizedMode === "Subscription") {
    const frequency = String(subscriptionConfig?.frequency || "").toLowerCase();
    const startDate = normalizeStartOfDay(subscriptionConfig?.startDate);
    const durationDays =
      Number(subscriptionConfig?.durationDays) > 0
        ? Number(subscriptionConfig.durationDays)
        : 30;

    const subscriptions = await createSubscriptionsForCart({
      customerId,
      cartSnapshot,
      frequency,
      startDate,
      durationDays,
    });
    const subscriptionIds = subscriptions.map((sub) => sub._id);

    if (!isTodayOrPast(startDate)) {
      return {
        requiresPayment: false,
        scheduled: true,
        purchaseMode: "Subscription",
        subscriptionsCreated: subscriptions.length,
        nextDeliveryDate: startDate,
        pricing,
      };
    }

    if (normalizedPayment !== "razorpay") {
      await reduceStockForItems(cartSnapshot, null);
      const orderPayload = await createMainAndSubOrdersFromSnapshot({
        customerId,
        cartSnapshot,
        pricingSnapshot: pricing,
        purchaseMode: "Subscription",
        paymentMethod: "cod",
        orderType: "subscription",
        paymentStatus: "pending",
        notes: "Subscription first order (COD)",
        subscriptionIds,
        session: null,
      });

      const nextDate = addDays(startDate, getIntervalDays(frequency));
      await Subscription.updateMany(
        { _id: { $in: subscriptionIds } },
        {
          $set: {
            lastOrderDate: new Date(),
            nextDeliveryDate: nextDate,
            nextOrderDate: nextDate,
          },
        }
      );

      return {
        requiresPayment: false,
        scheduled: false,
        purchaseMode: "Subscription",
        mainOrderId: orderPayload.mainOrderId,
        pricing,
        subscriptionsCreated: subscriptions.length,
      };
    }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const intent = await createCheckoutIntent({
    customerId,
    cartSnapshot,
    pricingSnapshot: pricing,
    shippingAddress: shippingAddress || {},
    purchaseMode: normalizedMode,
    paymentMethod: normalizedPayment,
    subscriptionConfig: {
      frequency,
      startDate,
      durationDays,
    },
    subscriptionIds,
    expiresAt,
  });

  const razorpayOrder = await requireRazorpayInstance().orders.create({
    amount: Math.round(pricing.totalAmount * 100),
    currency: "INR",
    receipt: `ts_${intent._id.toString().slice(-10)}`,
    notes: {
      intentId: intent._id.toString(),
      customerId: String(customerId),
      model: "transparent_order",
      purchaseMode: normalizedMode,
    },
  });

  intent.razorpayOrderId = razorpayOrder.id;
  await intent.save();

  return {
    intentId: intent._id,
    razorpayOrder,
    pricing,
    requiresPayment: true,
    purchaseMode: normalizedMode,
  };
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  const intent = await createCheckoutIntent({
    customerId,
    cartSnapshot,
    pricingSnapshot: pricing,
    shippingAddress: shippingAddress || {},
    purchaseMode: normalizedMode,
    paymentMethod: "razorpay",
    expiresAt,
  });

  const razorpayOrder = await requireRazorpayInstance().orders.create({
    amount: Math.round(pricing.totalAmount * 100),
    currency: "INR",
    receipt: `ts_${intent._id.toString().slice(-10)}`,
    notes: {
      intentId: intent._id.toString(),
      customerId: String(customerId),
      model: "transparent_order",
      purchaseMode: normalizedMode,
    },
  });

  intent.razorpayOrderId = razorpayOrder.id;
  await intent.save();

  return {
    intentId: intent._id,
    razorpayOrder,
    pricing,
    requiresPayment: true,
    purchaseMode: normalizedMode,
  };
};

export const verifyTransparentPaymentAndCreateOrders = async ({
  customerId,
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  intentId,
}) => {
  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new Error("Invalid Razorpay signature");
  }

  const payment = await requireRazorpayInstance().payments.fetch(razorpay_payment_id);
  const resolvedIntentId = intentId || payment?.notes?.intentId;
  if (!resolvedIntentId) {
    throw new Error("Checkout intent missing in payment notes");
  }

  let intent =
    (await getCheckoutIntentById(resolvedIntentId)) ||
    (await getCheckoutIntentByRazorpayOrderId(razorpay_order_id));
  if (!intent) {
    throw new Error("Checkout intent not found");
  }

  if (String(intent.customerId) !== String(customerId)) {
    throw new Error("Unauthorized payment verification");
  }

  if (intent.processedMainOrderId) {
    return {
      mainOrderId: intent.processedMainOrderId,
      alreadyProcessed: true,
    };
  }

  const paidAmountRupees = round2(Number(payment.amount || 0) / 100);
  if (round2(intent.pricingSnapshot.totalAmount) !== paidAmountRupees) {
    throw new Error("Payment amount mismatch");
  }

  let responsePayload = null;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      responsePayload = await createSplitOrdersFromIntent({
        intent,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        session,
      });
      await shiftNextDeliveryForProcessedSubscriptions(intent, session);
    });
  } catch (error) {
    if (!isTransactionNotSupportedError(error)) {
      throw error;
    }

    // Dev fallback: standalone MongoDB doesn't support multi-document transactions.
    const freshIntent = await getCheckoutIntentById(String(intent._id));
    if (freshIntent?.processedMainOrderId) {
      return {
        mainOrderId: freshIntent.processedMainOrderId,
        alreadyProcessed: true,
      };
    }

    responsePayload = await createSplitOrdersFromIntent({
      intent: freshIntent || intent,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      session: null,
    });
    await shiftNextDeliveryForProcessedSubscriptions(freshIntent || intent, null);
  } finally {
    await session.endSession();
  }

  return responsePayload;
};

const refreshSingleSubOrderStatus = async (subOrder, now = new Date()) => {
  let changed = false;
  let transition = "no_change";
  const returnRequestStatus = String(subOrder?.returnRequest?.status || "None");

  if (returnRequestStatus === "Pending" || returnRequestStatus === "Approved") {
    if (subOrder.payoutStatus !== "OnHold") {
      subOrder.payoutStatus = "OnHold";
      subOrder.settlementStatus = "OnHold";
      changed = true;
      transition = "on_hold_for_return";
    }
    if (changed) {
      await saveSubOrder(subOrder);
    }
    return {
      changed,
      transition,
      currentStatus: subOrder.payoutStatus,
    };
  }

  if (
    subOrder.fulfillmentStatus === "Delivered" &&
    subOrder.payoutStatus === "Pending" &&
    subOrder.returnWindowEndsAt &&
    new Date(subOrder.returnWindowEndsAt) <= now
  ) {
    subOrder.payoutStatus = "Eligible";
    changed = true;
    transition = "promoted_to_eligible";
  }

  if (
    subOrder.payoutStatus === "Eligible" &&
    subOrder.autoSettleAt &&
    new Date(subOrder.autoSettleAt) <= now
  ) {
    subOrder.payoutStatus = "Transferred";
    subOrder.payoutDate = now;
    subOrder.settlementTrigger = "auto";
    changed = true;
    transition = "transferred_auto";
  }

  if (changed) {
    await saveSubOrder(subOrder);
  }

  return {
    changed,
    transition,
    currentStatus: subOrder.payoutStatus,
  };
};

export const getTransparentOrderDetails = async ({ orderId, user }) => {
  const mainOrder = await getMainOrderById(orderId);
  if (!mainOrder) {
    throw new Error("Main order not found");
  }

  const isOwner = String(mainOrder.customerId) === String(user._id);
  const isAdmin = user.role === "admin";
  if (!isOwner && !isAdmin) {
    throw new Error("Unauthorized access");
  }

  const [subOrders, items] = await Promise.all([
    getSubOrdersByMainOrderId(orderId),
    getOrderItemsByMainOrderId(orderId),
  ]);
  const now = new Date();
  const enrichedSubOrders = subOrders.map((subOrder) => ({
    ...subOrder,
    ...getReturnMeta(subOrder, now),
  }));
  const returnSummary = {
    hasEligibleReturn: enrichedSubOrders.some((subOrder) => subOrder.returnEligible),
    hasPendingReturn: enrichedSubOrders.some(
      (subOrder) => subOrder.returnRequest.status === "Pending"
    ),
    hasApprovedReturn: enrichedSubOrders.some(
      (subOrder) => subOrder.returnRequest.status === "Approved"
    ),
    statuses: enrichedSubOrders.map((subOrder) => ({
      subOrderId: subOrder._id,
      farmerId: subOrder?.farmerId?._id || subOrder?.farmerId,
      returnRequest: subOrder.returnRequest,
      returnEligible: subOrder.returnEligible,
      returnWindowEndsAt: subOrder.returnWindowEndsAt,
    })),
  };
  return { mainOrder, subOrders: enrichedSubOrders, items, returnSummary };
};

export const getCustomerTransparentOrders = async (customerId) => {
  const orders = await getCustomerMainOrders(customerId);
  if (!orders.length) return [];

  const orderIds = orders.map((order) => order._id).filter(Boolean);
  const groupedCounts = await SubOrder.aggregate([
    { $match: { orderId: { $in: orderIds } } },
    { $group: { _id: "$orderId", count: { $sum: 1 } } },
  ]);
  const countMap = new Map(
    groupedCounts.map((row) => [String(row._id), Number(row.count || 0)])
  );
  const groupedReturns = await SubOrder.find({ orderId: { $in: orderIds } })
    .select("orderId fulfillmentStatus returnWindowEndsAt returnRequest")
    .lean();
  const returnMap = new Map();
  const now = new Date();
  groupedReturns.forEach((subOrder) => {
    const key = String(subOrder.orderId);
    const current = returnMap.get(key) || {
      hasEligibleReturn: false,
      returnStatus: "None",
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };
    const meta = getReturnMeta(subOrder, now);
    current.hasEligibleReturn = current.hasEligibleReturn || meta.returnEligible;
    if (meta.returnRequest.status === "Pending") current.pendingCount += 1;
    if (meta.returnRequest.status === "Approved") current.approvedCount += 1;
    if (meta.returnRequest.status === "Rejected") current.rejectedCount += 1;
    if (current.pendingCount > 0) {
      current.returnStatus = "Pending";
    } else if (current.approvedCount > 0) {
      current.returnStatus = "Approved";
    } else if (current.rejectedCount > 0) {
      current.returnStatus = "Rejected";
    }
    returnMap.set(key, current);
  });

  return orders.map((order) => {
    const subOrderCount = countMap.get(String(order._id)) || 0;
    const resolvedOrderType =
      order.orderType === "subscription"
        ? "subscription"
        : subOrderCount > 1
          ? "split"
          : "single";
    const returnInfo = returnMap.get(String(order._id)) || {
      hasEligibleReturn: false,
      returnStatus: "None",
      pendingCount: 0,
      approvedCount: 0,
      rejectedCount: 0,
    };
    return {
      ...order,
      subOrderCount,
      orderType: resolvedOrderType,
      returnInfo,
    };
  });
};

export const getFarmerTransparentSubOrders = async (farmerId, { paymentMethod = "all" } = {}) => {
  await runSettlementSweep({ source: "read:farmer_sub_orders" });
  const extraQuery = {};
  const normalizedPayment = String(paymentMethod).toLowerCase();
  if (normalizedPayment === "razorpay") {
    const ids = await MainOrder.find({ paymentMethod: "razorpay" }).distinct("_id");
    extraQuery.orderId = { $in: ids };
  } else if (normalizedPayment === "cod") {
    const ids = await MainOrder.find({ paymentMethod: { $in: ["cod", "cash"] } }).distinct("_id");
    extraQuery.orderId = { $in: ids };
  }
  const docs = await getFarmerSubOrders(farmerId, extraQuery);
  const now = new Date();
  return docs.map((doc) => ({
    ...doc,
    ...getReturnMeta(doc, now),
  }));
};

export const requestTransparentOrderReturn = async ({
  orderId,
  userId,
  reason,
}) => {
  const mainOrder = await getMainOrderById(orderId);
  if (!mainOrder) {
    throw new Error("Main order not found");
  }
  if (String(mainOrder.customerId) !== String(userId)) {
    throw new Error("Unauthorized return request");
  }

  const subOrders = await Promise.all(
    (await getSubOrdersByMainOrderId(orderId)).map((subOrder) => getSubOrderById(subOrder._id))
  );
  const now = new Date();
  const eligibleSubOrders = subOrders.filter((subOrder) => {
    const meta = getReturnMeta(subOrder, now);
    return meta.returnEligible;
  });

  if (!eligibleSubOrders.length) {
    throw new Error("No delivered items are eligible for return");
  }

  for (const subOrder of eligibleSubOrders) {
    subOrder.returnRequest = {
      status: "Pending",
      reason: String(reason || "").trim(),
      requestedAt: now,
      reviewedBy: "",
      reviewedAt: null,
    };
    subOrder.payoutStatus = "OnHold";
    subOrder.settlementStatus = "OnHold";
    await saveSubOrder(subOrder);
  }

  return {
    orderId: mainOrder._id,
    requestedCount: eligibleSubOrders.length,
    status: "Pending",
  };
};

export const reviewTransparentReturnRequest = async ({
  subOrderId,
  userId,
  decision,
}) => {
  const subOrder = await getSubOrderById(subOrderId);
  if (!subOrder) {
    throw new Error("Sub-order not found");
  }
  if (String(subOrder.farmerId) !== String(userId)) {
    throw new Error("Unauthorized return review");
  }
  if (String(subOrder?.returnRequest?.status || "None") !== "Pending") {
    throw new Error("No pending return request for this sub-order");
  }

  const normalizedDecision = String(decision || "").trim().toLowerCase();
  if (!["approved", "rejected"].includes(normalizedDecision)) {
    throw new Error("Invalid return decision");
  }

  const now = new Date();
  subOrder.returnRequest.status =
    normalizedDecision === "approved" ? "Approved" : "Rejected";
  subOrder.returnRequest.reviewedBy = "Farmer";
  subOrder.returnRequest.reviewedAt = now;

  if (normalizedDecision === "approved") {
    subOrder.fulfillmentStatus = "Returned";
    subOrder.orderStatus = "Returned";
    subOrder.payoutStatus = "OnHold";
    subOrder.settlementStatus = "OnHold";
  } else {
    subOrder.payoutStatus = "Pending";
    subOrder.settlementStatus = "Pending";
  }

  await saveSubOrder(subOrder);

  if (normalizedDecision === "rejected") {
    await refreshSingleSubOrderStatus(subOrder, now);
  }

  const orderId = subOrder.orderId;
  const siblingSubOrders = await getSubOrdersByMainOrderId(orderId);
  const statuses = siblingSubOrders.map((row) => row.fulfillmentStatus);
  const mainStatus = aggregateMainOrderStatus(statuses);
  await MainOrder.findByIdAndUpdate(orderId, {
    orderStatus: mainStatus,
    status: mainStatus,
  });

  return {
    ...subOrder.toObject(),
    ...getReturnMeta(subOrder, now),
  };
};

export const getTransparentReturnRequestsForAdmin = async () => {
  const docs = await SubOrder.find({
    "returnRequest.status": { $in: ["Pending", "Approved", "Rejected"] },
  })
    .sort({ "returnRequest.requestedAt": -1, createdAt: -1 })
    .populate("farmerId", "name email")
    .populate("orderId", "customerId totalAmount paymentStatus orderStatus status createdAt")
    .lean();

  const customerIds = [
    ...new Set(
      docs
        .map((doc) => doc?.orderId?.customerId)
        .filter(Boolean)
        .map((id) => String(id))
    ),
  ];
  const customers = await User.find({ _id: { $in: customerIds } })
    .select("name email")
    .lean();
  const customerMap = new Map(customers.map((customer) => [String(customer._id), customer]));

  return docs.map((doc) => ({
    ...doc,
    ...getReturnMeta(doc, new Date()),
    customer: customerMap.get(String(doc?.orderId?.customerId)) || null,
  }));
};

export const markSubOrderDelivered = async ({ subOrderId, userId }) => {
  return updateSubOrderFulfillmentStatus({
    subOrderId,
    userId,
    nextStatus: "Delivered",
  });
};

const SUB_ORDER_FLOW = {
  Pending: ["Accepted", "Cancelled"],
  Accepted: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Out for Delivery", "Delivered", "Cancelled"],
  "Out for Delivery": ["Delivered", "Cancelled"],
  Delivered: [],
  Cancelled: [],
  Returned: [],
};

export const updateSubOrderFulfillmentStatus = async ({
  subOrderId,
  userId,
  nextStatus,
  cancellationReason = "",
}) => {
  const subOrder = await getSubOrderById(subOrderId);
  if (!subOrder) {
    throw new Error("Sub-order not found");
  }
  if (String(subOrder.farmerId) !== String(userId)) {
    throw new Error("Unauthorized to update this sub-order");
  }

  const normalizedNext = String(nextStatus || "").trim();
  if (!Object.prototype.hasOwnProperty.call(SUB_ORDER_FLOW, normalizedNext)) {
    throw new Error("Invalid fulfillment status");
  }

  const current = subOrder.fulfillmentStatus || "Pending";
  if (current === normalizedNext) {
    return subOrder;
  }
  if (!(SUB_ORDER_FLOW[current] || []).includes(normalizedNext)) {
    throw new Error(`Invalid transition from ${current} to ${normalizedNext}`);
  }

  subOrder.fulfillmentStatus = normalizedNext;
  if (normalizedNext === "Delivered") {
    const settings = await getPricingSettings();
    const now = new Date();
    subOrder.deliveredAt = now;
    subOrder.returnWindowEndsAt = new Date(
      now.getTime() + settings.returnWindowDays * 24 * 60 * 60 * 1000
    );
    subOrder.autoSettleAt = new Date(
      subOrder.returnWindowEndsAt.getTime() +
        settings.autoSettlementDays * 24 * 60 * 60 * 1000
    );
  }
  if (normalizedNext === "Cancelled") {
    const reason = String(cancellationReason || "").trim();
    if (!reason) {
      throw new Error("Cancellation reason is required");
    }
    subOrder.payoutStatus = "OnHold";
    subOrder.cancellationReason = reason;
  }

  await saveSubOrder(subOrder);

  const orderId = subOrder.orderId;
  const siblingSubOrders = await getSubOrdersByMainOrderId(orderId);
  const statuses = siblingSubOrders.map((row) => row.fulfillmentStatus);
  const mainStatus = aggregateMainOrderStatus(statuses);

  await MainOrder.findByIdAndUpdate(orderId, {
    orderStatus: mainStatus,
    status: mainStatus,
  });
  return subOrder;
};

export const markSubOrderTransferred = async ({ subOrderId }) => {
  const subOrder = await getSubOrderById(subOrderId);
  if (!subOrder) {
    throw new Error("Sub-order not found");
  }
  if (subOrder.payoutStatus === "Transferred") {
    return subOrder;
  }

  subOrder.payoutStatus = "Transferred";
  subOrder.payoutDate = new Date();
  subOrder.settlementTrigger = "manual";
  await saveSubOrder(subOrder);
  return subOrder;
};

export const runSettlementSweep = async (options = {}) => {
  const source = String(options?.source || "service");
  return executeSettlementJob({
    jobName: "transparent_settlement_sweep",
    source,
    lockName: "transparent_settlement_sweep",
    ttlMs: 4 * 60 * 1000,
    run: async () => {
      const now = new Date();
      const candidates = await getSubOrdersForSettlementSweep(now);
      let updated = 0;
      let promoted = 0;
      let transferred = 0;
      let skipped = 0;
      const skippedReasons = {
        unchanged_after_scan: 0,
      };

      for (const subOrder of candidates) {
        const before = subOrder.payoutStatus;
        const result = await refreshSingleSubOrderStatus(subOrder, now);
        if (before !== subOrder.payoutStatus) {
          updated += 1;
        } else {
          skipped += 1;
          skippedReasons.unchanged_after_scan += 1;
        }

        if (result.transition === "promoted_to_eligible") promoted += 1;
        if (result.transition === "transferred_auto") transferred += 1;
      }

      const overdue = await getOverdueEligibleSubOrdersStats(now);
      const metadata = {
        nowUtc: toIso(now),
        timezoneOffsetMinutes: now.getTimezoneOffset(),
      };

      return {
        scanned: candidates.length,
        updated,
        promoted,
        transferred,
        skipped,
        skippedReasons,
        overdueEligibleCount: overdue.count,
        overdueEligibleAmount: overdue.amount,
        executedAt: now,
        metadata,
      };
    },
  });
};

export const getTransparentAdminSummary = async () => {
  await runSettlementSweep({ source: "read:transparent_admin_summary" });
  return getAdminFinancialSummary();
};

export const getTransparentInvoiceForDownload = async ({ orderId, user }) => {
  const mainOrder = await MainOrder.findById(orderId);
  if (!mainOrder) {
    throw new Error("Main order not found");
  }

  const isOwner = String(mainOrder.customerId) === String(user._id);
  const isAdmin = user.role === "admin";
  const isFarmer = Boolean(
    await SubOrder.exists({ orderId: mainOrder._id, farmerId: user._id })
  );
  if (!isOwner && !isAdmin && !isFarmer) {
    throw new Error("Unauthorized access");
  }

  if (!mainOrder.invoiceUrl) {
    const [customer, items, subOrders] = await Promise.all([
      User.findById(mainOrder.customerId).select("name email").lean(),
      OrderItem.find({ orderId: mainOrder._id }).sort({ createdAt: 1 }).lean(),
      SubOrder.find({ orderId: mainOrder._id }).populate("farmerId", "name").lean(),
    ]);

    const invoicePath = await generateTransparentInvoicePDF(
      mainOrder.toObject(),
      customer,
      items,
      subOrders
    );
    mainOrder.invoiceUrl = invoicePath;
    mainOrder.invoiceGeneratedAt = new Date();
    await mainOrder.save();
  }

  return {
    invoiceUrl: mainOrder.invoiceUrl,
    orderId: mainOrder._id,
  };
};
