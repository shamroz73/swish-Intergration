import crypto from "crypto";
import config from "../config/index.js";

/**
 * Payment utilities for generating references and identifiers
 */

/**
 * Generate a unique payment reference
 * @returns {string} - Unique payment reference
 */
function generatePaymentReference() {
  return `${config.payment.referencePrefix}${Date.now()}${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;
}

/**
 * Generate a unique UUID for payment requests
 * @returns {string} - UUID without dashes in uppercase
 */
function generatePaymentUUID() {
  return crypto.randomUUID().replace(/-/g, "").toUpperCase();
}

/**
 * Create payment payload for Swish API
 * @param {Object} params - Payment parameters
 * @param {string} params.paymentReference - Payment reference
 * @param {string} params.formattedPhone - Formatted phone number
 * @param {string} params.amount - Payment amount
 * @returns {Object} - Swish API payload
 */
function createPaymentPayload({ paymentReference, formattedPhone, amount }) {
  const payload = {
    payeePaymentReference: paymentReference,
    payerAlias: formattedPhone,
    payeeAlias: config.swish.payeeAlias,
    amount: amount,
    currency: config.payment.currency,
    message: config.payment.defaultMessage,
  };

  // Only add callbackUrl if it's set
  if (config.swish.callbackUrl) {
    payload.callbackUrl = config.swish.callbackUrl;
    console.log(`📞 Setting callback URL in payload: ${config.swish.callbackUrl}`);
  } else {
    console.log("⚠️  No callback URL configured - callbacks will not be received!");
  }

  console.log("📋 Final Swish payment payload:", JSON.stringify(payload, null, 2));
  return payload;
}

export { generatePaymentReference, generatePaymentUUID, createPaymentPayload };
