# Certificate Base64 Files

This directory contains base64 encoded certificates generated from your PEM files.

## Files

- `.env.base64` - Environment variables for local development
- `vercel-env.txt` - Values to copy to Vercel environment variables
- `cert-validation.js` - Script to validate the base64 certificates

## Usage

### For Local Development
1. Copy the contents of `.env.base64` to your main `.env` file
2. Or use: `cp .env.base64 ../../.env.local`

### For Vercel Deployment
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add the variables from `vercel-env.txt`
4. Make sure to set them for Production, Preview, and Development environments

## Validation
Run the validation script to test if certificates decode properly:
```bash
node cert-validation.js
```
