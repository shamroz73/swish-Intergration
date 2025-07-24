import express from "express";
import { 
  updatePaymentFromCallback, 
  getPaymentData, 
  checkSwishPaymentStatus,
  storePaymentData 
} from "../utils/index.js";

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
router.get("/payment-status/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const paymentData = getPaymentData(token);
    if (!paymentData) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // If payment is still in CREATED status, check with Swish API for updates
    if (paymentData.status === "CREATED" && req.app.locals.agent) {
      try {
        const swishStatus = await checkSwishPaymentStatus(
          paymentData.paymentRequestToken,
          req.app.locals.agent
        );

        if (swishStatus.success) {
          // Update local payment data with Swish status
          const updatedData = {
            ...paymentData,
            status: swishStatus.data.status,
            updatedAt: new Date().toISOString(),
          };

          // Store the updated status
          updatePaymentFromCallback(token, {
            status: swishStatus.data.status,
            paymentReference: swishStatus.data.paymentReference,
          });

          return res.json(updatedData);
        } else if (swishStatus.status === "NOT_FOUND") {
          // Payment request not found in Swish - likely cancelled or expired
          const updatedData = {
            ...paymentData,
            status: "CANCELLED",
            updatedAt: new Date().toISOString(),
          };

          updatePaymentFromCallback(token, {
            status: "CANCELLED",
            paymentReference: paymentData.payeePaymentReference,
          });

          return res.json(updatedData);
        }
      } catch (error) {
        console.error("Error checking Swish payment status:", error);
        // Continue with cached data if Swish API check fails
      }
    }

    // Return cached payment data
    res.json(paymentData);
  } catch (error) {
    console.error("Error getting payment status:", error);
    res.status(500).json({ 
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
