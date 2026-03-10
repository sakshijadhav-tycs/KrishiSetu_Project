import nodemailer from "nodemailer";
import EmailLog from "../models/EmailLogModel.js";

const MAX_RETRIES = 3;
const APP_NAME = process.env.PLATFORM_NAME || "KrishiSetu";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const DEFAULT_FROM = process.env.MAIL_FROM || `"${APP_NAME}" <${process.env.MAIL_USER || "no-reply@krishisetu.local"}>`;

let cachedTransporter = null;

const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
};

const getTransporterConfig = () => {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = parseBool(process.env.SMTP_SECURE, smtpPort === 465);
  const smtpUser = process.env.SMTP_USER || process.env.MAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.MAIL_PASS;

  if (smtpHost) {
    return {
      host: smtpHost,
      port: Number.isFinite(smtpPort) ? smtpPort : 587,
      secure: smtpSecure,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      pool: true,
      maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 5),
      maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 100),
    };
  }

  return {
    service: process.env.SMTP_SERVICE || "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    pool: true,
  };
};

const getTransporter = () => {
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport(getTransporterConfig());
  }
  return cachedTransporter;
};

export const initializeEmailTransport = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log("EMAIL_TRANSPORT_READY");
  } catch (error) {
    console.error("EMAIL_TRANSPORT_ERROR:", error?.message || error);
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createOrReuseLog = async (options = {}) => {
  const dedupeKey = String(options.dedupeKey || "").trim();
  const payload = {
    to: options.email,
    subject: options.subject,
    eventType: options.eventType || "generic",
    entityType: options.entityType || "",
    entityId: options.entityId ? String(options.entityId) : "",
    dedupeKey,
    status: "queued",
  };

  if (!dedupeKey) {
    return EmailLog.create(payload);
  }

  const existing = await EmailLog.findOne({ dedupeKey });
  if (existing && existing.status === "sent") {
    return existing;
  }
  if (existing) {
    existing.to = payload.to;
    existing.subject = payload.subject;
    existing.eventType = payload.eventType;
    existing.entityType = payload.entityType;
    existing.entityId = payload.entityId;
    existing.status = "queued";
    existing.lastError = "";
    await existing.save();
    return existing;
  }
  return EmailLog.create(payload);
};

export const sendEmail = async (options) => {
  if (!options?.email || !options?.subject) {
    throw new Error("sendEmail requires both email and subject");
  }

  const log = await createOrReuseLog(options);
  if (log.status === "sent" && log.sentAt) {
    return { messageId: "deduped" };
  }

  const transporter = getTransporter();
  const mailOptions = {
    from: options.from || DEFAULT_FROM,
    to: options.email,
    subject: options.subject,
    text: options.message || `${APP_NAME} notification`,
    html: options.html,
    attachments: options.attachments || [],
  };

  let attempt = Number(log.attempts || 0);
  while (attempt < MAX_RETRIES) {
    try {
      attempt += 1;
      const info = await transporter.sendMail(mailOptions);
      log.status = "sent";
      log.sentAt = new Date();
      log.attempts = attempt;
      log.lastError = "";
      await log.save();
      return info;
    } catch (error) {
      log.status = "failed";
      log.attempts = attempt;
      log.lastError = error?.message || "Unknown email error";
      await log.save();
      if (attempt >= MAX_RETRIES) throw error;
      await sleep(500 * attempt);
    }
  }

  throw new Error("Email delivery failed");
};

export const sendEmailAsync = (options) => {
  setImmediate(async () => {
    try {
      await sendEmail(options);
    } catch (error) {
      console.error("ASYNC_EMAIL_ERROR:", error?.message || error);
    }
  });
};

const shortOrderId = (orderId) =>
  String(orderId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(-8);

const isTransparentOrderLike = (order = {}) =>
  Boolean(
    order?.customerId ||
      ["split", "single", "subscription"].includes(
        String(order?.orderType || "").toLowerCase()
      ) ||
      ["onetime", "subscription"].includes(
        String(order?.purchaseMode || "").toLowerCase()
      )
  );

const buildOrderUrl = (orderOrId) => {
  if (typeof orderOrId === "string") {
    return `${FRONTEND_URL}/orders/${orderOrId}`;
  }

  const orderId = orderOrId?._id || "";
  const suffix = isTransparentOrderLike(orderOrId) ? "?transparent=1" : "";
  return `${FRONTEND_URL}/orders/${orderId}${suffix}`;
};

export const sendWelcomeEmail = async ({ email, name, userId }) => {
  if (!email) return;
  await sendEmail({
    email,
    subject: `Welcome to ${APP_NAME}`,
    eventType: "welcome_email",
    entityType: "user",
    entityId: userId || "",
    dedupeKey: userId ? `welcome_email:${userId}` : "",
    message: `Welcome to ${APP_NAME}${name ? `, ${name}` : ""}. Your account has been created successfully.`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;max-width:640px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#166534;color:#fff;padding:16px 18px;">
          <h2 style="margin:0;">Welcome to ${APP_NAME}</h2>
        </div>
        <div style="padding:18px;color:#111827;line-height:1.6;">
          <p>Hi ${name || "there"},</p>
          <p>Your account has been created successfully.</p>
          <p>You can now explore products, place orders, and track deliveries with ease.</p>
        </div>
      </div>
    `,
  });
};

export const sendPaymentSuccessEmail = async ({ order, customer }) => {
  const email = customer?.email || order?.consumer?.email;
  if (!email || !order?._id) return;
  await sendEmail({
    email,
    subject: `${APP_NAME} - Payment Success #${shortOrderId(order._id)}`,
    eventType: "payment_success",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `payment_success:${order._id}`,
    message: `Your payment for order #${shortOrderId(order._id)} was successful.`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #dcfce7;border-radius:12px;">
        <h2 style="margin:0 0 8px 0;color:#15803d;">Payment Successful</h2>
        <p>Hi ${customer?.name || order?.consumer?.name || "Customer"},</p>
        <p>We have received your payment for order <strong>#${String(order._id).toUpperCase()}</strong>.</p>
        <p>Amount paid: <strong>Rs. ${Number(order.totalAmount || 0).toFixed(2)}</strong></p>
        <p>You can track your order here: <a href="${buildOrderUrl(order)}">${buildOrderUrl(order)}</a></p>
      </div>
    `,
  });
};

export const sendPaymentFailedEmail = async ({ order, customer, reason }) => {
  const email = customer?.email || order?.consumer?.email;
  if (!email || !order?._id) return;
  await sendEmail({
    email,
    subject: `${APP_NAME} - Payment Failed #${shortOrderId(order._id)}`,
    eventType: "payment_failed",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `payment_failed:${order._id}:${Date.now()}`,
    message: `Payment failed for order #${shortOrderId(order._id)}. ${reason ? `Reason: ${reason}` : "Please retry payment."}`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #fee2e2;border-radius:12px;">
        <h2 style="margin:0 0 8px 0;color:#b91c1c;">Payment Failed</h2>
        <p>Hi ${customer?.name || order?.consumer?.name || "Customer"},</p>
        <p>Your payment attempt for order <strong>#${String(order._id).toUpperCase()}</strong> could not be completed.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>Please retry payment from your orders page: <a href="${buildOrderUrl(order)}">${buildOrderUrl(order)}</a></p>
      </div>
    `,
  });
};

export const sendInvoiceDownloadNotification = async ({ order, customer }) => {
  const email = customer?.email || order?.consumer?.email;
  if (!email || !order?._id) return;
  await sendEmail({
    email,
    subject: `${APP_NAME} - Invoice Downloaded #${shortOrderId(order._id)}`,
    eventType: "invoice_downloaded",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `invoice_downloaded:${order._id}:${Date.now()}`,
    message: `Invoice downloaded for order #${shortOrderId(order._id)}.`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">
        <h3 style="margin:0 0 8px 0;color:#1f2937;">Invoice Download Alert</h3>
        <p>Invoice for order <strong>#${String(order._id).toUpperCase()}</strong> was downloaded successfully.</p>
        <p>If this was not done by you, contact support immediately.</p>
      </div>
    `,
  });
};

export const sendReceiptDownloadNotification = async ({ order, customer }) => {
  const email = customer?.email || order?.consumer?.email;
  if (!email || !order?._id) return;
  await sendEmail({
    email,
    subject: `${APP_NAME} - Receipt Downloaded #${shortOrderId(order._id)}`,
    eventType: "receipt_downloaded",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `receipt_downloaded:${order._id}:${Date.now()}`,
    message: `Payment receipt downloaded for order #${shortOrderId(order._id)}.`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">
        <h3 style="margin:0 0 8px 0;color:#1f2937;">Receipt Download Alert</h3>
        <p>Payment receipt for order <strong>#${String(order._id).toUpperCase()}</strong> was downloaded successfully.</p>
        <p>If this was not done by you, contact support immediately.</p>
      </div>
    `,
  });
};

export const sendPaymentReceiptEmail = async ({
  order,
  customer,
  attachmentPath = "",
  attachmentFilename = "",
}) => {
  const email = customer?.email || order?.consumer?.email;
  if (!email || !order?._id) return;

  const orderId = String(order._id).toUpperCase();
  const shortId = shortOrderId(order._id);
  const message = `Your payment for Order #${orderId} has been confirmed. Please find your payment receipt attached.`;

  await sendEmail({
    email,
    subject: `${APP_NAME} - Payment Receipt #${shortId}`,
    eventType: "payment_receipt",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `payment_receipt:${order._id}`,
    message,
    html: `
      <div style="font-family:Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;background:#ffffff;color:#111827;">
        <div style="background:#16a34a;padding:18px 20px;border-radius:8px 8px 0 0;">
          <h1 style="margin:0;color:#ffffff;font-size:34px;line-height:1.2;">${APP_NAME}</h1>
          <p style="margin:8px 0 0;color:#eafff0;font-size:16px;">Payment Receipt</p>
        </div>
        <div style="padding:22px 20px 10px;">
          <h2 style="color:#16a34a;margin:0 0 16px;">Payment Confirmed!</h2>
          <p style="margin:0 0 14px;font-size:16px;color:#1f2937;">Hi ${customer?.name || order?.consumer?.name || "Customer"},</p>
          <p style="margin:0 0 10px;color:#374151;font-size:16px;">
            Your payment for Order #${orderId} has been confirmed.
          </p>
          <p style="margin:0 0 10px;color:#374151;font-size:16px;">
            Please find your payment receipt attached.
          </p>
          <p style="margin:0 0 8px;color:#374151;font-size:16px;">
            Thank you for choosing ${APP_NAME}!
          </p>
        </div>
      </div>
    `,
    attachments:
      attachmentPath
        ? [
            {
              filename: attachmentFilename || `receipt-${shortId}.pdf`,
              path: attachmentPath,
            },
          ]
        : [],
  });
};

const toTitleCase = (value = "") =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatPaymentMethodLabel = (value = "") => {
  const token = String(value || "").toLowerCase().trim();
  if (["razorpay", "online", "upi", "card", "netbanking"].includes(token)) {
    return "Online Payment";
  }
  if (["cod", "cash"].includes(token)) {
    return "Cash on Delivery";
  }
  return toTitleCase(value || "N/A");
};

const resolveOrderItems = (order = {}) => {
  if (Array.isArray(order?.items) && order.items.length) return order.items;
  if (Array.isArray(order?.orderItems) && order.orderItems.length) return order.orderItems;
  if (Array.isArray(order?.cartSnapshot) && order.cartSnapshot.length) return order.cartSnapshot;
  return [];
};

export const orderConfirmationTemplate = (order, user = {}) => {
  const items = resolveOrderItems(order);
  const userName = user?.name || order?.consumer?.name || order?.customer?.name || "Customer";
  const orderDate = new Date(order?.createdAt || Date.now()).toLocaleDateString("en-IN");
  const paymentMethod = formatPaymentMethodLabel(order?.paymentMethod);
  const calculatedItemsTotal = items.reduce(
    (sum, item) => sum + Number(item?.total || Number(item?.price || 0) * Number(item?.quantity || 0)),
    0
  );
  const finalTotalAmount = Number(
    order?.totalAmount ??
    order?.pricingSnapshot?.totalAmount ??
    calculatedItemsTotal ??
    0
  );

  const orderItemsHtml = items
    .map((item) => {
      const itemName =
        item?.name ||
        item?.productName ||
        item?.product?.name ||
        item?.product?.title ||
        "Fresh Farm Product";
      const qty = Number(item?.quantity || 0);
      const price = Number(item?.price || 0);
      return `
        <tr style="border-bottom:1px solid #e5e7eb;">
          <td>${itemName}</td>
          <td>${qty}</td>
          <td>Rs. ${price.toFixed(2)}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <div style="font-family: Arial, sans-serif; background:#f4f6f8; padding:20px;">
    <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.08);">
      <div style="background:#16a34a; padding:25px; text-align:center; color:white;">
        <h1 style="margin:0;">🌿 KrishiSetu</h1>
        <p style="margin:5px 0 0;">🧾 Order Confirmation</p>
      </div>
      <div style="padding:25px;">
        <h3 style="margin-top:0;">👋 Hi ${userName},</h3>
        <p>🎉 Great news! Your order has been placed successfully.</p>
        <div style="background:#f1f5f9; padding:15px; border-radius:8px; margin:20px 0;">
          <p style="margin:5px 0;"><strong>🆔 Order ID:</strong> ${String(order?._id || "").toUpperCase()}</p>
          <p style="margin:5px 0;"><strong>📅 Date:</strong> ${orderDate}</p>
          <p style="margin:5px 0;"><strong>💳 Payment Method:</strong> ${paymentMethod}</p>
        </div>
        <table width="100%" cellspacing="0" cellpadding="10" style="border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6; text-align:left;">
              <th>🌾 Item</th>
              <th>🔢 Qty</th>
              <th>💰 Price</th>
            </tr>
          </thead>
          <tbody>
            ${
              orderItemsHtml ||
              `
              <tr style="border-bottom:1px solid #e5e7eb;">
                <td>Fresh Farm Product</td>
                <td>1</td>
                <td>Rs. ${finalTotalAmount.toFixed(2)}</td>
              </tr>
            `
            }
          </tbody>
        </table>
        <h2 style="text-align:right; color:#16a34a; margin-top:20px;">
          💵 Total: Rs. ${finalTotalAmount.toFixed(2)}
        </h2>
        <p style="margin-top:30px;">
          🚚 We are preparing your fresh farm products for delivery.
        </p>
        <div style="text-align:center; margin:30px 0;">
          <a href="${buildOrderUrl(order)}" 
             style="background:#16a34a; color:white; padding:12px 20px; text-decoration:none; border-radius:6px; font-weight:bold;">
             🔎 Track Your Order
          </a>
        </div>
      </div>
      <div style="background:#f9fafb; padding:15px; text-align:center; font-size:13px; color:#6b7280;">
        🌱 Thank you for choosing KrishiSetu <br/>
        Need help? Contact us at support@krishisetu.com
      </div>
    </div>
  </div>
  `;
};

export const sendOrderConfirmation = async (order, userEmail) => {
  if (!userEmail || !order?._id) return;
  const baseOrder =
    typeof order?.toObject === "function"
      ? order.toObject()
      : typeof order?.toJSON === "function"
        ? order.toJSON()
        : order;
  let resolvedOrder = baseOrder;
  const existingItems = resolveOrderItems(order);
  if (!existingItems.length) {
    try {
      const { default: OrderItem } = await import("../models/OrderItemModel.js");
      const dbItems = await OrderItem.find({ orderId: order._id })
        .select("productName quantity price product")
        .lean();

      if (Array.isArray(dbItems) && dbItems.length) {
        resolvedOrder = {
          ...baseOrder,
          items: dbItems.map((item) => ({
            name:
              item?.productName ||
              item?.product?.name ||
              item?.product?.title ||
              "Fresh Farm Product",
            quantity: Number(item?.quantity || 0),
            price: Number(item?.price || 0),
          })),
        };
      }
    } catch (error) {
      console.error("ORDER_CONFIRMATION_ITEMS_RESOLVE_ERROR:", error?.message || error);
    }
  }

  const user = {
    name: resolvedOrder?.consumer?.name || resolvedOrder?.customer?.name || "Customer",
    email: userEmail,
  };

  await sendEmail({
    email: userEmail,
    subject: `KrishiSetu - Order Confirmation #${String(order._id).substring(0, 8).toUpperCase()}`,
    eventType: "order_confirmed",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `order_confirmed:${order._id}`,
    message: `Your order #${String(order._id).toUpperCase()} has been confirmed. Total: Rs. ${Number(resolvedOrder?.totalAmount ?? order?.totalAmount ?? 0).toFixed(2)}.`,
    html: orderConfirmationTemplate(resolvedOrder, user),
  });
};

export const sendOrderCancellationEmail = async (order, userEmail, reason = "") => {
  if (!userEmail || !order?._id) return;
  const cancelledItems = (order?.items || [])
    .map((item) => {
      const itemName = item?.product?.name || item?.name || "Item";
      const qty = Number(item?.quantity || 0);
      return `${itemName}${qty > 0 ? ` (x${qty})` : ""}`;
    })
    .filter(Boolean);

  const refundStatus = String(order?.refund?.status || "not_required").replace(/_/g, " ");
  const refundAmount = Number(order?.refund?.amount || 0);
  const refundLine =
    refundStatus === "not required"
      ? "No refund is required for this order."
      : `Refund status: ${refundStatus}. ${
          refundAmount > 0 ? `Refund amount: Rs. ${refundAmount.toFixed(2)}.` : ""
        }`;

  await sendEmail({
    email: userEmail,
    subject: `KrishiSetu - Order Cancelled #${String(order._id).substring(0, 8).toUpperCase()}`,
    eventType: "order_cancelled",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `order_cancelled:${order._id}`,
    message: `Order #${String(order._id).toUpperCase()} has been cancelled.${reason ? ` Reason: ${reason}` : ""}`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #fee2e2;border-radius:12px;">
        <h2 style="color:#dc2626;margin:0 0 8px 0;">Order Cancelled</h2>
        <p>Order #${String(order._id).toUpperCase()} has been cancelled.</p>
        <p><strong>Order Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</p>
        <p><strong>Cancelled Items:</strong> ${cancelledItems.length ? cancelledItems.join(", ") : "N/A"}</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p><strong>Refund Info:</strong> ${refundLine}</p>
        <p>If you need help, contact support at support@krishisetu.com.</p>
      </div>
    `,
  });
};

export const sendFarmerCancelledOrderEmail = async ({
  order,
  customerEmail,
  customerName,
  farmerName,
  reason,
  productName,
}) => {
  if (!order?._id || !customerEmail) return;
  const platformName = process.env.PLATFORM_NAME || "KrishiSetu";
  await sendEmail({
    email: customerEmail,
    subject: "Your Order Has Been Cancelled",
    eventType: "order_cancelled_by_farmer",
    entityType: "order",
    entityId: order._id,
    dedupeKey: `order_cancelled_by_farmer:${order._id}`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;max-width:620px;margin:auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
        <div style="background:#b91c1c;color:#ffffff;padding:16px 18px;">
          <h2 style="margin:0;font-size:20px;">Your Order Has Been Cancelled</h2>
        </div>
        <div style="padding:18px;color:#111827;line-height:1.55;">
          <p>Dear ${customerName || "Customer"},</p>
          <p>We regret to inform you that your order has been cancelled by the farmer.</p>
          <p style="margin:14px 0 8px 0;"><strong>Order Details</strong></p>
          <ul style="margin:0 0 14px 18px;padding:0;">
            <li>Order ID: ${String(order._id).toUpperCase()}</li>
            <li>Product Name: ${productName || "N/A"}</li>
            <li>Farmer Name: ${farmerName || "N/A"}</li>
            <li>Cancellation Reason: ${reason || "Not specified"}</li>
            <li>Order Date: ${new Date(order.createdAt || Date.now()).toLocaleDateString()}</li>
          </ul>
          <p>If you paid online, your refund will be processed within 5-7 working days.</p>
          <p>For any queries, please contact our support team.</p>
          <p>Thank you for choosing ${platformName}.</p>
          <p style="margin-bottom:0;">Regards,<br/>Support Team</p>
        </div>
      </div>
    `,
  });
};

export const sendSubscriptionCancellationEmail = async ({
  subscription,
  customerEmail,
  customerName,
}) => {
  if (!subscription?._id || !customerEmail) return;
  await sendEmail({
    email: customerEmail,
    subject: `KrishiSetu - Subscription Cancelled #${String(subscription._id).substring(0, 8).toUpperCase()}`,
    eventType: "subscription_cancelled",
    entityType: "subscription",
    entityId: subscription._id,
    dedupeKey: `subscription_cancelled:${subscription._id}`,
    html: `
      <div style="font-family:Segoe UI,sans-serif;padding:16px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="margin:0 0 8px 0;color:#dc2626;">Subscription Cancelled</h2>
        <p>Hi ${customerName || "Customer"},</p>
        <p>Your subscription has been cancelled effective ${new Date(
          subscription.cancelledAt || Date.now()
        ).toLocaleString()}.</p>
      </div>
    `,
  });
};
