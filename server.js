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

// 🔹 Test route
app.get("/", (req, res) => {
  res.send("🚀 Swish Payment API (Production) is running");
});

// 🔹 Route: Create Swish Payment
app.post("/api/create-swish-payment", async (req, res) => {
  const { phoneNumber, amount } = req.body;

  if (!phoneNumber || !amount) {
    return res.status(400).json({ error: "Missing phoneNumber or amount" });
  }

  const uuid = crypto.randomUUID();

  const payload = {
    payeePaymentReference: uuid,
    callbackUrl: process.env.SWISH_CALLBACK_URL,
    payerAlias: phoneNumber,
    payeeAlias: process.env.SWISH_PAYEE_ALIAS,
    amount: amount.toFixed(2),
    currency: "SEK",
    message: "Payment to Yumplee",
  };

  const apiUrl = process.env.SWISH_API_URL;

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
