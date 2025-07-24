import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const PaymentForm = () => {
  const [formData, setFormData] = useState({
    phoneNumber: "",
    amount: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError("");
  };

  const validateForm = () => {
    if (!formData.phoneNumber.trim()) {
      setError("Phone number is required");
      return false;
    }

    if (!formData.amount.trim()) {
      setError("Amount is required");
      return false;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (amount < 0.01) {
      setError("Minimum amount is 0.01 SEK");
      return false;
    }

    if (amount > 999999999999.99) {
      setError("Maximum amount is 999,999,999,999.99 SEK");
      return false;
    }

    // Basic Swedish phone number validation
    const phoneRegex = /^(\+?46|0)?[67]\d{8}$/;
    if (!phoneRegex.test(formData.phoneNumber.replace(/\s/g, ""))) {
      setError("Please enter a valid Swedish phone number");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Use test endpoint for local development
      const isLocalDevelopment = window.location.hostname === 'localhost';
      const endpoint = isLocalDevelopment 
        ? "/api/test/create-payment" 
        : "/api/create-swish-payment";
        
      const response = await axios.post(endpoint, {
        phoneNumber: formData.phoneNumber,
        amount: formData.amount,
      });

      // Navigate directly to payment status page
      navigate(`/payment-status/${response.data.token}`);
    } catch (error) {
      console.error("Payment initiation failed:", error);

      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else if (error.response?.status === 500) {
        setError("Server error occurred. Please try again.");
      } else if (error.request) {
        setError("Network error. Please check your connection.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-form">
      <h2 style={{ marginBottom: "20px", color: "#333" }}>
        💳 Create Swish Payment
      </h2>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="phoneNumber">Phone Number *</label>
          <input
            type="tel"
            id="phoneNumber"
            name="phoneNumber"
            value={formData.phoneNumber}
            onChange={handleInputChange}
            placeholder="e.g., +46761581756 or 0761581756"
            disabled={loading}
            required
          />
          <small style={{ color: "#666", fontSize: "14px" }}>
            Swedish mobile number format
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Amount (SEK) *</label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleInputChange}
            placeholder="e.g., 100.00"
            step="0.01"
            min="0.01"
            max="999999999999.99"
            disabled={loading}
            required
          />
          <small style={{ color: "#666", fontSize: "14px" }}>
            Minimum: 0.01 SEK, Maximum: 999,999,999,999.99 SEK
          </small>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? (
            <>
              <div
                className="loading-spinner"
                style={{
                  width: "20px",
                  height: "20px",
                  display: "inline-block",
                  marginRight: "10px",
                }}
              ></div>
              Processing...
            </>
          ) : (
            "Create Payment"
          )}
        </button>
      </form>

      <div
        style={{
          marginTop: "20px",
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
        }}
      >
        <h4 style={{ margin: "0 0 10px 0", color: "#333" }}>
          ℹ️ How it works:
        </h4>
        <ol style={{ margin: 0, paddingLeft: "20px", color: "#666" }}>
          <li>Enter your Swedish mobile number and payment amount</li>
          <li>Click "Create Payment" to initiate the Swish transaction</li>
          <li>You'll receive a Swish notification on your phone</li>
          <li>Approve the payment in your Swish app</li>
          <li>The payment status will update automatically</li>
        </ol>
      </div>
    </div>
  );
};

export default PaymentForm;
