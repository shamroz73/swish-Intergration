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

if (isDevelopment) {
  console.log("🔧 Environment check:", {
    isVercel: !!process.env.VERCEL,
    hasCallbackUrl: !!process.env.SWISH_CALLBACK_URL,
    hasPayeeAlias: !!process.env.SWISH_PAYEE_ALIAS,
    hasApiUrl: !!process.env.SWISH_API_URL,
    hasCertBase64: !!process.env.SWISH_CERT_BASE64,
    hasKeyBase64: !!process.env.SWISH_KEY_BASE64,
  });
}

// Load certificates based on environment
if (process.env.VERCEL) {
  console.log("🌟 Running on Vercel - loading certificates from environment variables");
  cert = Buffer.from(process.env.SWISH_CERT_BASE64 || "", "base64");
  key = Buffer.from(process.env.SWISH_KEY_BASE64 || "", "base64");
  
  if (isDevelopment) {
    console.log("📜 Certificate loaded:", {
      certSize: cert.length,
      keySize: key.length,
    });
  }
} else {
  console.log("💻 Running locally - loading certificates from files");
  cert = fs.readFileSync(path.resolve(__dirname, process.env.SWISH_CERT_PATH));
  key = fs.readFileSync(path.resolve(__dirname, process.env.SWISH_KEY_PATH));
}

// Create HTTPS agent for Swish API communication
const agent = new https.Agent({
  cert,
  key,
  rejectUnauthorized: true,
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy", 
    service: "Swish Payment API",
    timestamp: new Date().toISOString()
  });
});

// Root endpoint serves React app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

//  Route: Create Swish Payment
app.post("/api/create-swish-payment", async (req, res) => {
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
  if (isDevelopment) {
    console.error("❌ Swish API Error:", {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
    });
  }

  const errorMessage = error.response?.data?.message || error.message || "Failed to create Swish payment";
  const statusCode = error.response?.status || 500;

  res.status(statusCode).json({
    error: errorMessage,
    details: error.response?.data || "Internal server error",
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
