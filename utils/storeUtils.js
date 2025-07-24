/**
 * Payment store utilities for managing payment data
 * In production, this should be replaced with a proper database
 */

// In-memory payment store (replace with database in production)
const paymentStore = new Map();

/**
 * Store payment data
 * @param {string} uuid - Payment UUID
 * @param {Object} paymentData - Payment data object
 */
function storePaymentData(
  uuid,
  { paymentRequestToken, phoneNumber, amount, paymentReference }
) {
  paymentStore.set(uuid, {
    token: uuid,
    paymentRequestToken,
    status: "CREATED",
    phoneNumber,
    amount,
    payeePaymentReference: paymentReference,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Get payment data by token
 * @param {string} token - Payment token
 * @returns {Object|null} - Payment data or null if not found
 */
function getPaymentData(token) {
  return paymentStore.get(token) || null;
}

/**
 * Update payment status from callback
 * @param {string} id - Payment ID
 * @param {Object} callbackData - Callback data from Swish
 */
function updatePaymentFromCallback(id, callbackData) {
  const { status, paymentReference } = callbackData;

  if (paymentStore.has(id)) {
    const paymentData = paymentStore.get(id);
    paymentData.status = status;
    paymentData.paymentReference = paymentReference;

    // Add completion timestamp for final statuses
    if (["PAID", "DECLINED", "ERROR", "CANCELLED"].includes(status)) {
      paymentData.completedAt = new Date().toISOString();
    } else {
      paymentData.updatedAt = new Date().toISOString();
    }

    paymentStore.set(id, paymentData);
    return true;
  }
  return false;
}

/**
 * Check if payment exists
 * @param {string} token - Payment token
 * @returns {boolean} - True if payment exists
 */
function hasPayment(token) {
  return paymentStore.has(token);
}

export {
  storePaymentData,
  getPaymentData,
  updatePaymentFromCallback,
  hasPayment,
};
