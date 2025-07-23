# Vercel Environment Variables Setup

## Current Production Deployment

**Live URL:** https://swisp-lw54by11b-shamroz-warraichs-projects.vercel.app
**Callback URL:** https://swisp-lw54by11b-shamroz-warraichs-projects.vercel.app/api/swish/callback

## Environment Variables Status ✅

All required environment variables are already set in production:

- ✅ SWISH_PAYEE_ALIAS
- ✅ SWISH_API_URL
- ✅ SWISH_CALLBACK_URL
- ✅ SWISH_CERT_BASE64
- ✅ SWISH_KEY_BASE64

## Manual Setup Commands (if needed)

### 1. Set basic configuration

```bash
vercel env add SWISH_PAYEE_ALIAS production
# Enter: 1232475101

vercel env add SWISH_API_URL production
# Enter: https://cpc.getswish.net
```

### 2. Set callback URL

```bash
vercel env add SWISH_CALLBACK_URL production
# Enter: https://swisp-lw54by11b-shamroz-warraichs-projects.vercel.app/api/swish/callback
```

### 3. Set certificates (base64 encoded)

```bash
# Certificate
vercel env add SWISH_CERT_BASE64 production
# Copy and paste content from: cat cert.base64

# Private key
vercel env add SWISH_KEY_BASE64 production
# Copy and paste content from: cat key.base64
```

## Deployment

```bash
vercel --prod
```

## Local Development vs Production

### Local (.env file):

- Uses certificate files directly from `certs/` folder
- Callback URL: `http://localhost:3000/api/swish/callback`

### Production (Vercel):

- Uses base64 encoded certificates from environment variables
- Callback URL: `https://swisp-lw54by11b-shamroz-warraichs-projects.vercel.app/api/swish/callback`
