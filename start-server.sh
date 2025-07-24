#!/bin/bash

# Swish Payment API Server Startup Script

# Kill any existing node processes that might be blocking the port
echo "🧹 Cleaning up existing processes..."
pkill -f "node.*server" || true

# Wait for processes to terminate
sleep 2

# Start the server
echo "🚀 Starting Swish Payment API server..."
node server.js
