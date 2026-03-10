import crypto from "crypto";

const TRACKING_SECRET =
  process.env.ORDER_TRACKING_SECRET ||
  process.env.JWT_SECRET ||
  process.env.RAZORPAY_KEY_SECRET ||
  "krishisetu-order-tracking-secret";

const encode = (value) => Buffer.from(String(value), "utf8").toString("base64url");
const decode = (value) => Buffer.from(String(value), "base64url").toString("utf8");

const signPayload = (payload) =>
  crypto.createHmac("sha256", TRACKING_SECRET).update(payload).digest("base64url");

export const generateOrderTrackingToken = ({ orderId, scope }) => {
  const normalizedOrderId = String(orderId || "").trim();
  const normalizedScope = String(scope || "").trim();
  if (!normalizedOrderId || !normalizedScope) return "";

  const payload = encode(
    JSON.stringify({
      orderId: normalizedOrderId,
      scope: normalizedScope,
    })
  );
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
};

export const verifyOrderTrackingToken = ({ token, orderId, scope }) => {
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken.includes(".")) return false;

  const [payload, signature] = normalizedToken.split(".");
  if (!payload || !signature) return false;

  const expectedSignature = signPayload(payload);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return false;
  }

  try {
    const parsed = JSON.parse(decode(payload));
    return (
      String(parsed?.orderId || "") === String(orderId || "") &&
      String(parsed?.scope || "") === String(scope || "")
    );
  } catch {
    return false;
  }
};
