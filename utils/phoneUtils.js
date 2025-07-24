/**
 * Phone number utilities for Swedish Swish payments
 */

/**
 * Format phone number for Swish API
 * @param {string} phoneNumber - Raw phone number input
 * @returns {string} - Formatted phone number (country code + cellphone number)
 */
function formatPhoneNumber(phoneNumber) {
  // Format: country code + cellphone number (without leading zero)
  // Example: 46712345678 (no + sign, 8-15 digits total)
  let formatted = phoneNumber.toString().replace(/\s+/g, "").replace(/^\+/, "");

  // If it starts with 0, remove it (Swedish mobile numbers)
  if (formatted.startsWith("0")) {
    formatted = "46" + formatted.substring(1);
  }

  // If it doesn't start with country code, add 46
  if (!formatted.startsWith("46")) {
    formatted = "46" + formatted;
  }

  return formatted;
}

/**
 * Validate phone number format
 * @param {string} phoneNumber - Formatted phone number
 * @returns {boolean} - True if valid format
 */
function isValidPhoneNumber(phoneNumber) {
  return /^\d{8,15}$/.test(phoneNumber);
}

export { formatPhoneNumber, isValidPhoneNumber };
