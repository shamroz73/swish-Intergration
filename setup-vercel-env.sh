#!/bin/bash

# Vercel Environment Variables Setup Script
echo "Setting up Vercel environment variables..."

# Check if base64 certificate files exist
if [ ! -f "cert.base64" ]; then
    echo "Creating base64 encoded certificate..."
    base64 -i certs/swish_certificate_202507071452.pem | tr -d '\n' > cert.base64
fi

if [ ! -f "key.base64" ]; then
    echo "Creating base64 encoded private key..."
    base64 -i certs/client_tls_private_key.pem | tr -d '\n' > key.base64
fi

# Set environment variables
echo "Setting SWISH_API_URL..."
echo "https://cpc.getswish.net" | vercel env add SWISH_API_URL production

echo "Setting SWISH_PAYEE_ALIAS..."
echo "1232475101" | vercel env add SWISH_PAYEE_ALIAS production

echo "Setting SWISH_CERT_BASE64..."
cat cert.base64 | vercel env add SWISH_CERT_BASE64 production

echo "Setting SWISH_KEY_BASE64..."
cat key.base64 | vercel env add SWISH_KEY_BASE64 production

echo "Environment variables setup complete!"
echo "Note: SWISH_CALLBACK_URL will be set after deployment with your actual Vercel URL."
echo "Current production URL: https://swisp-lw54by11b-shamroz-warraichs-projects.vercel.app"
