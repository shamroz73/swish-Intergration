import https from "https";
import config from "../config/index.js";

/**
 * Certificate management utilities for Swish API authentication
 * Simplified to only use base64 approach for both local and production
 */

/**
 * Load certificates from environment variables (Base64 format)
 * @returns {Object} Certificate and key data
 */
function loadCertificates() {
  console.log("🔧 Environment check:", {
    isVercel: config.isVercel,
    hasCallbackUrl: !!config.swish.callbackUrl,
    hasPayeeAlias: !!config.swish.payeeAlias,
    hasApiUrl: !!config.swish.apiUrl,
    hasCertBase64: !!config.certificates.certBase64,
    hasKeyBase64: !!config.certificates.keyBase64,
    certBase64Length: config.certificates.certBase64?.length || 0,
    keyBase64Length: config.certificates.keyBase64?.length || 0,
    // Additional debugging
    envVarDebug: {
      SWISH_CERT_BASE64_present: !!process.env.SWISH_CERT_BASE64,
      SWISH_KEY_BASE64_present: !!process.env.SWISH_KEY_BASE64,
      SWISH_CERT_BASE64_length: process.env.SWISH_CERT_BASE64?.length || 0,
      SWISH_KEY_BASE64_length: process.env.SWISH_KEY_BASE64?.length || 0,
    }
  });

  // Additional debugging for Vercel
  if (config.isVercel) {
    console.log(
      "🌟 Running on Vercel - loading certificates from environment variables"
    );
    console.log("Environment variables status:", {
      SWISH_CERT_BASE64: !!process.env.SWISH_CERT_BASE64,
      SWISH_KEY_BASE64: !!process.env.SWISH_KEY_BASE64,
      VERCEL: !!process.env.VERCEL,
    });
  }

  if (!config.certificates.certBase64 || !config.certificates.keyBase64) {
    console.log("⚠️  Certificate environment variables not found in config");
    console.log("Direct environment check:", {
      SWISH_CERT_BASE64: !!process.env.SWISH_CERT_BASE64,
      SWISH_KEY_BASE64: !!process.env.SWISH_KEY_BASE64,
      VERCEL: !!process.env.VERCEL,
    });

    // Try to load directly from process.env as fallback
    if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
      console.log("🔄 Attempting direct load from process.env");
      try {
        const cert = Buffer.from(process.env.SWISH_CERT_BASE64, "base64").toString("utf8");
        const key = Buffer.from(process.env.SWISH_KEY_BASE64, "base64").toString("utf8");
        
        console.log("✅ Certificates loaded directly from process.env");
        console.log("Certificate starts with:", cert.substring(0, 50) + "...");
        console.log("Key starts with:", key.substring(0, 50) + "...");
        
        return { cert, key };
      } catch (error) {
        console.error("❌ Error decoding certificates from process.env:", error);
      }
    }

    const error = new Error(
      "Missing SWISH_CERT_BASE64 or SWISH_KEY_BASE64 environment variables"
    );
    console.log("🚨 CRITICAL ERROR: Failed to load certificates", {
      error: error.message,
      environment: config.environment,
      isVercel: config.isVercel,
      note: "This might be a startup timing issue if payment creation works"
    });

    return { cert: null, key: null };
  }

  try {
    // Decode Base64 certificates
    const cert = Buffer.from(config.certificates.certBase64, "base64").toString(
      "utf8"
    );
    const key = Buffer.from(config.certificates.keyBase64, "base64").toString(
      "utf8"
    );

    console.log("✅ Certificates loaded successfully");
    console.log("Certificate starts with:", cert.substring(0, 50) + "...");
    console.log("Key starts with:", key.substring(0, 50) + "...");

    return { cert, key };
  } catch (error) {
    console.error("❌ Error decoding certificates:", error);
    return { cert: null, key: null };
  }
}

/**
 * Create HTTPS agent for Swish API communication
 * @param {string} cert - Certificate content
 * @param {string} key - Private key content
 * @returns {https.Agent|null} - HTTPS agent or null if creation fails
 */
function createHttpsAgent(cert, key) {
  if (!cert || !key) {
    return null;
  }

  try {
    return new https.Agent({
      cert: cert,
      key: key,
      rejectUnauthorized: true,
      secureProtocol: "TLSv1_2_method",
      honorCipherOrder: true,
    });
  } catch (error) {
    return null;
  }
}

export { loadCertificates, createHttpsAgent };
