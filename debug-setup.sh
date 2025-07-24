#!/bin/bash

echo "🔍 Debugging Local Development Setup"
echo "======================================"

# Check if port 3002 is free
echo "1. Checking port 3002 availability..."
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port 3002 is in use"
    echo "Processes using port 3002:"
    lsof -Pi :3002 -sTCP:LISTEN
else
    echo "✅ Port 3002 is available"
fi

echo ""

# Check if React is running on 3001
echo "2. Checking React app on port 3001..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ React app appears to be running on port 3001"
else
    echo "❌ No service found on port 3001 - you may need to start React"
fi

echo ""

# Check package.json proxy
echo "3. Checking proxy configuration..."
if grep -q '"proxy": "http://localhost:3002"' client/package.json; then
    echo "✅ Proxy is configured to localhost:3002"
else
    echo "❌ Proxy configuration issue in client/package.json"
fi

echo ""

# Check server.js port
echo "4. Checking server.js port configuration..."
if grep -q "process.env.PORT || 3002" server.js; then
    echo "✅ Server is configured for port 3002"
else
    echo "❌ Server port configuration issue"
fi

echo ""

# Check if environment file exists
echo "5. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    if grep -q "SWISH_CERTIFICATE" .env; then
        echo "✅ Swish certificate configured in .env"
    else
        echo "⚠️  No Swish certificate found in .env"
    fi
else
    echo "❌ No .env file found"
fi

echo ""
echo "🚀 To fix the 422 error:"
echo "1. Run: chmod +x start-server.sh && ./start-server.sh"
echo "2. Wait for 'Server running on port 3002' message"
echo "3. Keep React running on port 3001"
echo "4. Test the payment form"
