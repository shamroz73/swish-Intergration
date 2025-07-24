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

    console.log('Swish callback received:', {
      method: req.method,
      headers: req.headers,
      body: req.body,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    // Handle callback from Swish
    if (req.method === 'POST') {
      // Payment status update from Swish
      const callbackData = req.body;
      
      // Log the callback for debugging
      console.log('Payment status callback:', callbackData);
      
      // In a real application, you would:
      // 1. Validate the callback authenticity
      // 2. Update payment status in your database
      // 3. Notify your application/user about the payment status
      
      res.status(200).json({
        success: true,
        message: 'Callback received',
        timestamp: new Date().toISOString()
      });
    } else if (req.method === 'GET') {
      // Health check or status endpoint
      res.status(200).json({
        status: 'Callback endpoint is working',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
