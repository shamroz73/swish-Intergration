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
