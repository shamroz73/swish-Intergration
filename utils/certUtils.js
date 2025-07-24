import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import config from "../config/index.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Certificate management utilities for Swish API authentication
 * Simplified to only use base64 approach for both local and production
 */

/**
 * Load certificates from text files (as fallback)
 * @returns {Object} Certificate and key data
 */
function loadCertificatesFromFiles() {
  console.log("📁 Attempting to load certificates from files...");
  
  try {
    const certPath = path.join(__dirname, '..', 'certs', 'cert.txt');
    const keyPath = path.join(__dirname, '..', 'certs', 'key.txt');
    
    console.log(`🔍 Looking for cert at: ${certPath}`);
    console.log(`🔍 Looking for key at: ${keyPath}`);
    
    // Check if files exist
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      console.log("❌ Certificate files not found");
      return { cert: null, key: null };
    }
    
    // Read the files
    const certBase64 = fs.readFileSync(certPath, 'utf8')
      .replace(/\/\/.*$/gm, '') // Remove comments
      .replace(/\s/g, ''); // Remove whitespace
      
    const keyBase64 = fs.readFileSync(keyPath, 'utf8')
      .replace(/\/\/.*$/gm, '') // Remove comments  
      .replace(/\s/g, ''); // Remove whitespace
    
    if (!certBase64 || !keyBase64 || certBase64.length < 100 || keyBase64.length < 100) {
      console.log("❌ Certificate files appear to be empty or contain placeholders");
      return { cert: null, key: null };
    }
    
    // Decode base64
    const cert = Buffer.from(certBase64, "base64").toString("utf8");
    const key = Buffer.from(keyBase64, "base64").toString("utf8");
    
    console.log("✅ Certificates loaded successfully from files");
    console.log("Certificate starts with:", cert.substring(0, 50) + "...");
    console.log("Key starts with:", key.substring(0, 50) + "...");
    
    return { cert, key };
    
  } catch (error) {
    console.error("❌ Error loading certificates from files:", error);
    return { cert: null, key: null };
  }
}

/**
 * Alternative certificate loading - try multiple approaches
 * @returns {Object} Certificate and key data
 */
function loadCertificatesAlternative() {
  console.log("🔄 Trying alternative certificate loading methods...");
  
  // Method 1: Direct from process.env
  if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
    console.log("✅ Method 1: Found certificates directly in process.env");
    try {
      const cert = Buffer.from(process.env.SWISH_CERT_BASE64, "base64").toString("utf8");
      const key = Buffer.from(process.env.SWISH_KEY_BASE64, "base64").toString("utf8");
      
      console.log("✅ Alternative method: Certificates decoded successfully");
      console.log("Certificate starts with:", cert.substring(0, 50) + "...");
      console.log("Key starts with:", key.substring(0, 50) + "...");
      
      return { cert, key };
    } catch (error) {
      console.error("❌ Alternative method failed:", error);
    }
  }
  
  // Method 2: Check if variables exist but are undefined/null
  console.log("🔍 Method 2: Checking variable existence...");
  console.log("SWISH_CERT_BASE64 type:", typeof process.env.SWISH_CERT_BASE64);
  console.log("SWISH_KEY_BASE64 type:", typeof process.env.SWISH_KEY_BASE64);
  console.log("SWISH_CERT_BASE64 value:", process.env.SWISH_CERT_BASE64 ? "HAS_VALUE" : "NO_VALUE");
  console.log("SWISH_KEY_BASE64 value:", process.env.SWISH_KEY_BASE64 ? "HAS_VALUE" : "NO_VALUE");
  
  // Method 3: List all environment variables that start with SWISH
  console.log("🔍 Method 3: All SWISH environment variables:");
  const swishVars = Object.keys(process.env).filter(key => key.startsWith('SWISH'));
  swishVars.forEach(key => {
    console.log(`  ${key}: ${process.env[key] ? 'SET' : 'NOT_SET'}`);
  });
  
  return { cert: null, key: null };
}

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
    },
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

    // Try alternative loading method
    console.log("🔄 Attempting alternative certificate loading...");
    const altResult = loadCertificatesAlternative();
    if (altResult.cert && altResult.key) {
      return altResult;
    }

    // Try loading from files as another fallback
    console.log("🔄 Attempting file-based certificate loading...");
    const fileResult = loadCertificatesFromFiles();
    if (fileResult.cert && fileResult.key) {
      return fileResult;
    }

    // Try to load directly from process.env as fallback
    if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
      console.log("🔄 Attempting direct load from process.env");
      try {
        const cert = Buffer.from(
          process.env.SWISH_CERT_BASE64,
          "base64"
        ).toString("utf8");
        const key = Buffer.from(
          process.env.SWISH_KEY_BASE64,
          "base64"
        ).toString("utf8");

        console.log("✅ Certificates loaded directly from process.env");
        console.log("Certificate starts with:", cert.substring(0, 50) + "...");
        console.log("Key starts with:", key.substring(0, 50) + "...");

        return { cert, key };
      } catch (error) {
        console.error(
          "❌ Error decoding certificates from process.env:",
          error
        );
      }
    }

    const error = new Error(
      "Missing SWISH_CERT_BASE64 or SWISH_KEY_BASE64 environment variables"
    );
    console.log("🚨 CRITICAL ERROR: Failed to load certificates", {
      error: error.message,
      environment: config.environment,
      isVercel: config.isVercel,
      note: "This might be a startup timing issue if payment creation works",
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

export { loadCertificates, loadCertificatesAlternative, loadCertificatesFromFiles, createHttpsAgent };
