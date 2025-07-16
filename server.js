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

// ✅ Load Production TLS certificate & private key
const cert = fs.readFileSync(
  path.resolve(__dirname, process.env.SWISH_CERT_PATH)
);
const key = fs.readFileSync(
  path.resolve(__dirname, process.env.SWISH_KEY_PATH)
);

const agent = new https.Agent({
  cert,
  key,
  rejectUnauthorized: true,
});

//  Test route
app.get("/", (req, res) => {
  res.send("🚀 Swish Payment API (Production) is running");
});

//  Route: Create Swish Payment
app.post("/api/create-swish-payment", async (req, res) => {
  const { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Missing phoneNumber or amount" });
  }

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
    callbackUrl: process.env.SWISH_CALLBACK_URL,
    payerAlias: formattedPhone,
    payeeAlias: process.env.SWISH_PAYEE_ALIAS,
    amount: amount.toString(), // Must be string, not number
    currency: "SEK",
    message: "Payment to Yumplee",
  };

  // Use correct Swish API endpoint
  const apiUrl = `${process.env.SWISH_API_URL}/swish-cpcapi/api/v2/paymentrequests`;

  try {
    const response = await axios.put(`${apiUrl}/${uuid}`, payload, {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json",
      },
    });

    res.status(200).json({
      token: uuid,
      paymentRequestToken: response.data.id || uuid,
      status: "created",
    });
  } catch (error) {
    console.error("❌ Swish error:", error.response?.data || error.message);
    res.status(500).json({ error: "Failed to create Swish payment" });
  }
});

// 🔹 Route: Handle Swish Callback
app.post("/swish-callback", (req, res) => {
  console.log("📩 Swish callback received:", req.body);
  // TODO: Save payment result to your DB or update order status

  res.status(200).send(); // Required: Swish expects HTTP 200 OK
});

// 🔹 Start the server
app.listen(PORT, () => {
  console.log(`✅ Server running in PRODUCTION at http://localhost:${PORT}`);
});
