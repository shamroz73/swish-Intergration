/**
 * Application configuration
 * Centralized configuration management
 */

const config = {
  // Server configuration
  port: process.env.PORT || 3001,
  environment: process.env.NODE_ENV || "development",

  // Swish API configuration
  swish: {
    apiUrl: process.env.SWISH_API_URL,
    payeeAlias: process.env.SWISH_PAYEE_ALIAS,
    callbackUrl: process.env.SWISH_CALLBACK_URL,
  },

  // Certificate configuration (base64 only)
  certificates: {
    certBase64: process.env.SWISH_CERT_BASE64,
    keyBase64: process.env.SWISH_KEY_BASE64,
  },

  // Runtime flags
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",
  isVercel: !!process.env.VERCEL,

  // Payment configuration
  payment: {
    currency: "SEK",
    defaultMessage: "Payment to Yumplee",
    referencePrefix: "YMP",
  },
};

export default config;
