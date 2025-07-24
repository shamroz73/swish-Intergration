require("dotenv").config();
const express = require("express");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(express.json());

// Environment configuration
const PORT = process.env.PORT || 3001;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Payment store (use database in production)
const paymentStore = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// Certificate loading and HTTPS agent setup
let cert, key;

// Always log environment check for debugging
console.log("🔧 Environment check:", {
  isVercel: !!process.env.VERCEL,
  hasCallbackUrl: !!process.env.SWISH_CALLBACK_URL,
  hasPayeeAlias: !!process.env.SWISH_PAYEE_ALIAS,
  hasApiUrl: !!process.env.SWISH_API_URL,
  // Raw PEM certificates (new approach)
  hasSwishCert: !!process.env.SWISH_CERT,
  hasSwishKey: !!process.env.SWISH_KEY,
  swishCertLength: process.env.SWISH_CERT?.length || 0,
  swishKeyLength: process.env.SWISH_KEY?.length || 0,
  // Base64 certificates (fallback)
  hasCertBase64: !!process.env.SWISH_CERT_BASE64,
  hasKeyBase64: !!process.env.SWISH_KEY_BASE64,
  certBase64Length: process.env.SWISH_CERT_BASE64?.length || 0,
  keyBase64Length: process.env.SWISH_KEY_BASE64?.length || 0,
});

// Load certificates based on environment
try {
  if (process.env.VERCEL) {
    console.log("🌟 Running on Vercel - loading certificates from environment variables");
    
    // Try raw PEM first (new approach), fallback to base64 (old approach)
    if (process.env.SWISH_CERT && process.env.SWISH_KEY) {
      console.log("🔍 Loading certificates directly as PEM format...");
      
      cert = process.env.SWISH_CERT;
      key = process.env.SWISH_KEY;
      
      console.log("📜 Raw PEM certificates loaded:", {
        certSize: cert.length,
        keySize: key.length,
        certStartsWith: cert.substring(0, 50),
        keyStartsWith: key.substring(0, 50),
        certHasPemHeaders: cert.includes('-----BEGIN CERTIFICATE-----'),
        keyHasPemHeaders: key.includes('-----BEGIN PRIVATE KEY-----'),
      });
      
    } else if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
      console.log("🔍 Fallback: Decoding certificates from base64...");
      
      // Decode base64 to string (PEM format) and ensure proper line endings
      const rawCert = Buffer.from(process.env.SWISH_CERT_BASE64, "base64").toString("utf8");
      const rawKey = Buffer.from(process.env.SWISH_KEY_BASE64, "base64").toString("utf8");
      
      // Ensure proper PEM formatting with correct line endings
      cert = rawCert.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      key = rawKey.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      console.log("📜 Base64 certificates decoded:", {
        certSize: cert.length,
        keySize: key.length,
        certStartsWith: cert.substring(0, 50),
        keyStartsWith: key.substring(0, 50),
      });
      
    } else {
      console.error("❌ Missing certificate environment variables on Vercel");
      console.error("Environment variables status:", {
        SWISH_CERT: !!process.env.SWISH_CERT,
        SWISH_KEY: !!process.env.SWISH_KEY,
        SWISH_CERT_BASE64: !!process.env.SWISH_CERT_BASE64,
        SWISH_KEY_BASE64: !!process.env.SWISH_KEY_BASE64,
        VERCEL: !!process.env.VERCEL,
      });
      throw new Error("Missing certificate environment variables. Need either SWISH_CERT/SWISH_KEY or SWISH_CERT_BASE64/SWISH_KEY_BASE64");
    }
    
    // Validate PEM format
    if (!cert.includes('-----BEGIN CERTIFICATE-----') || !cert.includes('-----END CERTIFICATE-----')) {
      throw new Error('Invalid certificate format - missing PEM headers');
    }
    if (!key.includes('-----BEGIN PRIVATE KEY-----') || !key.includes('-----END PRIVATE KEY-----')) {
      throw new Error('Invalid private key format - missing PEM headers');
    }
  } else {
    console.log("💻 Running locally - loading certificates from files");
    
    if (!process.env.SWISH_CERT_PATH || !process.env.SWISH_KEY_PATH) {
      console.error("❌ Missing certificate file paths for local development");
      throw new Error("Missing SWISH_CERT_PATH or SWISH_KEY_PATH environment variables");
    }
    
    const certPath = path.resolve(__dirname, process.env.SWISH_CERT_PATH);
    const keyPath = path.resolve(__dirname, process.env.SWISH_KEY_PATH);
    
    console.log("🔍 Loading certificates from files:", { certPath, keyPath });
    cert = fs.readFileSync(certPath);
    key = fs.readFileSync(keyPath);
    
    console.log("📜 Certificate files loaded successfully:", {
      certSize: cert.length,
      keySize: key.length,
    });
  }
} catch (error) {
  console.error("🚨 CRITICAL ERROR: Failed to load certificates", {
    error: error.message,
    stack: error.stack,
    environment: process.env.NODE_ENV,
    isVercel: !!process.env.VERCEL,
  });
  
  // In production, we should still start the server but disable Swish functionality
  if (process.env.NODE_ENV === 'production') {
    console.warn("⚠️ Starting server without Swish certificates - API will be disabled");
    cert = null;
    key = null;
  } else {
    throw error; // In development, fail fast
  }
}

