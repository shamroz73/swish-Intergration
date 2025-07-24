import express from "express";
import { updatePaymentFromCallback, checkSwishPaymentStatus } from "../utils/index.js";

const router = express.Router();

// Middleware to log all requests to swish routes
router.use((req, res, next) => {
  console.log("🌐 === SWISH ROUTE ACCESS ===");
  console.log("🕐 Timestamp:", new Date().toISOString());
  console.log("🔗 Method:", req.method);
  console.log("🔗 Path:", req.path);
  console.log("🔗 Original URL:", req.originalUrl);
  console.log("🔗 Full URL:", req.protocol + '://' + req.get('host') + req.originalUrl);
  console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
  console.log("📋 User Agent:", req.get('User-Agent'));
  console.log("📋 IP:", req.ip || req.connection.remoteAddress);
  if (req.method === 'POST') {
    console.log("📋 Body:", JSON.stringify(req.body, null, 2));
  }
  console.log("🌐 === END SWISH ROUTE LOG ===");
  next();
});

/**
 * Test endpoint to manually trigger callback (for debugging)
 * POST /api/swish/test-callback
 */
router.post("/test-callback", (req, res) => {
  console.log("🧪 Manual callback test triggered");
  
  // Simulate a Swish callback
  const testPayload = {
    id: req.body.id || "87798FE057864788B500D587AA0F0361", // Use the payment ID from your logs
    status: req.body.status || "PAID",
    paymentReference: req.body.paymentReference || "test-reference"
  };
  
  console.log("🧪 Test payload:", JSON.stringify(testPayload, null, 2));
  
  // Process like a real callback
  const updated = updatePaymentFromCallback(testPayload.id, {
    status: testPayload.status,
    paymentReference: testPayload.paymentReference
  });
  
  res.json({
    message: "Test callback executed",
    payload: testPayload,
    updated,
    timestamp: new Date().toISOString()
  });
});

/**
 * Check payment status directly from Swish API (for debugging)
 * GET /api/swish/check-status/:paymentId
 */
router.get("/check-status/:paymentId", async (req, res) => {
  const { paymentId } = req.params;
  
  console.log(`🔍 Manual Swish API status check for payment: ${paymentId}`);
  
  if (!req.app.locals.agent) {
    return res.status(503).json({
      error: "Swish API agent not available",
      message: "Certificate configuration is missing"
    });
  }
  
  try {
    const result = await checkSwishPaymentStatus(paymentId, req.app.locals.agent);
    console.log(`🔍 Swish API check result:`, result);
    
    res.json({
      paymentId,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`❌ Error checking Swish payment status:`, error);
    res.status(500).json({
      error: "Failed to check payment status",
      details: error.message,
      paymentId
    });
  }
});

/**
 * Environment debug endpoint - real-time environment check
 * GET /api/swish/env-debug
 */
router.get("/env-debug", (req, res) => {
  console.log("🔬 Environment debug check requested");
  
  const envDebug = {
    timestamp: new Date().toISOString(),
    processEnv: {
      NODE_ENV: process.env.NODE_ENV,
      VERCEL: process.env.VERCEL,
      SWISH_API_URL: !!process.env.SWISH_API_URL,
      SWISH_PAYEE_ALIAS: !!process.env.SWISH_PAYEE_ALIAS,
      SWISH_CALLBACK_URL: !!process.env.SWISH_CALLBACK_URL,
      SWISH_CERT_BASE64: !!process.env.SWISH_CERT_BASE64,
      SWISH_KEY_BASE64: !!process.env.SWISH_KEY_BASE64,
    },
    envLengths: {
      SWISH_CERT_BASE64: process.env.SWISH_CERT_BASE64?.length || 0,
      SWISH_KEY_BASE64: process.env.SWISH_KEY_BASE64?.length || 0,
      SWISH_API_URL: process.env.SWISH_API_URL?.length || 0,
      SWISH_CALLBACK_URL: process.env.SWISH_CALLBACK_URL?.length || 0,
    },
    agent: {
      available: !!req.app.locals.agent,
      type: typeof req.app.locals.agent,
    },
    actualValues: {
      callbackUrl: process.env.SWISH_CALLBACK_URL,
      apiUrl: process.env.SWISH_API_URL,
    }
  };
  
  console.log("🔬 Environment debug:", JSON.stringify(envDebug, null, 2));
  
  res.json(envDebug);
});

/**
 * System status endpoint - check Swish integration health
 * GET /api/swish/status
 */
router.get("/status", (req, res) => {
  console.log("🏥 System status check requested");
  
  const status = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    isVercel: !!process.env.VERCEL,
    swishConfig: {
      apiUrl: !!process.env.SWISH_API_URL,
      payeeAlias: !!process.env.SWISH_PAYEE_ALIAS,
      callbackUrl: !!process.env.SWISH_CALLBACK_URL,
      callbackUrlValue: process.env.SWISH_CALLBACK_URL || 'NOT_SET',
    },
    apiVersions: {
      createPayment: 'v2', // PUT requests for payment creation
      checkStatus: 'v1',   // GET requests for status checking
      note: 'v1 deprecated 2025-10-01, using v2 for PUT, v1 for GET/PATCH'
    },
    certificates: {
      certBase64Available: !!process.env.SWISH_CERT_BASE64,
      keyBase64Available: !!process.env.SWISH_KEY_BASE64,
      certLength: process.env.SWISH_CERT_BASE64?.length || 0,
      keyLength: process.env.SWISH_KEY_BASE64?.length || 0,
    },
    agent: !!req.app.locals.agent,
    routes: {
      callback: '/api/swish/callback',
      test: '/api/swish/test',
      status: '/api/swish/status',
    }
  };
  
  console.log("🏥 System status:", JSON.stringify(status, null, 2));
  
  res.json(status);
});

