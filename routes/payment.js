import express from "express";
import {
  formatPhoneNumber,
  isValidPhoneNumber,
  generatePaymentUUID,
  generatePaymentReference,
  createPaymentPayload,
  makeSwishApiRequest,
  handleSwishApiError,
  storePaymentData,
  getPaymentData,
  updatePaymentFromCallback,
  checkSwishPaymentStatus,
} from "../utils/index.js";

const router = express.Router();

/**
 * Create Swish Payment
 * POST /api/create-swish-payment
 */
router.post("/create-swish-payment", async (req, res) => {
  // Check if Swish API is available
  if (!req.app.locals.agent) {
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
    const uuid = generatePaymentUUID();
    const paymentReference = generatePaymentReference();

    // Prepare payment payload
    const payload = createPaymentPayload({
      paymentReference,
      formattedPhone,
      amount: amount.toString(),
    });

    // Make request to Swish API
    const response = await makeSwishApiRequest(
      uuid,
      payload,
      req.app.locals.agent
    );

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
