require("dotenv").config();
const express = require("express");
const fs = require("fs");
const https = require("https");
const axios = require("axios");
const crypto = require("crypto");
const path = require("path");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Store payment data in memory (use database in production)
const paymentStore = new Map();

// Serve static files from React build
app.use(express.static(path.join(__dirname, "client/build")));

// ✅ Load Production TLS certificate & private key
let cert, key;

console.log("🔧 Environment check:", {
  isVercel: !!process.env.VERCEL,
  hasCallbackUrl: !!process.env.SWISH_CALLBACK_URL,
  hasPayeeAlias: !!process.env.SWISH_PAYEE_ALIAS,
  hasApiUrl: !!process.env.SWISH_API_URL,
  hasCertBase64: !!process.env.SWISH_CERT_BASE64,
  hasKeyBase64: !!process.env.SWISH_KEY_BASE64,
  certBase64Length: process.env.SWISH_CERT_BASE64?.length || 0,
  keyBase64Length: process.env.SWISH_KEY_BASE64?.length || 0,
});

if (process.env.VERCEL) {
  // For Vercel deployment - use base64 encoded certificates from environment variables
  console.log(
    "🌟 Running on Vercel - loading certificates from environment variables"
  );
  cert = Buffer.from(process.env.SWISH_CERT_BASE64 || "", "base64");
  key = Buffer.from(process.env.SWISH_KEY_BASE64 || "", "base64");

  console.log("📜 Certificate loaded:", {
    certSize: cert.length,
    keySize: key.length,
  });
} else {
  console.log("💻 Running locally - loading certificates from files");
  // For local development - use file paths
  cert = fs.readFileSync(path.resolve(__dirname, process.env.SWISH_CERT_PATH));
  key = fs.readFileSync(path.resolve(__dirname, process.env.SWISH_KEY_PATH));
}

const agent = new https.Agent({
  cert,
  key,
  rejectUnauthorized: true,
});

//  Test route
app.get("/", (req, res) => {
  res.send("🚀 Swish Payment API (Production) is running");
});

// 🔹 Test callback endpoint (for debugging)
app.post("/test-callback", (req, res) => {
  console.log("🧪 Test callback received:", JSON.stringify(req.body, null, 2));
  res.status(200).json({ message: "Test callback received successfully" });
});

// 🔹 Manual status update (for testing without callback)
app.post("/api/manual-status/:token", (req, res) => {
  const { token } = req.params;
  const { status } = req.body;

  console.log(`🔧 Manual status update: ${token} -> ${status}`);

  if (paymentStore.has(token)) {
    const paymentData = paymentStore.get(token);
    paymentData.status = status;
    paymentData.completedAt = new Date().toISOString();
    paymentStore.set(token, paymentData);

    res.json({ message: `Status updated to ${status}`, paymentData });
  } else {
    res.status(404).json({ error: "Payment not found" });
  }
});

