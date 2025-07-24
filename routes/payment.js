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

export default router;
