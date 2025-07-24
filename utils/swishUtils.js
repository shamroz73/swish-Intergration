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

export { makeSwishApiRequest, handleSwishApiError };
