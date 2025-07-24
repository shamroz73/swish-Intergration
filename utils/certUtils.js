import https from "https";
import config from "../config/index.js";

/**
 * Certificate management utilities for Swish API authentication
 * Simplified to only use base64 approach for both local and production
 */

/**
 * Load certificates using base64 environment variables
 * @returns {Object} - Certificate and key objects
 */
function loadCertificates() {
  try {
    // Check if base64 environment variables are available
    if (!config.certificates.certBase64 || !config.certificates.keyBase64) {
      console.warn("⚠️ Swish certificates not configured - Swish payments will be disabled");
      return { cert: null, key: null };
    }

    // Decode base64 to PEM format
    const cert = Buffer.from(config.certificates.certBase64, "base64").toString("utf8");
    const key = Buffer.from(config.certificates.keyBase64, "base64").toString("utf8");

    // Validate PEM format
    if (!cert.includes("-----BEGIN CERTIFICATE-----") || !cert.includes("-----END CERTIFICATE-----")) {
      throw new Error("Invalid certificate format - missing PEM headers");
    }
    
    if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
      throw new Error("Invalid private key format - missing PEM headers");
    }

    console.log("✅ Swish certificates loaded successfully");
    return { cert, key };
    
  } catch (error) {
    console.error("❌ Error loading Swish certificates:", error.message);
    
    // In production, gracefully disable Swish functionality
    if (config.isProduction) {
      console.warn("🔒 Swish payments disabled in production due to certificate error");
      return { cert: null, key: null };
    }
    
    // In development, provide helpful error message but don't crash
    console.error("💡 To fix this:");
    console.error("1. Run: npm run generate-certs");
    console.error("2. Or manually set SWISH_CERT_BASE64 and SWISH_KEY_BASE64 environment variables");
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
