/**
 * Idempotency Key Manager for Razorpay Payments
 * Prevents duplicate orders from concurrent payment requests
 */

const pendingPayments = new Map(); // In-memory for now (use Redis in production)
const processedPayments = new Map(); // Track completed payments

/**
 * Generate or retrieve idempotency key
 * @param {string} razorpayOrderId - Razorpay order ID
 * @param {string} consumerId - Consumer ID
 * @returns {string} Unique idempotency key
 */
export const getIdempotencyKey = (razorpayOrderId, consumerId) => {
  return `${razorpayOrderId}-${consumerId}`;
};

/**
 * Check if payment is already being processed
 * @param {string} idempotencyKey - The idempotency key
 * @returns {object|null} Payment status or null if not found
 */
export const checkPaymentStatus = (idempotencyKey) => {
  // Check if already processed
  if (processedPayments.has(idempotencyKey)) {
    return {
      status: 'completed',
      data: processedPayments.get(idempotencyKey),
    };
  }

  // Check if currently processing
  if (pendingPayments.has(idempotencyKey)) {
    return {
      status: 'processing',
      timestamp: pendingPayments.get(idempotencyKey),
    };
  }

  return null;
};

/**
 * Mark payment as pending/processing
 * @param {string} idempotencyKey - The idempotency key
 */
export const markPaymentPending = (idempotencyKey) => {
  pendingPayments.set(idempotencyKey, Date.now());
};

/**
 * Mark payment as completed
 * @param {string} idempotencyKey - The idempotency key
 * @param {object} orderData - The created order data
 */
export const markPaymentCompleted = (idempotencyKey, orderData) => {
  pendingPayments.delete(idempotencyKey);
  processedPayments.set(idempotencyKey, orderData);
  
  // Clean up after 24 hours (optional)
  setTimeout(() => {
    processedPayments.delete(idempotencyKey);
  }, 24 * 60 * 60 * 1000);
};

/**
 * Mark payment as failed
 * @param {string} idempotencyKey - The idempotency key
 */
export const markPaymentFailed = (idempotencyKey) => {
  pendingPayments.delete(idempotencyKey);
};

/**
 * Clean up old pending payments (call periodically)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10 minutes)
 */
export const cleanupStalePendingPayments = (timeoutMs = 10 * 60 * 1000) => {
  const now = Date.now();
  for (const [key, timestamp] of pendingPayments.entries()) {
    if (now - timestamp > timeoutMs) {
      pendingPayments.delete(key);
    }
  }
};

// Cleanup stale payments every 5 minutes
setInterval(() => {
  cleanupStalePendingPayments();
}, 5 * 60 * 1000);
