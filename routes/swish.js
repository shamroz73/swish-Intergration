import express from "express";
import { updatePaymentFromCallback, getPaymentData } from "../utils/index.js";

const router = express.Router();

/**
 * Handle Swish Callback
 * POST /api/swish/callback
 */
router.post("/callback", (req, res) => {
  const { id, payeePaymentReference, status, paymentReference } = req.body;

  // Update payment status in store
  updatePaymentFromCallback(id, { status, paymentReference });

  res.status(200).json({ message: "Callback processed successfully" });
});

/**
 * Get Payment Status
 * GET /api/payment-status/:token
 */
router.get("/payment-status/:token", (req, res) => {
  const { token } = req.params;

  const paymentData = getPaymentData(token);
  if (paymentData) {
    res.json(paymentData);
  } else {
    res.status(404).json({ error: "Payment not found" });
  }
});

export default router;
