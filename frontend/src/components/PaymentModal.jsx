import React, { useState } from "react";
import axios from "axios";
import {
  CreditCard,
  Wallet,
  Banknote,
  X,
  CheckCircle,
  Loader2,
} from "lucide-react";

const PaymentModal = ({ isOpen, onClose, order, onPaymentSuccess }) => {
  const [paymentMode, setPaymentMode] = useState("RAZORPAY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen || !order) return null;

  const amount = parseFloat(order.total);

  // Load Razorpay script dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Handle Razorpay payment
  const handleRazorpayPayment = async () => {
    setLoading(true);
    setError("");

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay SDK");
      }

      // Create order on backend
      const { data } = await axios.post("/api/payment/create-order", {
        orderId: order.id,
        amount: amount,
      });

      // Configure Razorpay options
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: "Cafe POS",
        description: `Bill #${order.billNumber}`,
        order_id: data.razorpayOrderId,
        handler: async function (response) {
          try {
            // Verify payment on backend
            const verifyRes = await axios.post("/api/payment/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              orderId: order.id,
            });

            if (verifyRes.data.success) {
              onPaymentSuccess({
                ...order,
                status: "PAID",
                paymentMode: "RAZORPAY",
                paymentId: response.razorpay_payment_id,
              });
            }
          } catch (err) {
            setError("Payment verification failed");
            console.error("Verification error:", err);
          }
        },
        prefill: {
          name:
            order.deliveryInfo?.customerName || order.table?.customerName || "",
          contact:
            order.deliveryInfo?.customerPhone ||
            order.table?.customerPhone ||
            "",
          email: order.deliveryInfo?.customerEmail || "",
        },
        notes: {
          billNumber: order.billNumber,
          orderType: order.orderType,
        },
        theme: {
          color: "#EF4444", // Red theme matching your UI
        },
        modal: {
          ondismiss: function () {
            setLoading(false);
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", function (response) {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      razorpay.open();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Payment failed");
      setLoading(false);
    }
  };

  // Handle cash/card payment (manual)
  const handleManualPayment = async (mode) => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.put(`/api/orders/${order.id}/status`, {
        status: "PAID",
        paymentMode: mode,
      });

      onPaymentSuccess({
        ...order,
        status: "PAID",
        paymentMode: mode,
      });
    } catch (err) {
      setError(err.response?.data?.error || "Payment update failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    if (paymentMode === "RAZORPAY") {
      handleRazorpayPayment();
    } else {
      handleManualPayment(paymentMode);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-gray-900">Complete Payment</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Order Summary */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Bill Number</span>
            <span className="font-semibold text-gray-900">
              {order.billNumber}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Order Type</span>
            <span className="font-medium text-gray-700">
              {order.orderType === "DINE_IN"
                ? `Table ${order.table?.number || order.tableId}`
                : order.orderType}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t border-gray-200">
            <span className="text-lg font-semibold text-gray-900">
              Total Amount
            </span>
            <span className="text-2xl font-bold text-red-600">
              ₹{amount.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMode("RAZORPAY")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "RAZORPAY"
                  ? "border-red-500 bg-red-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CreditCard
                className={`w-6 h-6 ${
                  paymentMode === "RAZORPAY" ? "text-red-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  paymentMode === "RAZORPAY" ? "text-red-600" : "text-gray-700"
                }`}
              >
                Online Payment
              </span>
              <span className="text-xs text-gray-500">
                UPI / Card / Netbanking
              </span>
            </button>

            <button
              onClick={() => setPaymentMode("CASH")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "CASH"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Banknote
                className={`w-6 h-6 ${
                  paymentMode === "CASH" ? "text-green-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  paymentMode === "CASH" ? "text-green-600" : "text-gray-700"
                }`}
              >
                Cash
              </span>
              <span className="text-xs text-gray-500">Pay at counter</span>
            </button>

            <button
              onClick={() => setPaymentMode("CARD")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "CARD"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CreditCard
                className={`w-6 h-6 ${
                  paymentMode === "CARD" ? "text-blue-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  paymentMode === "CARD" ? "text-blue-600" : "text-gray-700"
                }`}
              >
                Card (POS)
              </span>
              <span className="text-xs text-gray-500">Swipe machine</span>
            </button>

            <button
              onClick={() => setPaymentMode("UPI")}
              className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "UPI"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Wallet
                className={`w-6 h-6 ${
                  paymentMode === "UPI" ? "text-purple-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-sm font-medium ${
                  paymentMode === "UPI" ? "text-purple-600" : "text-gray-700"
                }`}
              >
                UPI (Manual)
              </span>
              <span className="text-xs text-gray-500">PhonePe / GPay</span>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handlePayment}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>
                  {paymentMode === "RAZORPAY"
                    ? `Pay ₹${amount.toFixed(0)}`
                    : "Mark as Paid"}
                </span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
          >
            Cancel
          </button>
        </div>

        {/* Razorpay Badge */}
        {paymentMode === "RAZORPAY" && (
          <div className="mt-4 text-center">
            <p className="text-xs text-gray-500">
              Secured by{" "}
              <span className="font-semibold text-blue-600">Razorpay</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentModal;
