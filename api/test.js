// Simple test endpoint that doesn't use certificates
export default function handler(req, res) {
  res.status(200).json({
    message: "Test endpoint working!",
    timestamp: new Date().toISOString(),
    environment: {
      hasSwishCert: !!process.env.SWISH_CERT_BASE64,
      hasSwishKey: !!process.env.SWISH_KEY_BASE64,
      certLength: process.env.SWISH_CERT_BASE64?.length || 0,
      keyLength: process.env.SWISH_KEY_BASE64?.length || 0,
    }
  });
}
