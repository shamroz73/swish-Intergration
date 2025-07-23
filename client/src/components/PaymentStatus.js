import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";

const PaymentStatus = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending");
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(180); // 3 minutes timeout (more realistic)

  useEffect(() => {
    if (!token) {
      navigate("/");
      return;
    }

    const checkPaymentStatus = async () => {
      try {
        // In a real implementation, you would have an endpoint to check payment status
        // For now, we'll simulate the status checking
        const response = await axios.get(`/api/payment-status/${token}`);
        
        if (response.data.status === 'PAID') {
          setStatus('completed');
          setPaymentInfo(response.data);
        } else if (response.data.status === 'DECLINED' || response.data.status === 'ERROR' || response.data.status === 'CANCELLED') {
          setStatus('failed');
          setPaymentInfo(response.data);
        }
        // Continue polling if status is still CREATED or other pending status
        
      } catch (error) {
        console.error('Status check failed:', error);
        // If payment not found after some time, assume it was cancelled
        if (error.response?.status === 404) {
          setStatus('cancelled');
        }
      }
    };

    // Start polling for payment status
    const pollInterval = setInterval(checkPaymentStatus, 3000);

    // Set up timeout
    const timeout = setTimeout(() => {
      setStatus("timeout");
      clearInterval(pollInterval);
    }, 180000); // 3 minutes

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Initial status check
    checkPaymentStatus();

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeout);
      clearInterval(countdownInterval);
    };
  }, [token, navigate]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleCancelPayment = () => {
    setStatus('cancelled');
  };

  const handleNewPayment = () => {
    navigate("/");
  };

  const handleRetryPayment = () => {
    // You could implement retry logic here
    navigate("/");
  };

  if (status === "pending") {
    return (
      <div className="status-card status-pending">
        <div className="loading-spinner"></div>
        <h2 className="status-title">⏳ Payment Pending</h2>
        <p className="status-message">
          Please check your phone for the Swish notification and approve the
          payment.
        </p>

        <div className="payment-details">
          <h4>📱 Next Steps:</h4>
          <ol style={{ textAlign: "left", paddingLeft: "20px" }}>
            <li>Open the Swish app on your phone</li>
            <li>You should see a payment request notification</li>
            <li>Review the payment details</li>
            <li>Swipe to approve the payment</li>
            <li>Return to this page to see the confirmation</li>
          </ol>
        </div>

        <div
          style={{
            background: "#fff3cd",
            padding: "12px",
            borderRadius: "8px",
            margin: "20px 0",
            border: "1px solid #ffeaa7",
          }}
        >
          <p style={{ margin: 0, color: "#856404" }}>
            ⏰ Time remaining: <strong>{formatTime(timeRemaining)}</strong>
          </p>
          <small style={{ color: "#856404" }}>
            Payment request will expire after 3 minutes
          </small>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={handleCancelPayment}
            style={{ backgroundColor: '#dc3545' }}
          >
            Cancel Payment
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNewPayment}
            style={{ backgroundColor: '#6c757d' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (status === "completed") {
    return (
      <div className="status-card status-success">
        <div className="status-icon">✅</div>
        <h2 className="status-title">Payment Successful!</h2>
        <p className="status-message">
          Your Swish payment has been completed successfully.
        </p>

        {paymentInfo && (
          <div className="payment-details">
            <h4>Payment Details</h4>
            <p>
              <strong>Amount:</strong> {paymentInfo.amount} SEK
            </p>
            <p>
              <strong>Payment Reference:</strong> {paymentInfo.paymentReference}
            </p>
            <p>
              <strong>Transaction ID:</strong> {token}
            </p>
            <p>
              <strong>Status:</strong> Completed
            </p>
            <p>
              <strong>Completed At:</strong> {new Date().toLocaleString()}
            </p>
          </div>
        )}

        <button className="btn btn-primary" onClick={handleNewPayment}>
          New Payment
        </button>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="status-card status-error">
        <div className="status-icon">❌</div>
        <h2 className="status-title">Payment Failed</h2>
        <p className="status-message">
          The payment could not be completed. Please try again.
        </p>

        <div className="payment-details">
          <h4>Possible reasons:</h4>
          <ul style={{ textAlign: "left", paddingLeft: "20px" }}>
            <li>Payment was declined in the Swish app</li>
            <li>Insufficient funds in your account</li>
            <li>Swish daily/monthly limit exceeded</li>
            <li>Technical issue with the payment processor</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={handleRetryPayment}>
            Try Again
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNewPayment}
            style={{ backgroundColor: "#6c757d" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="status-card status-error">
        <div className="status-icon">❌</div>
        <h2 className="status-title">Payment Cancelled</h2>
        <p className="status-message">
          The payment was cancelled. You can try again or go back to the main page.
        </p>
        
        <div className="payment-details">
          <h4>What happened?</h4>
          <p>The payment was cancelled either by:</p>
          <ul style={{ textAlign: "left", paddingLeft: "20px" }}>
            <li>You cancelled it manually using the cancel button</li>
            <li>You declined the payment in the Swish app</li>
            <li>The payment request was not approved in time</li>
          </ul>
        </div>

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={handleRetryPayment}>
            Try Again
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNewPayment}
            style={{ backgroundColor: "#6c757d" }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (status === "timeout") {
    return (
      <div className="status-card status-error">
        <div className="status-icon">⏰</div>
        <h2 className="status-title">Payment Timeout</h2>
        <p className="status-message">
          The payment request has expired. Please try again.
        </p>

        <div className="payment-details">
          <h4>What happened?</h4>
          <p>
            The payment request was not completed within the 3-minute time
            limit.
          </p>
          <p>This could be because:</p>
          <ul style={{ textAlign: "left", paddingLeft: "20px" }}>
            <li>The payment was not approved in time</li>
            <li>The Swish app was not opened</li>
            <li>Network connectivity issues</li>
          </ul>
        </div>

        <button className="btn btn-primary" onClick={handleNewPayment}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="status-icon">❓</div>
      <h2 className="status-title">Unknown Status</h2>
      <p className="status-message">Unable to determine payment status.</p>
      <button className="btn btn-primary" onClick={handleNewPayment}>
        Go Back
      </button>
    </div>
  );
};

export default PaymentStatus;
