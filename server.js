import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import configuration
import config from "./config/index.js";

// Import utilities
import { loadCertificates, createHttpsAgent } from "./utils/certUtils.js";

// Import routes
import paymentRoutes from "./routes/payment.js";
import swishRoutes from "./routes/swish.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "client/build")));

// Initialize certificates and HTTPS agent
console.log("🚀 Initializing Swish certificates...");
const { cert, key } = loadCertificates();
const agent = createHttpsAgent(cert, key);

// Store agent in app locals for route access
app.locals.agent = agent;

// Log the final state
if (agent) {
  console.log("✅ Swish HTTPS agent created successfully");
} else {
  console.log("⚠️ No HTTPS agent created - Swish API calls will fail");
  console.log(
    "⚠️ Starting server without Swish certificates - API will be disabled"
  );
}

// Root endpoint serves React app
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

// API Routes
app.use("/api", paymentRoutes);
app.use("/api/swish", swishRoutes);

// Catch-all handler: serve React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "client/build/index.html"));
});

// Start server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
