import express from "express";
import { updatePaymentFromCallback } from "../utils/index.js";

const router = express.Router();

/**
 * Handle Swish Callback
 * POST /api/swish/callback
 */
router.post("/callback", (req, res) => {
  console.log("🔔 Swish callback received:", req.body);
  
  const { id, payeePaymentReference, status, paymentReference } = req.body;

  if (!id) {
    console.error("❌ Missing payment ID in callback");
    return res.status(400).json({ error: "Missing payment ID" });
  }

  console.log(`📝 Updating payment ${id} with status: ${status}`);

  // Update payment status in store
  const updated = updatePaymentFromCallback(id, { status, paymentReference });
  
  if (updated) {
    console.log("✅ Payment status updated successfully");
  } else {
    console.log("⚠️  Payment not found in local store");
  }

  res.status(200).json({ message: "Callback processed successfully" });
});

export default router;