// Create HTTPS agent for Swish API communication
let agent = null;
if (cert && key) {
  try {
    agent = new https.Agent({
      cert: cert,
      key: key,
      rejectUnauthorized: true,
      // Add additional options for better compatibility
      secureProtocol: 'TLSv1_2_method',
      honorCipherOrder: true,
    });
    console.log("✅ HTTPS agent created successfully for Swish API");
  } catch (agentError) {
    console.error("🚨 Failed to create HTTPS agent:", {
      error: agentError.message,
      certType: typeof cert,
      keyType: typeof key,
      certLength: cert?.length || 0,
      keyLength: key?.length || 0,
    });
    agent = null;
  }
} else {
  console.warn("⚠️ No HTTPS agent created - Swish API calls will fail");
}

// Simple diagnostic endpoint
app.get("/api/cert-status", (req, res) => {
  const status = {
    hasRawPem: !!(process.env.SWISH_CERT && process.env.SWISH_KEY),
    hasBase64: !!(process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64),
    isVercel: !!process.env.VERCEL,
    certSource: null,
    certPreview: null,
    keyPreview: null
  };
  
  if (status.hasRawPem) {
    status.certSource = "raw-pem";
    status.certPreview = process.env.SWISH_CERT.substring(0, 100);
    status.keyPreview = process.env.SWISH_KEY.substring(0, 100);
  } else if (status.hasBase64) {
    status.certSource = "base64";
    status.certPreview = process.env.SWISH_CERT_BASE64.substring(0, 100);
    status.keyPreview = process.env.SWISH_KEY_BASE64.substring(0, 100);
  }
  
  res.json(status);
});

