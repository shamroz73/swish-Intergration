import express from "express";
import { updatePaymentFromCallback } from "../utils/index.js";

const router = express.Router();

/**
 * Handle Swish Callback
 * POST /api/swish/callback
 */
router.post("/callback", (req, res) => {
  console.log("🔔 Swish callback received at:", new Date().toISOString());
  console.log("📋 Callback body:", JSON.stringify(req.body, null, 2));

  const { id, payeePaymentReference, status, paymentReference } = req.body;

  if (!id) {
    console.error("❌ Missing payment ID in callback");
    return res.status(400).json({ error: "Missing payment ID" });
  }

  console.log(`📝 Processing callback for Swish payment ID: ${id}, status: ${status}`);

  // Update payment status in store
  const updated = updatePaymentFromCallback(id, { status, paymentReference });

  if (updated) {
    console.log("✅ Payment status updated successfully in store");
  } else {
    console.log("⚠️  Payment not found in local store - this might indicate an ID mismatch");
  }

  res.status(200).json({ message: "Callback processed successfully" });
});

export default router;
