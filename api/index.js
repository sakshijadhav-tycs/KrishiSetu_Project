import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import http from "http";
import Razorpay from "razorpay";
import cron from "node-cron";
import connectDB from "./config/db.js";
import { initializeSocket } from "./utils/socketHandler.js";

// Models Import
import Order from "./models/OrderModel.js";
import Subscription from "./models/SubscriptionModel.js";
import Product from "./models/ProductModel.js";
import Deal from "./models/DealModel.js";
import MainOrder from "./models/MainOrderModel.js";
import SubOrder from "./models/SubOrderModel.js";
import OrderItem from "./models/OrderItemModel.js";
import Settings from "./models/SettingsModel.js";

// Routes Import
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import farmerRoutes from "./routes/farmerRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import visitRoutes from "./routes/visitRoutes.js";
import stockRoutes from "./routes/stockRoutes.js";
import deliveryRoutes from "./routes/deliveryRoutes.js";
import complaintRoutes from "./routes/complaintRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import transparentOrderRoutes from "./routes/transparentOrderRoutes.js";
import dealRoutes from "./routes/dealRoutes.js";
import { runSettlementSweep } from "./modules/transparentOrders/services/transparentOrderService.js";
import { getAppliedDealForProduct } from "./utils/dealPricing.js";
import internalRoutes from "./routes/internalRoutes.js";
import { runRegularSettlementSweep } from "./services/settlementService.js";
import { initializeEmailTransport } from "./utils/sendEmail.js";
import { verifyToken } from "./utils/authMiddleware.js";
import {
  fetchRazorpayPayment,
  findOrderByRazorpayPaymentId,
  verifyRazorpaySignature,
} from "./services/razorpayVerificationService.js";
import { requestIdMiddleware, notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { responseEnvelopeMiddleware } from "./middleware/responseEnvelope.js";
import { validateRequest } from "./middleware/validateRequest.js";
import { paymentRateLimiter } from "./middleware/rateLimiter.js";
import {
  quickCheckoutBodySchema,
  quickPaymentVerificationBodySchema,
} from "./validators/paymentSchemas.js";
import { logError, logInfo, logWarn } from "./utils/safeLogger.js";
import { runMonitoredCronJob } from "./services/cronMonitoringService.js";

dotenv.config();
connectDB();
initializeEmailTransport();

const app = express();

// --- RAZORPAY INSTANCE ---
export const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 1. CORS Configuration
app.use(cors({
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

// 2. Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(requestIdMiddleware);
app.use(responseEnvelopeMiddleware);

// 3. Static Files
const __dirname = path.resolve();
app.use("/uploads/invoices", (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Direct invoice access is blocked. Use authenticated order invoice endpoint.",
  });
});
app.use("/uploads/receipts", (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Direct receipt access is blocked. Use authenticated order receipt endpoint.",
  });
});
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// --- 4. RAZORPAY PAYMENT ROUTES ---

app.get("/api/getkey", verifyToken, (req, res) => {
  res.status(200).json({
    success: true,
    message: "Razorpay key loaded",
    key: process.env.RAZORPAY_KEY_ID,
    data: {
      key: process.env.RAZORPAY_KEY_ID,
    },
  });
});

