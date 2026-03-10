/**
 * Payment Validation and Verification Utilities
 */

import crypto from "crypto";

/**
 * Validate Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Razorpay signature
 * @param {string} secret - Razorpay key secret
 * @returns {boolean} True if signature is valid
 */
export const validatePaymentSignature = (orderId, paymentId, signature, secret) => {
  const body = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(body.toString())
    .digest("hex");

  return expectedSignature === signature;
};

/**
 * Verify payment amount matches order amount
 * @param {number} expectedAmount - Expected amount in rupees
 * @param {number} paidAmount - Paid amount in paise (from Razorpay)
 * @returns {boolean} True if amounts match
 */
export const verifyPaymentAmount = (expectedAmount, paidAmount) => {
  // Razorpay returns amount in paise, convert to rupees
  const paidAmountInRupees = paidAmount / 100;
  
  // Allow 1 rupee tolerance for rounding errors
  return Math.abs(expectedAmount - paidAmountInRupees) <= 1;
};

/**
 * Check if payment status is valid
 * @param {string} paymentStatus - Status from Razorpay
 * @returns {boolean} True if status is captured or authorized
 */
export const isValidPaymentStatus = (paymentStatus) => {
  const validStatuses = ['captured', 'authorized'];
  return validStatuses.includes(paymentStatus?.toLowerCase());
};

/**
 * Parse Razorpay payment notes
 * @param {object} notes - Notes from Razorpay payment
 * @returns {object} Parsed payment data
 */
export const parsePaymentNotes = (notes) => {
  try {
    return {
      consumerId: notes.consumerId,
      items: JSON.parse(notes.items || '[]'),
      amount: Number(notes.amount) || 0,
      addressData: JSON.parse(notes.addressData || '{}'),
    };
  } catch (error) {
    console.error('Error parsing payment notes:', error);
    throw new Error('Invalid payment notes format');
  }
};

/**
 * Calculate payment expiry timestamp
 * @param {number} expiryMinutes - Minutes until expiry (default: 30)
 * @returns {Date} Expiry timestamp
 */
export const getPaymentExpiry = (expiryMinutes = 30) => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + expiryMinutes);
  return expiry;
};
