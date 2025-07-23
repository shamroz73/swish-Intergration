import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PaymentForm from "./components/PaymentForm";
import PaymentStatus from "./components/PaymentStatus";
import CallbackHandler from "./components/CallbackHandler";

function App() {
  return (
    <Router>
      <div className="container">
        <div className="app-header">
          <h1>🚀 Swish Payment System</h1>
          <p>Secure payment processing with Swish</p>
        </div>

        <Routes>
          <Route path="/" element={<PaymentForm />} />
          <Route path="/payment-status/:token" element={<PaymentStatus />} />
          <Route path="/swish-callback" element={<CallbackHandler />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
