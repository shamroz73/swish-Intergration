import express from "express";
import { updatePaymentFromCallback } from "../utils/index.js";

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

export default router;
