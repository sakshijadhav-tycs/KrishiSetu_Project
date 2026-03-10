import Razorpay from "razorpay";

let cachedInstance = null;

export const isRazorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

export const getRazorpayInstance = () => {
  if (!isRazorpayConfigured()) return null;
  if (!cachedInstance) {
    cachedInstance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return cachedInstance;
};

export const requireRazorpayInstance = () => {
  const instance = getRazorpayInstance();
  if (!instance) {
    const error = new Error(
      "Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
    error.code = "RAZORPAY_NOT_CONFIGURED";
    throw error;
  }
  return instance;
};
