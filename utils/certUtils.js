import https from "https";
import config from "../config/index.js";

/**
 * Certificate management utilities for Swish API authentication
 */

/**
 * Load certificates using base64 approach for both local and production
 * @returns {Object} - Certificate and key objects
 */
function loadCertificates() {
  let cert, key;

  try {
    // Use base64 approach for both local and production environments
    if (!config.certificates.certBase64 || !config.certificates.keyBase64) {
      throw new Error(
        "Missing base64 certificate environment variables. Need SWISH_CERT_BASE64 and SWISH_KEY_BASE64"
      );
    }

    // Decode base64 to string (PEM format) and ensure proper line endings
    const rawCert = Buffer.from(
      config.certificates.certBase64,
      "base64"
    ).toString("utf8");
    const rawKey = Buffer.from(
      config.certificates.keyBase64,
      "base64"
    ).toString("utf8");

    // Ensure proper PEM formatting with correct line endings
    cert = rawCert.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    key = rawKey.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Validate PEM format
    if (
      !cert.includes("-----BEGIN CERTIFICATE-----") ||
      !cert.includes("-----END CERTIFICATE-----")
    ) {
      throw new Error("Invalid certificate format - missing PEM headers");
    }
    if (
      !key.includes("-----BEGIN PRIVATE KEY-----") ||
      !key.includes("-----END PRIVATE KEY-----")
    ) {
      throw new Error("Invalid private key format - missing PEM headers");
    }

    return { cert, key };
  } catch (error) {
    // In production, return null to disable Swish functionality
    if (config.isProduction) {
      return { cert: null, key: null };
    } else {
      throw error; // In development, fail fast
    }
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
