#!/bin/bash

# Script to generate base64 encoded certificates for environment variables
# This script creates properly formatted base64 strings that work in both local and Vercel environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔐 Certificate Base64 Generator${NC}"
echo "================================"

# Check if we're in the correct directory
if [ ! -f "../../certs/swish_certificate_202507071452.pem" ] || [ ! -f "../../certs/client_tls_private_key.pem" ]; then
    echo -e "${RED}❌ Error: Certificate files not found in certs/ directory${NC}"
    echo "Expected files:"
    echo "  - certs/swish_certificate_202507071452.pem"
    echo "  - certs/client_tls_private_key.pem"
    exit 1
fi

# Create output directory
mkdir -p ./base64-output

echo -e "${YELLOW}📋 Generating base64 encoded certificates...${NC}"

# Generate base64 for certificate (single line for Vercel compatibility)
echo "Converting certificate..."
if command -v base64 >/dev/null 2>&1; then
    # Check if we're on macOS (no -w flag) or Linux (-w flag available)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        cert_base64=$(cat ../../certs/swish_certificate_202507071452.pem | base64 | tr -d '\n')
        key_base64=$(cat ../../certs/client_tls_private_key.pem | base64 | tr -d '\n')
    else
        # Linux/other
        cert_base64=$(base64 -w 0 ../../certs/swish_certificate_202507071452.pem)
        key_base64=$(base64 -w 0 ../../certs/client_tls_private_key.pem)
    fi
else
    echo -e "${RED}❌ Error: base64 command not found${NC}"
    exit 1
fi

# Create .env file for local development
echo -e "${YELLOW}📝 Creating .env.base64 file...${NC}"
cat > ./base64-output/.env.base64 << EOF
# Base64 encoded certificates for local development
# Copy these values to your main .env file or use this file directly

SWISH_CERT_BASE64=${cert_base64}
SWISH_KEY_BASE64=${key_base64}
EOF

# Create a file with Vercel-ready environment variables
echo -e "${YELLOW}☁️ Creating vercel-env.txt for production...${NC}"
cat > ./base64-output/vercel-env.txt << EOF
# Copy these values to your Vercel Environment Variables
# Go to: Project Settings > Environment Variables

SWISH_CERT_BASE64
${cert_base64}

SWISH_KEY_BASE64
${key_base64}
EOF

# Create a summary file
cat > ./base64-output/README.md << EOF
# Certificate Base64 Files

This directory contains base64 encoded certificates generated from your PEM files.

## Files

- \`.env.base64\` - Environment variables for local development
- \`vercel-env.txt\` - Values to copy to Vercel environment variables
- \`cert-validation.js\` - Script to validate the base64 certificates

## Usage

### For Local Development
1. Copy the contents of \`.env.base64\` to your main \`.env\` file
2. Or use: \`cp .env.base64 ../../.env.local\`

### For Vercel Deployment
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add the variables from \`vercel-env.txt\`
4. Make sure to set them for Production, Preview, and Development environments

## Validation
Run the validation script to test if certificates decode properly:
\`\`\`bash
node cert-validation.js
\`\`\`
EOF

# Create validation script
echo -e "${YELLOW}🔍 Creating validation script...${NC}"
cat > ./base64-output/cert-validation.js << 'EOF'
#!/usr/bin/env node

// Validation script to test base64 certificate decoding
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function validateBase64Cert(base64String, type) {
    try {
        console.log(`\n🔍 Validating ${type}...`);
        
        // Decode base64
        const decoded = Buffer.from(base64String, 'base64').toString('utf8');
        
        // Check PEM format
        const expectedStart = type === 'certificate' ? '-----BEGIN CERTIFICATE-----' : '-----BEGIN PRIVATE KEY-----';
        const expectedEnd = type === 'certificate' ? '-----END CERTIFICATE-----' : '-----END PRIVATE KEY-----';
        
        if (!decoded.includes(expectedStart)) {
            console.log(`❌ Missing ${expectedStart}`);
            return false;
        }
        
        if (!decoded.includes(expectedEnd)) {
            console.log(`❌ Missing ${expectedEnd}`);
            return false;
        }
        
        console.log(`✅ ${type} format is valid`);
        console.log(`📏 Decoded length: ${decoded.length} characters`);
        console.log(`🔢 Base64 length: ${base64String.length} characters`);
        
        return true;
    } catch (error) {
        console.log(`❌ Error decoding ${type}:`, error.message);
        return false;
    }
}

async function main() {
    console.log('🔐 Certificate Base64 Validation\n');
    
    try {
        // Read the .env.base64 file
        const envPath = path.join(__dirname, '.env.base64');
        const envContent = fs.readFileSync(envPath, 'utf8');
        
        // Extract base64 values
        const certMatch = envContent.match(/SWISH_CERT_BASE64=(.+)/);
        const keyMatch = envContent.match(/SWISH_KEY_BASE64=(.+)/);
        
        if (!certMatch || !keyMatch) {
            console.log('❌ Could not find base64 values in .env.base64 file');
            process.exit(1);
        }
        
        const certBase64 = certMatch[1].trim();
        const keyBase64 = keyMatch[1].trim();
        
        // Validate both certificates
        const certValid = validateBase64Cert(certBase64, 'certificate');
        const keyValid = validateBase64Cert(keyBase64, 'private key');
        
        if (certValid && keyValid) {
            console.log('\n✅ All certificates are valid and ready to use!');
            console.log('\n📋 Next steps:');
            console.log('1. Copy .env.base64 contents to your main .env file');
            console.log('2. For Vercel: Add variables from vercel-env.txt to your project settings');
        } else {
            console.log('\n❌ Some certificates failed validation. Please regenerate them.');
            process.exit(1);
        }
        
    } catch (error) {
        console.log('❌ Validation failed:', error.message);
        process.exit(1);
    }
}

main();
EOF

echo -e "${GREEN}✅ Base64 certificates generated successfully!${NC}"
echo ""
echo "📁 Files created in scripts/cert-tools/base64-output/:"
echo "   - .env.base64 (for local development)"
echo "   - vercel-env.txt (for Vercel environment variables)"
echo "   - cert-validation.js (validation script)"
echo "   - README.md (instructions)"
echo ""
echo -e "${YELLOW}🚀 Next steps:${NC}"
echo "1. Run validation: cd scripts/cert-tools/base64-output && node cert-validation.js"
echo "2. Copy .env.base64 to your project root as .env.local"
echo "3. For Vercel: Use values from vercel-env.txt in your project settings"
