import axios from "axios";
import config from "../config/index.js";

/**
 * Swish API integration utilities
 */

/**
 * Make a request to Swish API
 * @param {string} uuid - Payment UUID
 * @param {Object} payload - Payment payload
 * @param {https.Agent} agent - HTTPS agent with certificates
 * @returns {Promise<Object>} - Axios response
 */
async function makeSwishApiRequest(uuid, payload, agent) {
  // v2 API for PUT requests (creating payments) - as per Swish documentation
  const apiUrl = `${config.swish.apiUrl}/swish-cpcapi/api/v2/paymentrequests`;

  const response = await axios.put(`${apiUrl}/${uuid}`, payload, {
    httpsAgent: agent,
    headers: {
      "Content-Type": "application/json",
    },
  });

  return response;
}

/**
 * Check payment status from Swish API
 * @param {string} paymentRequestToken - Payment request token/UUID
 * @param {https.Agent} agent - HTTPS agent with certificates
 * @returns {Promise<Object>} - Payment status response
 */
async function checkSwishPaymentStatus(paymentRequestToken, agent) {
  // v1 API for GET requests (checking payment status) - as per Swish documentation
  const apiUrl = `${config.swish.apiUrl}/swish-cpcapi/api/v1/paymentrequests`;
  const fullUrl = `${apiUrl}/${paymentRequestToken}`;

  console.log(
    `🔍 Checking payment status at: ${fullUrl} (using v1 API for GET)`
  );

  try {
    const response = await axios.get(fullUrl, {
      httpsAgent: agent,
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log(`Swish API response status: ${response.status}`);
    console.log(`Swish API response data:`, response.data);

    return {
      success: true,
      data: response.data,
      status: response.data.status,
    };
  } catch (error) {
    console.log(
      `Swish API error: ${error.response?.status} - ${error.message}`
    );
    if (error.response?.data) {
      console.log(`Swish API error details:`, error.response.data);
    }

    // If payment request is not found, it might have been cancelled or expired
    if (error.response?.status === 404) {
      return {
        success: false,
        status: "NOT_FOUND",
        error: "Payment request not found",
      };
    }

    // Other errors
    return {
      success: false,
      status: "ERROR",
      error: error.response?.data?.message || error.message,
    };
  }
}

/**
 * Handle Swish API errors and format response
 * @param {Error} error - Axios error object
 * @param {Object} res - Express response object
 */
function handleSwishApiError(error, res) {
  const errorMessage =
    error.response?.data?.message ||
    error.message ||
    "Failed to create Swish payment";
  const statusCode = error.response?.status || 500;

  res.status(statusCode).json({
    error: errorMessage,
    details: config.isDevelopment
      ? error.response?.data || error.message
      : "Internal server error",
    timestamp: new Date().toISOString(),
  });
}

export { makeSwishApiRequest, checkSwishPaymentStatus, handleSwishApiError };