/**
 * Test endpoint to verify callback route is working
 * GET /api/swish/test
 */
router.get("/test", (req, res) => {
  console.log("🧪 Test endpoint hit at:", new Date().toISOString());
  res.json({
    message: "Callback route is working",
    timestamp: new Date().toISOString(),
    path: req.path,
    url: req.url,
  });
});

/**
 * Simple ping endpoint that Swish might use to verify callback URL
 * GET /api/swish/callback (some providers test with GET before using POST)
 */
router.get("/callback", (req, res) => {
  console.log(
    "🔍 GET request to callback endpoint - this might be Swish testing the URL"
  );
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  console.log("Query params:", req.query);

  res.status(200).json({
    message: "Callback endpoint is accessible",
    method: "GET",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Handle Swish Callback
 * POST /api/swish/callback
 */
router.post("/callback", (req, res) => {
  const timestamp = new Date().toISOString();
  console.log("🔔 === SWISH CALLBACK RECEIVED ===");
  console.log("🕐 Timestamp:", timestamp);
  console.log("🔗 URL:", req.url);
  console.log("🔗 Full URL:", req.protocol + '://' + req.get('host') + req.originalUrl);
  console.log("📋 Method:", req.method);
  console.log("📋 Headers:", JSON.stringify(req.headers, null, 2));
  console.log("📋 Body:", JSON.stringify(req.body, null, 2));
  console.log("📋 Query:", JSON.stringify(req.query, null, 2));
  console.log("📋 Params:", JSON.stringify(req.params, null, 2));

  const { id, payeePaymentReference, status, paymentReference } = req.body;

  if (!id) {
    console.error("❌ Missing payment ID in callback");
    console.log("❌ Available body keys:", Object.keys(req.body));
    return res.status(400).json({ error: "Missing payment ID" });
  }

  console.log(
    `📝 Processing callback for Swish payment ID: ${id}, status: ${status}`
  );

  // Update payment status in store
  const updated = updatePaymentFromCallback(id, { status, paymentReference });

  if (updated) {
    console.log("✅ Payment status updated successfully in store");
  } else {
    console.log(
      "⚠️  Payment not found in local store - this might indicate an ID mismatch"
    );
  }

  console.log("🔔 === CALLBACK PROCESSING COMPLETE ===");
  res.status(200).json({ message: "Callback processed successfully", timestamp });
});

export default router;
