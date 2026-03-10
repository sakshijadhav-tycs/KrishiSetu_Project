import Subscription from "../models/SubscriptionModel.js";
import Product from "../models/ProductModel.js";
import { sendSubscriptionCancellationEmail } from "../utils/sendEmail.js";

const addDays = (date, days = 0) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

// Create a subscription for a given product and frequency
export const createSubscription = async (req, res) => {
  try {
    const {
      productId,
      frequency,
      quantity = 1,
      startDate,
      durationDays = 30,
    } = req.body;

    if (!productId || !["daily", "weekly", "monthly"].includes(frequency)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid subscription data" });
    }
    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Quantity must be at least 1" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    const normalizedStartDate = startDate ? new Date(startDate) : new Date();
    if (Number.isNaN(normalizedStartDate.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid start date" });
    }
    const normalizedDuration = Number(durationDays) > 0 ? Number(durationDays) : 30;
    const endDate = addDays(normalizedStartDate, normalizedDuration);
    const nextDeliveryDate = new Date(normalizedStartDate);

    const existing = await Subscription.findOne({
      customerId: req.user._id,
      productId: product._id,
      status: { $in: ["active", "paused"] },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "Active or paused subscription already exists for this product",
      });
    }

    const subscription = await Subscription.create({
      consumer: req.user._id,
      farmer: product.farmer,
      product: product._id,
      customerId: req.user._id,
      farmerId: product.farmer,
      productId: product._id,
      quantity: Number(quantity),
      frequency,
      startDate: normalizedStartDate,
      endDate,
      durationDays: normalizedDuration,
      nextDeliveryDate,
      nextOrderDate: nextDeliveryDate,
      status: "active",
      isActive: true,
      cancelledAt: null,
    });

    res
      .status(201)
      .json({ success: true, message: "Subscription created", data: subscription });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// List current user's subscriptions
export const getMySubscriptions = async (req, res) => {
  try {
    const { status = "active" } = req.query;
    const query = { customerId: req.user._id };
    if (status === "active") query.$or = [{ status: "active" }, { isActive: true }];
    if (status === "paused") query.status = "paused";
    if (status === "cancelled") query.status = "cancelled";

    const subs = await Subscription.find(query)
      .populate("productId", "name images price unit")
      .populate("farmerId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, count: subs.length, data: subs });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

// Soft-cancel a subscription
export const cancelSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user._id,
    });
    if (!sub) {
      return res
        .status(404)
        .json({ success: false, message: "Subscription not found" });
    }

    sub.status = "cancelled";
    sub.isActive = false;
    sub.cancelledAt = new Date();
    await sub.save();

    if (req.user?.email) {
      sendSubscriptionCancellationEmail({
        subscription: sub,
        customerEmail: req.user.email,
        customerName: req.user?.name,
      }).catch(() => null);
    }

    res.json({
      success: true,
      message: "Subscription cancelled",
      data: sub,
      effectiveCancellationDate: sub.cancelledAt,
    });
  } catch (err) {
    res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
};

export const pauseSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user._id,
    });
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    if (sub.status !== "active") {
      return res.status(400).json({ success: false, message: "Only active subscription can be paused" });
    }

    sub.status = "paused";
    sub.isActive = false;
    sub.pauseReason = req.body?.reason || "";
    await sub.save();
    res.json({ success: true, message: "Subscription paused", data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const resumeSubscription = async (req, res) => {
  try {
    const sub = await Subscription.findOne({
      _id: req.params.id,
      customerId: req.user._id,
    });
    if (!sub) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    if (sub.status !== "paused") {
      return res.status(400).json({ success: false, message: "Only paused subscription can be resumed" });
    }

    const now = new Date();
    sub.status = "active";
    sub.isActive = true;
    sub.cancelledAt = null;
    sub.pauseReason = "";
    const nextByFrequency = addDays(
      now,
      sub.frequency === "daily" ? 1 : sub.frequency === "weekly" ? 7 : 30
    );
    sub.nextDeliveryDate = now > new Date(sub.nextDeliveryDate || now)
      ? nextByFrequency
      : sub.nextDeliveryDate;
    sub.nextOrderDate = sub.nextDeliveryDate;
    await sub.save();
    res.json({ success: true, message: "Subscription resumed", data: sub });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

export const getUpcomingDeliveries = async (req, res) => {
  try {
    const now = new Date();
    const upcoming = await Subscription.find({
      customerId: req.user._id,
      status: "active",
      nextDeliveryDate: { $gte: now },
    })
      .sort({ nextDeliveryDate: 1 })
      .populate("productId", "name images price unit")
      .populate("farmerId", "name");

    res.json({ success: true, count: upcoming.length, data: upcoming });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

