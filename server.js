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
const isDevelopment = process.env.NODE_ENV !== "production";

// Payment store (use database in production)
const paymentStore = new Map();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// Certificate loading and HTTPS agent setup
let cert, key;

// Load certificates based on environment
try {
  if (process.env.VERCEL) {
    // Try raw PEM first (new approach), fallback to base64 (old approach)
    if (process.env.SWISH_CERT && process.env.SWISH_KEY) {
      cert = process.env.SWISH_CERT;
      key = process.env.SWISH_KEY;
    } else if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
      // Decode base64 to string (PEM format) and ensure proper line endings
      const rawCert = Buffer.from(
        process.env.SWISH_CERT_BASE64,
        "base64"
      ).toString("utf8");
      const rawKey = Buffer.from(
        process.env.SWISH_KEY_BASE64,
        "base64"
      ).toString("utf8");

      // Ensure proper PEM formatting with correct line endings
      cert = rawCert.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      key = rawKey.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    } else {
      throw new Error(
        "Missing certificate environment variables. Need either SWISH_CERT/SWISH_KEY or SWISH_CERT_BASE64/SWISH_KEY_BASE64"
      );
    }

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
  } else {
    if (!process.env.SWISH_CERT_PATH || !process.env.SWISH_KEY_PATH) {
      throw new Error(
        "Missing SWISH_CERT_PATH or SWISH_KEY_PATH environment variables"
      );
    }

    const certPath = path.resolve(__dirname, process.env.SWISH_CERT_PATH);
    const keyPath = path.resolve(__dirname, process.env.SWISH_KEY_PATH);

    cert = fs.readFileSync(certPath);
    key = fs.readFileSync(keyPath);
  }
} catch (error) {
  // In production, we should still start the server but disable Swish functionality
  if (process.env.NODE_ENV === "production") {
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
      secureProtocol: "TLSv1_2_method",
      honorCipherOrder: true,
    });
  } catch (agentError) {
    agent = null;
  }
}

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
      required: ["phoneNumber", "amount"],
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

  // Update payment status in store
  if (paymentStore.has(id)) {
    const paymentData = paymentStore.get(id);
    paymentData.status = status;
    paymentData.paymentReference = paymentReference;
    paymentData.completedAt = new Date().toISOString();
    paymentStore.set(id, paymentData);
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

  const response = await axios.put(`${apiUrl}/${uuid}`, payload, {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response;
}

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

function handleSwishApiError(error, res) {
  const errorMessage =
    error.response?.data?.message ||
    error.message ||
    "Failed to create Swish payment";
  const statusCode = error.response?.status || 500;

  res.status(statusCode).json({
    error: errorMessage,
    details: isDevelopment
      ? error.response?.data || error.message
      : "Internal server error",
    timestamp: new Date().toISOString(),
  });
}

// Catch-all handler: serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
