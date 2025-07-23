# Swish Payment Integration

A complete full-stack application for integrating Swish payments with a React frontend and Node.js backend.

## 🚀 Features

- **React Frontend**: Modern, responsive payment form with real-time status updates
- **Node.js Backend**: Secure Swish API integration with proper certificate handling
- **Complete Payment Flow**: From initiation to completion with callback handling
- **Status Tracking**: Real-time payment status monitoring
- **Error Handling**: Comprehensive error states and user feedback
- **Mobile Responsive**: Optimized for mobile and desktop

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Swish merchant account and certificates
- HTTPS domain for production callbacks

## 🛠️ Installation

### 1. Install Backend Dependencies

```bash
npm install
```

### 2. Install Frontend Dependencies

```bash
cd client
npm install
cd ..
```

### 3. Environment Configuration

Your `.env` file should contain:

```env
PORT=3000

# Swish Configuration
SWISH_PAYEE_ALIAS=1232475101
SWISH_CALLBACK_URL=https://yourdomain.com/swish-callback
SWISH_API_URL=https://cpc.getswish.net

# Certificate Paths
SWISH_CERT_PATH=certs/swish_certificate_202507071452.pem
SWISH_KEY_PATH=certs/client_tls_private_key.pem
SWISH_TLS_PATH=certs/SwishCAs.pem
```

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start the backend server:**

   ```bash
   npm start
   ```

   Server runs on http://localhost:3000

2. **Start the React development server (in a new terminal):**
   ```bash
   cd client
   npm start
   ```
   Frontend runs on http://localhost:3001

### Production Mode

1. **Build the React app:**

   ```bash
   cd client
   npm run build
   cd ..
   ```

2. **Start the production server:**
   ```bash
   npm start
   ```
   Complete app runs on http://localhost:3000

## 🔄 Payment Flow

1. **Payment Initiation**: User enters phone number and amount
2. **API Request**: Frontend calls `/api/create-swish-payment`
3. **Swish Integration**: Backend creates payment request with Swish
4. **Status Monitoring**: Frontend polls payment status
5. **User Action**: User approves payment in Swish app
6. **Callback Processing**: Swish sends callback to backend
7. **Status Update**: Frontend displays final payment result

## 📱 API Endpoints

### POST `/api/create-swish-payment`

Create a new Swish payment request.

**Request Body:**

```json
{
  "phoneNumber": "46761581756",
  "amount": "100.00"
}
```

**Response:**

```json
{
  "token": "11A86BE70EA346E4B1C39C874173F088",
  "paymentRequestToken": "11A86BE70EA346E4B1C39C874173F088",
  "status": "created"
}
```

### GET `/api/payment-status/:token`

Get the current status of a payment.

**Response:**

```json
{
  "token": "11A86BE70EA346E4B1C39C874173F088",
  "status": "PAID",
  "phoneNumber": "46761581756",
  "amount": "100.00",
  "paymentReference": "ABC123456789",
  "completedAt": "2025-07-23T15:30:00.000Z"
}
```

## 🎨 Frontend Components

- **PaymentForm**: Main payment form with validation
- **PaymentStatus**: Real-time status monitoring with polling
- **CallbackHandler**: Processes Swish callback responses
- **App**: Main application router and state management
  ```bash
  npm run dev
  ```

3. Or start normally:
   ```bash
   npm start
   ```

Server will run on `http://localhost:3000/` by default.