//  Route: Create Swish Payment
app.post("/api/create-swish-payment", async (req, res) => {
  console.log("🚀 Payment request received:", req.body);

  const { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    console.log("❌ Missing required fields:", { phoneNumber, amount });
    return res.status(400).json({ error: "Missing phoneNumber or amount" });
  }

  try {
    // Format: country code + cellphone number (without leading zero)
    // Example: 46712345678 (no + sign, 8-15 digits total)
    let formattedPhone = phoneNumber
      .toString()
      .replace(/\s+/g, "")
      .replace(/^\+/, "");

    // If it starts with 0, remove it (Swedish mobile numbers)
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "46" + formattedPhone.substring(1);
    }

    // If it doesn't start with country code, add 46
    if (!formattedPhone.startsWith("46")) {
      formattedPhone = "46" + formattedPhone;
    }

    // Validate phone number format (8-15 digits, numbers only)
    if (!/^\d{8,15}$/.test(formattedPhone)) {
      return res.status(400).json({
        error: `Invalid phone number format. Must be 8-15 digits, format: country code + cellphone number. Got: ${formattedPhone}`,
      });
    }

    // Generate UUID in correct format: 32 uppercase hex characters (no hyphens)
    const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();

    // Generate a valid Swish Payment Reference (alphanumeric, max 35 chars)
    const paymentReference = `YMP${Date.now()}${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    const payload = {
      payeePaymentReference: paymentReference,
      payerAlias: formattedPhone,
      payeeAlias: process.env.SWISH_PAYEE_ALIAS,
      amount: amount.toString(), // Must be string, not number
      currency: "SEK",
      message: "Payment to Yumplee",
    };

    // Only add callbackUrl if it's set (for production/testing)
    if (process.env.SWISH_CALLBACK_URL) {
      payload.callbackUrl = process.env.SWISH_CALLBACK_URL;
    }

    // Use correct Swish API endpoint
    const apiUrl = `${process.env.SWISH_API_URL}/swish-cpcapi/api/v2/paymentrequests`;

    console.log("🌐 Making request to Swish API:", {
      url: `${apiUrl}/${uuid}`,
      payload,
      hasAgent: !!agent,
      hasCert: !!cert,
      hasKey: !!key,
      certLength: cert?.length,
      keyLength: key?.length,
    });

    const response = await axios.put(`${apiUrl}/${uuid}`, payload, {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("✅ Swish API response:", response.status, response.data);

    // Store payment data for status tracking
    paymentStore.set(uuid, {
      token: uuid,
      paymentRequestToken: response.data.id || uuid,
      status: "CREATED",
      phoneNumber: formattedPhone,
      amount: amount.toString(),
      payeePaymentReference: paymentReference,
      createdAt: new Date().toISOString(),
    });

    res.status(200).json({
      token: uuid,
      paymentRequestToken: response.data.id || uuid,
      status: "created",
    });
  } catch (error) {
    console.error("❌ Swish API Error Details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      code: error.code,
      stack: error.stack,
    });

    // Return more specific error information
    const errorMessage =
      error.response?.data?.message ||
      error.message ||
      "Failed to create Swish payment";
    const statusCode = error.response?.status || 500;

    res.status(statusCode).json({
      error: errorMessage,
      details: error.response?.data || "Internal server error",
    });
  }
});

// 🔹 Route: Handle Swish Callback
app.post("/api/swish/callback", (req, res) => {
  console.log("📩 Swish callback received:", JSON.stringify(req.body, null, 2));

  // Extract payment information from callback
  const { id, payeePaymentReference, status, paymentReference } = req.body;

  console.log(`🔍 Looking for payment with ID: ${id}`);
  console.log(
    `📋 Available payments in store:`,
    Array.from(paymentStore.keys())
  );

  // Update payment status in store
  if (paymentStore.has(id)) {
    const paymentData = paymentStore.get(id);
    console.log(`📝 Current payment data:`, paymentData);

    paymentData.status = status;
    paymentData.paymentReference = paymentReference;
    paymentData.completedAt = new Date().toISOString();
    paymentStore.set(id, paymentData);

    console.log(`✅ Payment ${id} updated to status: ${status}`);
  } else {
    console.log(`❌ Payment ${id} not found in local store`);
  }

  // Respond to Swish (required)
  res.status(200).json({ message: "Callback processed successfully" });
});

// 🔹 Route: Get Payment Status
app.get("/api/payment-status/:token", (req, res) => {
  const { token } = req.params;

  if (paymentStore.has(token)) {
    const paymentData = paymentStore.get(token);
    res.json(paymentData);
  } else {
    res.status(404).json({ error: "Payment not found" });
  }
});

// Manual testing endpoints
app.post("/api/test/create-payment", async (req, res) => {
  console.log("🧪 Manual test payment creation");

  const { phoneNumber = "46761234567", amount = "10.00" } = req.body;

  // Create a fake payment for testing
  const uuid = crypto.randomUUID().replace(/-/g, "").toUpperCase();

  paymentStore.set(uuid, {
    token: uuid,
    paymentRequestToken: uuid,
    status: "CREATED",
    phoneNumber,
    amount,
    payeePaymentReference: `TEST${Date.now()}`,
    createdAt: new Date().toISOString(),
  });

  res.json({
    token: uuid,
    paymentRequestToken: uuid,
    status: "created",
    message: "Test payment created (no actual Swish API call)",
  });
});

app.get("/api/test/payment-status/:token", (req, res) => {
  const { token } = req.params;

  if (paymentStore.has(token)) {
    const paymentData = paymentStore.get(token);
    res.json(paymentData);
  } else {
    res.status(404).json({ error: "Test payment not found" });
  }
});

// Catch-all handler: send back React's index.html file.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname + "/client/build/index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`📧 Callback URL: ${process.env.SWISH_CALLBACK_URL}`);
});
