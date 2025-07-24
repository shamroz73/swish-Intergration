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
  getAllPayments,
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
    // Note: Using v2 API for PUT requests (payment creation) as v1 is deprecated
    // v1 is still used for GET/PATCH requests (status checking)
    console.log(`🚀 Creating Swish payment with UUID: ${uuid}`);
    const response = await makeSwishApiRequest(
      uuid,
      payload,
      req.app.locals.agent
    );

    console.log(`📥 Swish API response status: ${response.status}`);
    console.log(`📥 Swish API response headers:`, response.headers);
    console.log(`📥 Swish API response data:`, response.data);

    const swishPaymentId = response.data?.id || uuid;
    console.log(`🔗 Using Swish payment ID: ${swishPaymentId} (UUID: ${uuid})`);

    // Store payment data for tracking
    storePaymentData(uuid, {
      paymentRequestToken: swishPaymentId,
      phoneNumber: formattedPhone,
      amount: amount.toString(),
      paymentReference,
    });

    res.status(200).json({
      token: uuid,
      paymentRequestToken: swishPaymentId,
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

    // Check if payment is old and still CREATED (likely cancelled)
    const createdAt = new Date(paymentData.createdAt);
    const now = new Date();
    const ageInMinutes = (now - createdAt) / (1000 * 60);
    const ageInSeconds = (now - createdAt) / 1000;

    // RAPID CANCELLATION DETECTION: Mark as cancelled after just 45 seconds if still CREATED
    if (paymentData.status === "CREATED" && ageInSeconds > 45) {
      console.log(
        `⚡ RAPID: Payment ${token} is older than 45 seconds and still CREATED - marking as CANCELLED`
      );

      const updated = updatePaymentFromCallback(
        paymentData.paymentRequestToken,
        {
          status: "CANCELLED",
          paymentReference: paymentData.payeePaymentReference,
        }
      );

      if (updated) {
        const updatedData = getPaymentData(token);
        console.log(
          `✅ Payment ${token} rapidly marked as CANCELLED (45s timeout)`
        );
        return res.json(updatedData);
      }
    }

    // Secondary check: If payment is older than 2 minutes and still CREATED
    if (paymentData.status === "CREATED" && ageInMinutes > 2) {
      console.log(
        `⏰ Payment ${token} is older than 2 minutes and still CREATED - marking as CANCELLED`
      );

      const updated = updatePaymentFromCallback(
        paymentData.paymentRequestToken,
        {
          status: "CANCELLED",
          paymentReference: paymentData.payeePaymentReference,
        }
      );

      if (updated) {
        const updatedData = getPaymentData(token);
        console.log(`✅ Payment ${token} marked as CANCELLED after 2 minutes`);
        return res.json(updatedData);
      }
    }

    console.log(
      `Returning cached payment data for token: ${token}, status: ${
        paymentData.status
      }, swishId: ${paymentData.paymentRequestToken}, age: ${Math.round(
        ageInMinutes
      )} minutes, ageInSeconds: ${Math.round(ageInSeconds)}`
    );

    // Log additional debugging info
    console.log(`📊 Payment Debug Info:`);
    console.log(`   - Token: ${token}`);
    console.log(`   - Swish ID: ${paymentData.paymentRequestToken}`);
    console.log(`   - Status: ${paymentData.status}`);
    console.log(`   - Created: ${paymentData.createdAt}`);
    console.log(
      `   - Age: ${Math.round(ageInMinutes)} minutes (${Math.round(
        ageInSeconds
      )} seconds)`
    );
    console.log(`   - Payment Reference: ${paymentData.payeePaymentReference}`);
    console.log(
      `   - Callback URL configured: ${
        process.env.SWISH_CALLBACK_URL ? "YES" : "NO"
      }`
    );
    if (process.env.SWISH_CALLBACK_URL) {
      console.log(`   - Callback URL: ${process.env.SWISH_CALLBACK_URL}`);
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

/**
 * Debug endpoint to show all stored payments
 * GET /api/debug/payments
 */
router.get("/debug/payments", (req, res) => {
  try {
    const allPayments = getAllPayments();
    console.log("🔍 Debug: All stored payments:", allPayments);
    res.json(allPayments);
  } catch (error) {
    console.error("Error in debug endpoint:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Test callback functionality
 * POST /api/test/callback/:token
 */
router.post("/test/callback/:token", (req, res) => {
  const { token } = req.params;
  const { status = "PAID" } = req.body;

  try {
    // Get the payment data to find the Swish payment ID
    const paymentData = getPaymentData(token);
    if (!paymentData) {
      return res.status(404).json({ error: "Payment not found" });
    }

    console.log(
      `🧪 Testing callback for token: ${token}, swishId: ${paymentData.paymentRequestToken}`
    );

    // Simulate a callback by updating the payment status
    const updated = updatePaymentFromCallback(paymentData.paymentRequestToken, {
      status,
      paymentReference: paymentData.payeePaymentReference,
    });

    if (updated) {
      console.log("✅ Test callback processed successfully");
      res.json({ message: "Test callback processed successfully", status });
    } else {
      console.log("❌ Test callback failed - payment not found");
      res.status(500).json({ error: "Test callback failed" });
    }
  } catch (error) {
    console.error("Error in test callback:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * Cancel payment manually
 * POST /api/cancel-payment/:token
 */
router.post("/cancel-payment/:token", (req, res) => {
  const { token } = req.params;

  try {
    // Get the payment data
    const paymentData = getPaymentData(token);
    if (!paymentData) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // Only allow cancellation if payment is still CREATED
    if (paymentData.status !== "CREATED") {
      return res.status(400).json({
        error: "Payment cannot be cancelled",
        currentStatus: paymentData.status,
      });
    }

    console.log(`🚫 Manual cancellation requested for token: ${token}`);

    // Update payment status to CANCELLED
    const updated = updatePaymentFromCallback(paymentData.paymentRequestToken, {
      status: "CANCELLED",
      paymentReference: paymentData.payeePaymentReference,
    });

    if (updated) {
      const updatedData = getPaymentData(token);
      console.log("✅ Payment manually cancelled successfully");
      res.json({
        message: "Payment cancelled successfully",
        payment: updatedData,
      });
    } else {
      console.log("❌ Manual cancellation failed");
      res.status(500).json({ error: "Failed to cancel payment" });
    }
  } catch (error) {
    console.error("Error in manual cancellation:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
