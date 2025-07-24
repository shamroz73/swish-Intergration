const https = require('https');
const fs = require('fs');

module.exports = async (req, res) => {
  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { phoneNumber, amount } = req.body;

    if (!phoneNumber || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        required: ['phoneNumber', 'amount'] 
      });
    }

    // Load certificates - try raw PEM first, then base64 fallback
    let cert, key;
    
    if (process.env.SWISH_CERT && process.env.SWISH_KEY) {
      // Use raw PEM certificates
      cert = process.env.SWISH_CERT;
      key = process.env.SWISH_KEY;
      console.log('Using raw PEM certificates');
    } else if (process.env.SWISH_CERT_BASE64 && process.env.SWISH_KEY_BASE64) {
      // Fallback to base64 certificates
      cert = Buffer.from(process.env.SWISH_CERT_BASE64, 'base64').toString('utf8');
      key = Buffer.from(process.env.SWISH_KEY_BASE64, 'base64').toString('utf8');
      console.log('Using base64 certificates');
    } else {
      return res.status(500).json({ 
        error: 'No certificates configured',
        details: 'Neither raw PEM nor base64 certificates found in environment variables',
        timestamp: new Date().toISOString()
      });
    }

    // Validate certificate format
    if (!cert.includes('-----BEGIN CERTIFICATE-----') || !key.includes('-----BEGIN PRIVATE KEY-----')) {
      return res.status(500).json({ 
        error: 'Invalid certificate format',
        details: 'Certificates must be in PEM format',
        timestamp: new Date().toISOString()
      });
    }

    // Create HTTPS agent with certificates
    const agent = new https.Agent({
      cert: cert,
      key: key,
      rejectUnauthorized: false // For test environment
    });

    // Swish API configuration
    const swishApiUrl = process.env.SWISH_API_URL || 'https://mss.cpc.getswish.net/swish-cpcapi/api/v1/paymentrequests';
    const swishCallbackUrl = process.env.SWISH_CALLBACK_URL || 'https://swish-payment-app.vercel.app/api/callback';
    const swishPayeeAlias = process.env.SWISH_PAYEE_ALIAS || '1234751011';

    // Prepare payment request data
    const paymentData = {
      payeeAlias: swishPayeeAlias,
      amount: amount.toString(),
      currency: 'SEK',
      callbackUrl: swishCallbackUrl,
      payerAlias: phoneNumber,
      message: `Payment of ${amount} SEK`
    };

    console.log('Creating Swish payment request:', {
      url: swishApiUrl,
      data: paymentData,
      certLength: cert.length,
      keyLength: key.length
    });

    // Make request to Swish API
    const data = JSON.stringify(paymentData);
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
      agent: agent
    };

    const swishRequest = https.request(swishApiUrl, options, (swishRes) => {
      let responseData = '';
      
      swishRes.on('data', (chunk) => {
        responseData += chunk;
      });
      
      swishRes.on('end', () => {
        console.log('Swish API response:', {
          statusCode: swishRes.statusCode,
          headers: swishRes.headers,
          data: responseData
        });

        if (swishRes.statusCode === 201) {
          // Success - payment request created
          const location = swishRes.headers.location;
          res.status(201).json({
            success: true,
            message: 'Payment request created successfully',
            paymentId: location ? location.split('/').pop() : null,
            location: location,
            timestamp: new Date().toISOString()
          });
        } else if (swishRes.statusCode === 422) {
          // Unprocessable Entity - validation error
          let errorData;
          try {
            errorData = JSON.parse(responseData);
          } catch (e) {
            errorData = { message: responseData };
          }
          res.status(422).json({
            error: 'Swish API validation error',
            details: errorData,
            timestamp: new Date().toISOString()
          });
        } else {
          // Other errors
          res.status(swishRes.statusCode || 500).json({
            error: 'Swish API error',
            statusCode: swishRes.statusCode,
            details: responseData,
            timestamp: new Date().toISOString()
          });
        }
      });
    });

    swishRequest.on('error', (error) => {
      console.error('Swish API request error:', error);
      res.status(500).json({ 
        error: error.message,
        details: 'Failed to connect to Swish API',
        timestamp: new Date().toISOString()
      });
    });

    swishRequest.write(data);
    swishRequest.end();

  } catch (error) {
    console.error('Payment creation error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
};
