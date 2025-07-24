#!/bin/bash

# Kill any existing node processes that might be blocking the port
echo "Cleaning up existing processes..."
pkill -f "node.*server" || true

# Wait a moment for processes to terminate
sleep 2

# Start the server
echo "Starting server on port 3001..."
cd /Users/shamroz.warraich/Projects/Full_stack_test/my-app
node server.js
