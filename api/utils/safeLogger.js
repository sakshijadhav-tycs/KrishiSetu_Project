const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "razorpay_signature",
  "razorpaySignature",
  "signature",
  "key_secret",
  "jwt",
  "otp",
  "resetPasswordOTP",
]);

const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const redactSensitive = (input) => {
  if (Array.isArray(input)) {
    return input.map((item) => redactSensitive(item));
  }
  if (!isObject(input)) return input;

  const output = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEYS.has(String(key))) {
      output[key] = "[REDACTED]";
      continue;
    }
    output[key] = redactSensitive(value);
  }
  return output;
};

export const logInfo = (message, context = {}) => {
  const safeContext = redactSensitive(context);
  console.log(message, safeContext);
};

export const logWarn = (message, context = {}) => {
  const safeContext = redactSensitive(context);
  console.warn(message, safeContext);
};

export const logError = (message, context = {}) => {
  const safeContext = redactSensitive(context);
  console.error(message, safeContext);
};