app.post(
  "/api/checkout",
  verifyToken,
  paymentRateLimiter,
  validateRequest({ body: quickCheckoutBodySchema }),
  async (req, res) => {
  try {
    if (req.user?.role !== "consumer" && req.user?.role !== "user") {
      return res.status(403).json({ success: false, message: "Only consumers can create payment orders" });
    }
    const options = {
      amount: Number(req.body.amount * 100),
      currency: "INR",
    };
    const order = await razorpayInstance.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ✅ Payment Verification & Database Storage
app.post(
  "/api/paymentverification",
  verifyToken,
  paymentRateLimiter,
  validateRequest({ body: quickPaymentVerificationBodySchema }),
  async (req, res) => {
  try {
    if (req.user?.role !== "consumer" && req.user?.role !== "user") {
      return res.status(403).json({ success: false, message: "Only consumers can verify payments" });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // 1. Verify Signature
    const isAuthentic = verifyRazorpaySignature({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    });

    if (isAuthentic) {
      const existingOrder = await findOrderByRazorpayPaymentId(razorpay_payment_id).select("_id");

      if (existingOrder) {
        return res.redirect(
          `${process.env.FRONTEND_URL || "http://localhost:5173"}/paymentsuccess?reference=${razorpay_payment_id}`
        );
      }

      // 2. Razorpay API se 'notes' fetch karein (Safety check ke sath)
      const paymentInfo = await fetchRazorpayPayment(razorpay_payment_id);

      // Notes validation (undefined error fix)
      if (!paymentInfo.notes || !paymentInfo.notes.items || !paymentInfo.notes.addressData) {
        return res.status(400).json({
          success: false,
          message: "Payment notes are missing. Check frontend data mapping."
        });
      }

      const { consumerId, farmerId, items, amount, addressData } = paymentInfo.notes;

      // 3. MongoDB mein Order create karein taaki History mein dikhe
      await Order.create({
        consumer: consumerId,
        farmer: farmerId,
        items: JSON.parse(items),
        totalAmount: Number(amount),
        orderType: "delivery",
        status: "accepted", // History mein Accepted dikhane ke liye
        deliveryDetails: {
          address: JSON.parse(addressData)
        },
        paymentMethod: "razorpay",
        paymentStatus: "paid",
        razorpay_order_id: razorpay_order_id,
        razorpay_payment_id: razorpay_payment_id,
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpay_signature: razorpay_signature
      });

      // 4. Success Page redirect
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}/paymentsuccess?reference=${razorpay_payment_id}`);
    } else {
      res.status(400).json({ success: false, message: "Invalid Signature" });
    }
  } catch (error) {
    logError("PAYMENT_VERIFICATION_HANDLER_ERROR", { message: error.message });
    res.status(500).json({ success: false, message: "Error processing payment or saving order." });
  }
});

// --- 5. API ROUTES REGISTRATION ---
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/products", productRoutes);
app.use("/api/farmer", farmerRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/visits", visitRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/delivery", deliveryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/transparent-orders", transparentOrderRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/internal", internalRoutes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "🚀 KrishiSetu API is running perfectly!" });
});

app.use(notFoundHandler);

app.use(errorHandler);

// --- 6. CRON JOB: Auto-create orders for due subscriptions ---
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const buildTrackingId = (orderLike) => {
  const seed = String(orderLike?._id || `${Date.now()}`);
  return `KS-SPLIT-${seed.slice(-8).toUpperCase()}`;
};

cron.schedule("0 2 * * *", async () => {
  try {
    await runMonitoredCronJob({
      jobName: "subscription_order_generation",
      source: "cron:daily_0200",
      run: async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const settings = await Settings.findOne().lean();
        const commissionPercent =
          Number(settings?.defaultCommissionPercent) > 0
            ? Number(settings.defaultCommissionPercent)
            : 10;
        const gstPercent = 5;
        const deliveryCharge = 50;

        await Deal.updateMany(
          { isEnabled: true, endDate: { $lt: today } },
          { $set: { isEnabled: false, disabledBy: "system", disabledReason: "Deal expired" } }
        );

        const dueSubs = await Subscription.find({
          $or: [{ status: "active" }, { isActive: true }],
          nextDeliveryDate: { $lte: today },
        }).populate("productId");

        for (const sub of dueSubs) {
          const product = sub.productId;
          if (!product) continue;

          const qty = Number(sub.quantity || 1);
          const availableStock =
            product.countInStock || product.quantityAvailable || 0;
          if (availableStock < qty) continue;

          // Reduce stock safely
          if (product.countInStock !== undefined) {
            product.countInStock -= qty;
          }
          if (product.quantityAvailable !== undefined) {
            product.quantityAvailable -= qty;
          }
          await product.save();

          const activeDeal = await getAppliedDealForProduct(product, today);
          const unitPrice = Number(activeDeal?.discountedPrice ?? product.price);

          const productSubtotal = round2(unitPrice * qty);
          const commissionAmount = round2((productSubtotal * commissionPercent) / 100);
          const gstAmount = round2((productSubtotal * gstPercent) / 100);
          const totalAmount = round2(productSubtotal + gstAmount + deliveryCharge);
          const payoutAmount = round2(productSubtotal - commissionAmount);

          const mainOrder = await MainOrder.create({
            customerId: sub.customerId,
            productSubtotal,
            gstAmount,
            deliveryCharge,
            platformCommissionAmount: commissionAmount,
            totalAmount,
            paymentMethod: "cod",
            orderType: "subscription",
            purchaseMode: "Subscription",
            paymentStatus: "pending",
            orderStatus: "pending",
            status: "pending",
            commissionPercentApplied: commissionPercent,
            gstPercentApplied: gstPercent,
            notes: "Auto-created from subscription",
            subscriptionId: sub._id,
            subscriptionIds: [sub._id],
          });
          mainOrder.trackingId = buildTrackingId(mainOrder);
          await mainOrder.save();

          await SubOrder.create({
            orderId: mainOrder._id,
            farmerId: sub.farmerId || product.farmer,
            subtotal: productSubtotal,
            productSubtotal,
            commissionAmount,
            payoutAmount,
            gstShare: gstAmount,
            deliveryShare: deliveryCharge,
            payoutStatus: "Pending",
            fulfillmentStatus: "Pending",
          });

          await OrderItem.create({
            orderId: mainOrder._id,
            farmerId: sub.farmerId || product.farmer,
            productId: product._id,
            productName: product.name,
            quantity: qty,
            price: unitPrice,
            total: productSubtotal,
          });

          sub.lastOrderDate = new Date();
          const intervalDays =
            sub.frequency === "daily" ? 1 : sub.frequency === "weekly" ? 7 : 30;
          sub.nextDeliveryDate = addDays(sub.nextDeliveryDate || today, intervalDays);
          sub.nextOrderDate = sub.nextDeliveryDate;
          if (sub.endDate && new Date(sub.nextDeliveryDate) > new Date(sub.endDate)) {
            sub.status = "cancelled";
            sub.isActive = false;
          }
          await sub.save();
        }

        return {
          dueSubscriptions: dueSubs.length,
        };
      },
      metadataFromResult: (result) => result || null,
    });
  } catch (err) {
    logError("SUBSCRIPTION_CRON_ERROR", { message: err.message });
  }
});

// Transparent settlement sweep: runs daily for automatic eligible/transfer updates.
cron.schedule("30 2 * * *", async () => {
  try {
    const result = await runMonitoredCronJob({
      jobName: "settlement_daily_sweep",
      source: "cron:daily_0230",
      run: async () => {
        const transparent = await runSettlementSweep({ source: "cron:daily_0230" });
        const regular = await runRegularSettlementSweep(new Date(), {
          source: "cron:daily_0230",
        });
        return { transparent, regular };
      },
      metadataFromResult: (payload) => ({
        transparent: payload?.transparent
          ? {
              scanned: payload.transparent.scanned || 0,
              promoted: payload.transparent.promoted || 0,
              transferred: payload.transparent.transferred || 0,
              overdueEligibleCount: payload.transparent.overdueEligibleCount || 0,
            }
          : null,
        regular: payload?.regular
          ? {
              scanned: payload.regular.scanned || 0,
              promoted: payload.regular.promoted || 0,
              transferred: payload.regular.transferred || 0,
              overdueEligibleCount: payload.regular.overdueEligibleCount || 0,
            }
          : null,
      }),
    });

    logInfo(
      `[transparent-settlement-sweep] scanned=${result.transparent.scanned} updated=${result.transparent.updated}`
    );
    logInfo(
      `[regular-payout-sweep] scanned=${result.regular.scanned} eligible=${result.regular.promoted} transferred=${result.regular.transferred}`
    );
  } catch (err) {
    logError("SETTLEMENT_DAILY_SWEEP_CRON_ERROR", { message: err.message });
  }
});

const BASE_PORT = Number(process.env.PORT) || 5000;
let currentPort = BASE_PORT;
const httpServer = http.createServer(app);
const socketIO = initializeSocket(httpServer);

// Export socketIO for use in controllers
export { socketIO };

const startServer = (port) => {
  currentPort = port;
  httpServer.listen(currentPort, () => {
    logInfo(`Server running on port ${currentPort}`);
    logInfo("Socket.IO ready for real-time connections");
  });
};

const logClockInfo = () => {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  logInfo(
    `[clock] nowUtc=${now.toISOString()} timezoneOffsetMinutes=${offsetMinutes}`
  );
};

const runSettlementCatchup = async (source = "unknown") => {
  const now = new Date();
  try {
    const [transparent, regular] = await Promise.all([
      runSettlementSweep({ source: `catchup:${source}` }),
      runRegularSettlementSweep(now, { source: `catchup:${source}` }),
    ]);

    logInfo(
      `[settlement-catchup:${source}] transparent scanned=${transparent.scanned || 0} updated=${transparent.updated || 0} transferred=${transparent.transferred || 0} overdueEligibleCount=${transparent.overdueEligibleCount || 0}`
    );
    logInfo(
      `[settlement-catchup:${source}] regular scanned=${regular.scanned || 0} eligible=${regular.promoted || 0} transferred=${regular.transferred || 0} overdueEligibleCount=${regular.overdueEligibleCount || 0}`
    );
  } catch (err) {
    logError("SETTLEMENT_CATCHUP_ERROR", { source, message: err.message });
  }
};

httpServer.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const nextPort = currentPort + 1;
    logWarn(`Port ${currentPort} is in use. Retrying on port ${nextPort}...`);
    setTimeout(() => startServer(nextPort), 300);
    return;
  }
  throw err;
});

startServer(BASE_PORT);

process.on("unhandledRejection", (err) => {
  logError("UNHANDLED_REJECTION", { message: err.message });
  httpServer.close(() => process.exit(1));
});

logClockInfo();
setTimeout(() => {
  runMonitoredCronJob({
    jobName: "settlement_catchup_startup",
    source: "startup",
    run: async () => runSettlementCatchup("startup"),
    metadataFromResult: () => null,
  }).catch((err) => {
    logError("SETTLEMENT_CATCHUP_STARTUP_ERROR", { message: err.message });
  });
}, 5000);

// Self-healing catch-up sweep to reduce missed-cron impact during restarts/downtime.
cron.schedule("*/10 * * * *", async () => {
  try {
    await runMonitoredCronJob({
      jobName: "settlement_catchup_10min",
      source: "cron:10min",
      run: async () => runSettlementCatchup("10min"),
      metadataFromResult: () => null,
    });
  } catch (err) {
    logError("SETTLEMENT_CATCHUP_10MIN_CRON_ERROR", { message: err.message });
  }
});
