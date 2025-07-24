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
        const response = await axios.get(`/api/payment-status/${token}`);

        if (response.data.status === "PAID") {
          setStatus("completed");
          setPaymentInfo(response.data);
        } else if (
          response.data.status === "DECLINED" ||
          response.data.status === "ERROR" ||
          response.data.status === "CANCELLED"
        ) {
          if (response.data.status === "CANCELLED") {
            setStatus("cancelled");
          } else {
            setStatus("failed");
          }
          setPaymentInfo(response.data);
        }
      } catch (error) {
        console.error("Status check failed:", error);
        if (error.response?.status === 404) {
          setStatus("cancelled");
        }
      }
    };

    // Use a counter to track polling phases
    let checkCount = 0;
    let pollInterval;
    
    const adaptivePolling = async () => {
      await checkPaymentStatus();
      checkCount++;
      
      // After 30 rapid checks (30 seconds), switch to slower polling
      if (checkCount === 30) {
        console.log("🔄 Switching from rapid (1s) to normal (3s) polling after 30 seconds");
        clearInterval(pollInterval);
        pollInterval = setInterval(checkPaymentStatus, 3000);
      }
    };

    // Start with rapid polling for first 30 seconds (every 1 second)
    console.log("🚀 Starting rapid polling (1 second intervals) for quick cancellation detection");
    pollInterval = setInterval(adaptivePolling, 1000);

    // Set up timeout
    const timeout = setTimeout(() => {
      setStatus("timeout");
      clearInterval(pollInterval);
    }, 180000); // 3 minutes

    // Set up cancellation detection timeout (shorter than backend)
    const cancellationTimeout = setTimeout(() => {
      // If still CREATED after 60 seconds, likely cancelled
      const checkAndMarkCancelled = async () => {
        try {
          const response = await axios.get(`/api/payment-status/${token}`);
          if (response.data.status === "CREATED") {
            console.log("⚡ Frontend: Payment still CREATED after 60 seconds - likely cancelled");
            setStatus("cancelled");
            setPaymentInfo(response.data);
            clearInterval(pollInterval);
          }
        } catch (error) {
          console.error("Error in frontend cancellation check:", error);
        }
      };
      checkAndMarkCancelled();
    }, 60000); // 1 minute frontend check

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
      clearTimeout(cancellationTimeout);
      clearInterval(countdownInterval);
    };
  }, [token, navigate]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleCancelPayment = async () => {
    try {
      console.log(`🚫 Cancelling payment for token: ${token}`);
      const response = await axios.post(`/api/cancel-payment/${token}`);
      console.log("✅ Payment cancelled:", response.data);
      setStatus("cancelled");
      setPaymentInfo(response.data.payment);
    } catch (error) {
      console.error("❌ Failed to cancel payment:", error);
      // If API call fails, still mark as cancelled locally
      setStatus("cancelled");
    }
  };

  const handleNewPayment = () => {
    navigate("/");
  };

  const handleRetryPayment = () => {
    // You could implement retry logic here
    navigate("/");
  };

  // 🧪 Manual testing functions for simulating Swish callbacks
  const handleManualSuccess = async () => {
    try {
      console.log(`🧪 Testing: Simulating PAID status for token: ${token}`);
      const response = await axios.post(`/api/test/callback/${token}`, {
        status: "PAID",
      });
      console.log("✅ Manual success response:", response.data);
    } catch (error) {
      console.error("❌ Failed to simulate success:", error);
    }
  };

  const handleManualFailure = async () => {
    try {
      console.log(`🧪 Testing: Simulating DECLINED status for token: ${token}`);
      const response = await axios.post(`/api/test/callback/${token}`, {
        status: "DECLINED",
      });
      console.log("❌ Manual failure response:", response.data);
    } catch (error) {
      console.error("❌ Failed to simulate failure:", error);
    }
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
            <li>Swipe to approve or decline the payment</li>
            <li>Return to this page to see the confirmation</li>
          </ol>
          
          <div style={{ 
            background: "#e7f7ff", 
            padding: "10px", 
            borderRadius: "6px", 
            margin: "15px 0",
            border: "1px solid #bee5eb"
          }}>
            <p style={{ margin: 0, color: "#0c5460", fontSize: "14px" }}>
              ⚡ <strong>Quick Detection:</strong> This page checks for updates every second for the first 30 seconds, 
              then every 3 seconds. Cancellations are detected within 45 seconds!
            </p>
          </div>
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

        <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
          <button
            className="btn btn-primary"
            onClick={handleCancelPayment}
            style={{ backgroundColor: "#dc3545" }}
          >
            Cancel Payment
          </button>
          <button
            className="btn btn-primary"
            onClick={handleNewPayment}
            style={{ backgroundColor: "#6c757d" }}
          >
            Go Back
          </button>
        </div>

        {/* 🧪 Manual Testing Buttons - Remove in production */}
        <div
          style={{
            marginTop: "20px",
            padding: "16px",
            backgroundColor: "#e7f3ff",
            borderRadius: "8px",
            border: "2px dashed #007bff",
          }}
        >
          <h4 style={{ margin: "0 0 10px 0", color: "#007bff" }}>
            🧪 Manual Testing (Development Only)
          </h4>
          <p
            style={{ margin: "0 0 15px 0", color: "#495057", fontSize: "14px" }}
          >
            Since Swish callback URL isn't set up for localhost, use these
            buttons to simulate payment results:
          </p>
          <div
            style={{ display: "flex", gap: "10px", justifyContent: "center" }}
          >
            <button
              className="btn btn-primary"
              onClick={handleManualSuccess}
              style={{
                backgroundColor: "#28a745",
                fontSize: "14px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
              }}
            >
              ✅ Simulate Payment Success
            </button>
            <button
              className="btn btn-primary"
              onClick={handleManualFailure}
              style={{
                backgroundColor: "#dc3545",
                fontSize: "14px",
                padding: "10px 20px",
                border: "none",
                borderRadius: "6px",
              }}
            >
              ❌ Simulate Payment Failure
            </button>
          </div>
          <p
            style={{ margin: "10px 0 0 0", color: "#6c757d", fontSize: "12px" }}
          >
            Check the browser console for API call results. The page will update
            automatically after clicking.
          </p>
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
          The payment was cancelled. You can try again or go back to the main
          page.
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
