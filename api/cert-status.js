const fs = require("fs");

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Check which certificate method is available
    const rawCert = process.env.SWISH_CERT;
    const rawKey = process.env.SWISH_KEY;
    const base64Cert = process.env.SWISH_CERT_BASE64;
    const base64Key = process.env.SWISH_KEY_BASE64;

    const status = {
      timestamp: new Date().toISOString(),
      rawPemAvailable: !!(rawCert && rawKey),
      base64Available: !!(base64Cert && base64Key),
      rawCertLength: rawCert ? rawCert.length : 0,
      rawKeyLength: rawKey ? rawKey.length : 0,
      base64CertLength: base64Cert ? base64Cert.length : 0,
      base64KeyLength: base64Key ? base64Key.length : 0,
      rawCertStart: rawCert ? rawCert.substring(0, 50) + "..." : "N/A",
      rawKeyStart: rawKey ? rawKey.substring(0, 50) + "..." : "N/A",
      rawCertEnd: rawCert
        ? "..." + rawCert.substring(rawCert.length - 50)
        : "N/A",
      rawKeyEnd: rawKey ? "..." + rawKey.substring(rawKey.length - 50) : "N/A",
    };

    // Try to validate the raw PEM certificates
    if (rawCert && rawKey) {
      try {
        const https = require("https");

        // Test certificate parsing
        const agent = new https.Agent({
          cert: rawCert,
          key: rawKey,
          rejectUnauthorized: false,
        });

        status.rawPemValid = true;
        status.message = "Raw PEM certificates loaded successfully";
      } catch (certError) {
        status.rawPemValid = false;
        status.rawPemError = certError.message;
      }
    }

    res.status(200).json(status);
  } catch (error) {
    console.error("Cert status error:", error);
    res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};
