import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const CallbackHandler = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    // Extract callback parameters
    const token = searchParams.get("token");
    const status = searchParams.get("status");
    const reference = searchParams.get("reference");

    // Simulate processing the callback
    setTimeout(() => {
      setProcessing(false);

      if (status === "PAID") {
        // Redirect to success page
        navigate(`/payment-status/${token}?status=completed`);
      } else if (status === "DECLINED" || status === "ERROR") {
        // Redirect to failure page
        navigate(`/payment-status/${token}?status=failed`);
      } else {
        // Unknown status, redirect to main page
        navigate("/");
      }
    }, 2000);
  }, [searchParams, navigate]);

  if (processing) {
    return (
      <div className="status-card">
        <div className="loading-spinner"></div>
        <h2 className="status-title">Processing Payment Result</h2>
        <p className="status-message">
          Please wait while we process your payment result...
        </p>
      </div>
    );
  }

  return (
    <div className="status-card">
      <div className="status-icon">⚡</div>
      <h2 className="status-title">Redirecting...</h2>
      <p className="status-message">Taking you to the payment status page...</p>
    </div>
  );
};

export default CallbackHandler;