// Simple endpoint to debug environment variables
app.get("/api/debug-env", (req, res) => {
  try {
    const hasRawPem = !!(process.env.SWISH_CERT && process.env.SWISH_KEY);
    const hasBase64 = !!(process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64);
    
    if (!hasRawPem && !hasBase64) {
      return res.json({
        error: "Missing environment variables",
        hasSwishCert: !!process.env.SWISH_CERT,
        hasSwishKey: !!process.env.SWISH_KEY,
        hasSwishCertBase64: !!process.env.SWISH_CERT_BASE64,
        hasSwishKeyBase64: !!process.env.SWISH_KEY_BASE64,
        isVercel: !!process.env.VERCEL
      });
    }

    // Check raw PEM certificates first
    if (hasRawPem) {
      const cert = process.env.SWISH_CERT;
      const key = process.env.SWISH_KEY;
      
      console.log("🔍 Raw PEM env vars check:", {
        certLength: cert.length,
        keyLength: key.length,
        certFirst50: cert.substring(0, 50),
        keyFirst50: key.substring(0, 50)
      });
      
      const certValid = cert.includes("-----BEGIN CERTIFICATE-----") && cert.includes("-----END CERTIFICATE-----");
      const keyValid = key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----");
      
      return res.json({
        status: "debug-complete",
        method: "raw-pem",
        environment: {
          isVercel: !!process.env.VERCEL,
          hasSwishCert: true,
          hasSwishKey: true,
          certLength: cert.length,
          keyLength: key.length
        },
        validation: {
          certValid,
          keyValid,
          certPreview: cert.substring(0, 100),
          keyPreview: key.substring(0, 100)
        }
      });
    }

    // Try to decode and check the certificates
    const certBase64 = process.env.SWISH_CERT_BASE64;
    const keyBase64 = process.env.SWISH_KEY_BASE64;
    
    console.log("🔍 Env vars length check:", {
      certBase64Length: certBase64.length,
      keyBase64Length: keyBase64.length,
      certFirst50: certBase64.substring(0, 50),
      keyFirst50: keyBase64.substring(0, 50)
    });
    
    // Try to decode
    let cert, key;
    try {
      cert = Buffer.from(certBase64, "base64").toString("utf8");
      key = Buffer.from(keyBase64, "base64").toString("utf8");
      
      console.log("🔍 Decoded lengths:", {
        certLength: cert.length,
        keyLength: key.length,
        certFirst100: cert.substring(0, 100),
        keyFirst100: key.substring(0, 100)
      });
      
    } catch (decodeError) {
      console.error("❌ Decode error:", decodeError);
      return res.json({
        error: "Failed to decode certificates",
        decodeError: decodeError.message,
        certBase64Length: certBase64.length,
        keyBase64Length: keyBase64.length
      });
    }

    // Check PEM format
    const certValid = cert.includes("-----BEGIN CERTIFICATE-----") && cert.includes("-----END CERTIFICATE-----");
    const keyValid = key.includes("-----BEGIN PRIVATE KEY-----") && key.includes("-----END PRIVATE KEY-----");
    
    console.log("🔍 PEM validation:", { certValid, keyValid });
    
    res.json({
      status: "debug-complete",
      environment: {
        isVercel: !!process.env.VERCEL,
        hasSwishCertBase64: !!process.env.SWISH_CERT_BASE64,
        hasSwishKeyBase64: !!process.env.SWISH_KEY_BASE64,
        certBase64Length: certBase64.length,
        keyBase64Length: keyBase64.length
      },
      decoded: {
        certLength: cert.length,
        keyLength: key.length,
        certValid,
        keyValid,
        certPreview: cert.substring(0, 100),
        keyPreview: key.substring(0, 100)
      }
    });
    
  } catch (error) {
    console.error("❌ Debug endpoint error:", error);
    res.status(500).json({
      error: "Debug endpoint failed",
      message: error.message,
      stack: error.stack
    });
  }
});

// Root endpoint serves React app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

//  Route: Create Swish Payment
app.post("/api/create-swish-payment", async (req, res) => {
  // Check if Swish API is available
  if (!agent) {
    return res.status(503).json({
      error: "Swish API is not available",
      message: "Certificate configuration is missing",
      timestamp: new Date().toISOString(),
    });
  }

  const { phoneNumber, amount } = req.body;

  // Validate required fields
  if (!phoneNumber || !amount) {
    return res.status(400).json({ 
      error: "Missing required fields", 
      required: ["phoneNumber", "amount"] 
    });
  }

  try {
    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(phoneNumber);
    if (!isValidPhoneNumber(formattedPhone)) {
      return res.status(400).json({
        error: `Invalid phone number format. Must be 8-15 digits, format: country code + cellphone number. Got: ${formattedPhone}`,
      });
    }

    // Generate payment identifiers
    const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();
    const paymentReference = generatePaymentReference();

    // Prepare payment payload
    const payload = createPaymentPayload({
      paymentReference,
      formattedPhone,
      amount: amount.toString(),
    });

    // Make request to Swish API
    const response = await makeSwishApiRequest(uuid, payload);
    
    // Store payment data for tracking
    storePaymentData(uuid, {
      paymentRequestToken: response.data.id || uuid,
      phoneNumber: formattedPhone,
      amount: amount.toString(),
      paymentReference,
    });

    res.status(200).json({
      token: uuid,
      paymentRequestToken: response.data.id || uuid,
      status: "created",
    });

  } catch (error) {
    handleSwishApiError(error, res);
  }
});

