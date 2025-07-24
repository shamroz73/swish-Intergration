#!/bin/bash

echo "🧪 Testing API Connection"
echo "========================"

# Test if server is running
if curl -s http://localhost:3002/health > /dev/null 2>&1; then
    echo "✅ Server is responding on port 3002"
else
    echo "❌ Server not responding on port 3002"
    echo "Make sure to run: ./start-server.sh first"
    exit 1
fi

echo ""

# Test the actual payment endpoint
echo "Testing payment endpoint..."
curl -X POST http://localhost:3002/api/create-swish-payment \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "1234567890",
    "amount": "100"
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "If you see a 422 error above, check the server logs for details."
