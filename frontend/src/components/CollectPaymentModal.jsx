import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  CheckCircle,
  Loader2,
  Banknote,
  CreditCard,
  Wallet,
} from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";

const CollectPaymentModal = ({ isOpen, onClose, order, onPaymentSuccess }) => {
  const focusTrapRef = useFocusTrap(isOpen, onClose);
  const [amount, setAmount] = useState("0.00");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reset amount when the modal opens with a new order
  useEffect(() => {
    if (isOpen && order) {
      setAmount(order.remainingBalance?.toFixed(2) || "0.00");
      setPaymentMode("CASH");
      setError("");
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    if (parseFloat(amount) <= 0) {
      setError("Amount must be greater than zero");
      setLoading(false);
      return;
    }

    if (parseFloat(amount) > order.remainingBalance + 0.01) {
      setError(
        `Amount exceeds remaining balance (₹${order.remainingBalance.toFixed(
          2,
        )})`,
      );
      setLoading(false);
      return;
    }

    try {
      const res = await axios.post("/api/payment/partial", {
        orderId: order.id,
        amount: parseFloat(amount),
        paymentMode,
      });

      if (res.data.success) {
        onPaymentSuccess(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl p-6 max-w-md w-full"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collect-payment-title"
        tabIndex={-1}
      >
        <div className="flex items-center justify-between mb-6">
          <h3
            id="collect-payment-title"
            className="text-xl font-bold text-gray-900"
          >
            Collect Payment
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Order Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Bill Number</span>
            <span className="font-semibold">{order.billNumber}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Total Amount</span>
            <span className="font-semibold">
              ₹{parseFloat(order.total).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600">Already Paid</span>
            <span className="font-semibold text-green-600">
              ₹{order.totalPaid.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200">
            <span className="font-bold text-gray-900">Remaining</span>
            <span className="font-bold text-orange-600">
              ₹{order.remainingBalance.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Payment Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            max={order.remainingBalance}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:outline-none text-lg font-semibold"
          />
          <button
            onClick={() => setAmount(order.remainingBalance.toFixed(2))}
            className="mt-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Pay Full Amount
          </button>
        </div>

        {/* Payment Method */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Payment Method
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setPaymentMode("CASH")}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "CASH"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Banknote
                className={`w-5 h-5 ${
                  paymentMode === "CASH" ? "text-green-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  paymentMode === "CASH" ? "text-green-600" : "text-gray-700"
                }`}
              >
                Cash
              </span>
            </button>

            <button
              onClick={() => setPaymentMode("CARD")}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "CARD"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <CreditCard
                className={`w-5 h-5 ${
                  paymentMode === "CARD" ? "text-blue-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  paymentMode === "CARD" ? "text-blue-600" : "text-gray-700"
                }`}
              >
                Card
              </span>
            </button>

            <button
              onClick={() => setPaymentMode("UPI")}
              className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                paymentMode === "UPI"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Wallet
                className={`w-5 h-5 ${
                  paymentMode === "UPI" ? "text-purple-600" : "text-gray-600"
                }`}
              />
              <span
                className={`text-xs font-medium ${
                  paymentMode === "UPI" ? "text-purple-600" : "text-gray-700"
                }`}
              >
                UPI
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                <span>Collect Payment</span>
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
      </div>
    </div>
  );
};

export default CollectPaymentModal;