// Route: Handle Swish Callback
app.post("/api/swish/callback", (req, res) => {
  const { id, payeePaymentReference, status, paymentReference } = req.body;

  if (isDevelopment) {
    console.log("� Swish callback received:", JSON.stringify(req.body, null, 2));
  }

  // Update payment status in store
  if (paymentStore.has(id)) {
    const paymentData = paymentStore.get(id);
    paymentData.status = status;
    paymentData.paymentReference = paymentReference;
    paymentData.completedAt = new Date().toISOString();
    paymentStore.set(id, paymentData);

    if (isDevelopment) {
      console.log(`✅ Payment ${id} updated to status: ${status}`);
    }
  } else if (isDevelopment) {
    console.log(`❌ Payment ${id} not found in local store`);
  }

  res.status(200).json({ message: "Callback processed successfully" });
});

// Route: Get Payment Status
app.get("/api/payment-status/:token", (req, res) => {
  const { token } = req.params;

  if (paymentStore.has(token)) {
    const paymentData = paymentStore.get(token);
    res.json(paymentData);
  } else {
    res.status(404).json({ error: "Payment not found" });
  }
});

// Utility functions
function formatPhoneNumber(phoneNumber) {
  // Format: country code + cellphone number (without leading zero)
  // Example: 46712345678 (no + sign, 8-15 digits total)
  let formatted = phoneNumber
    .toString()
    .replace(/\s+/g, "")
    .replace(/^\+/, "");

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

function isValidPhoneNumber(phoneNumber) {
  return /^\d{8,15}$/.test(phoneNumber);
}

function generatePaymentReference() {
  return `YMP${Date.now()}${Math.random()
    .toString(36)
    .substring(2, 8)
    .toUpperCase()}`;
}

function createPaymentPayload({ paymentReference, formattedPhone, amount }) {
  const payload = {
    payeePaymentReference: paymentReference,
    payerAlias: formattedPhone,
    payeeAlias: process.env.SWISH_PAYEE_ALIAS,
    amount: amount,
    currency: "SEK",
    message: "Payment to Yumplee",
  };

  // Only add callbackUrl if it's set
  if (process.env.SWISH_CALLBACK_URL) {
    payload.callbackUrl = process.env.SWISH_CALLBACK_URL;
  }

  return payload;
}

async function makeSwishApiRequest(uuid, payload) {
  const apiUrl = `${process.env.SWISH_API_URL}/swish-cpcapi/api/v2/paymentrequests`;
  
  if (isDevelopment) {
    console.log("🌐 Making request to Swish API:", {
      url: `${apiUrl}/${uuid}`,
      payload,
    });
  }

  const response = await axios.put(`${apiUrl}/${uuid}`, payload, {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (isDevelopment) {
    console.log("✅ Swish API response:", response.status, response.data);
  }

  return response;
}

function storePaymentData(uuid, { paymentRequestToken, phoneNumber, amount, paymentReference }) {
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

function handleSwishApiError(error, res) {
  // Always log errors for debugging in production
  console.error("❌ Swish API Error:", {
    message: error.message,
    status: error.response?.status,
    statusText: error.response?.statusText,
    data: error.response?.data,
    code: error.code,
    url: error.config?.url,
    method: error.config?.method,
  });

  const errorMessage = error.response?.data?.message || error.message || "Failed to create Swish payment";
  const statusCode = error.response?.status || 500;

  res.status(statusCode).json({
    error: errorMessage,
    details: isDevelopment ? error.response?.data || error.message : "Internal server error",
    timestamp: new Date().toISOString(),
  });
}

// Catch-all handler: serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  
  if (isDevelopment) {
    console.log(`📧 Callback URL: ${process.env.SWISH_CALLBACK_URL || "Not set"}`);
  }
});
