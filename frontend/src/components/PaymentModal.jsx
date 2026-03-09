import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  CreditCard,
  Wallet,
  Banknote,
  X,
  CheckCircle,
  Loader2,
  Split,
  Clock,
} from "lucide-react";
import SplitPaymentInterface from "./SplitPaymentInterface";
import { useFocusTrap } from "../hooks/useFocusTrap";

const PaymentModal = ({ isOpen, onClose, order, onPaymentSuccess }) => {
  const focusTrapRef = useFocusTrap(isOpen, onClose);
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSplitInterface, setShowSplitInterface] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Set default payment mode based on order type
  useEffect(() => {
    if (order && isOpen) {
      const isPlatformDelivery =
        order.orderType === "DELIVERY" &&
        order.deliveryInfo?.deliveryPlatform &&
        ["ZOMATO", "SWIGGY"].includes(order.deliveryInfo.deliveryPlatform);

      if (isPlatformDelivery) {
        setPaymentMode("ALREADY_PAID");
      } else {
        setPaymentMode("CASH");
      }
      // Pre-fill from existing order customer if present
      setCustomerName(order.customer?.name || "");
      setCustomerPhone(order.customer?.phone || "");
      setError("");
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const amount = parseFloat(order.total);

  // Determine available payment methods based on order type
  const isPlatformDelivery =
    order.orderType === "DELIVERY" &&
    order.deliveryInfo?.deliveryPlatform &&
    ["ZOMATO", "SWIGGY"].includes(order.deliveryInfo.deliveryPlatform);

  const isDirectDelivery =
    order.orderType === "DELIVERY" &&
    order.deliveryInfo?.deliveryPlatform === "DIRECT";

  const isDineIn = order.orderType === "DINE_IN";
  const isTakeaway = order.orderType === "TAKEAWAY";

  // Available payment methods for each order type
  const availablePaymentMethods = {
    // DINE_IN: All methods available
    DINE_IN: ["CASH", "CARD", "UPI", "SPLIT", "PAY_LATER"],

    // TAKEAWAY: All except Pay Later (needs immediate payment)
    TAKEAWAY: ["CASH", "CARD", "UPI", "SPLIT"],

    // DELIVERY - Platform orders: Only "Already Paid" through platform
    PLATFORM_DELIVERY: ["ALREADY_PAID"],

    // DELIVERY - Direct: Cash on delivery only
    DIRECT_DELIVERY: ["CASH", "CARD", "UPI"],
  };

  // Get current available methods
  let currentAvailableMethods;
  if (isPlatformDelivery) {
    currentAvailableMethods = availablePaymentMethods.PLATFORM_DELIVERY;
  } else if (isDirectDelivery) {
    currentAvailableMethods = availablePaymentMethods.DIRECT_DELIVERY;
  } else if (isDineIn) {
    currentAvailableMethods = availablePaymentMethods.DINE_IN;
  } else if (isTakeaway) {
    currentAvailableMethods = availablePaymentMethods.TAKEAWAY;
  } else {
    // Default to all methods
    currentAvailableMethods = availablePaymentMethods.DINE_IN;
  }

  // Check if a payment method is available
  const isMethodAvailable = (method) =>
    currentAvailableMethods.includes(method);

  // Handle cash/card payment (manual)
  const handleManualPayment = async (mode) => {
    setLoading(true);
    setError("");

    try {
      await axios.put(`/api/orders/${order.id}/status`, {
        status: "PAID",
        paymentMode: mode,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.replace(/\D/g, "") || undefined,
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

  // Handle split payment
  const handleSplitPayment = async (splitPayments) => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("/api/payment/split", {
        orderId: order.id,
        payments: splitPayments,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.replace(/\D/g, "") || undefined,
      });

      if (res.data.success) {
        onPaymentSuccess({
          ...order,
          status: "PAID",
          paymentMode: `${splitPayments[0].paymentMode}+${splitPayments[1].paymentMode}`,
          payments: res.data.payments,
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || "Split payment failed");
      setShowSplitInterface(false);
    } finally {
      setLoading(false);
    }
  };

  // Handle Pay Later
  const handlePayLater = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await axios.post("/api/orders/pay-later", {
        orderId: order.id,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.replace(/\D/g, "") || undefined,
      });

      if (res.data.success) {
        onPaymentSuccess({
          ...order,
          status: "PARTIALLY_PAID",
          paymentMode: "PAY_LATER",
        });
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create Pay Later order");
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = () => {
    if (paymentMode === "PAY_LATER") {
      handlePayLater();
    } else if (paymentMode === "ALREADY_PAID") {
      // For platform orders (Zomato/Swiggy), mark as paid through platform
      handleManualPayment("PLATFORM_PAID");
    } else {
      handleManualPayment(paymentMode);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div
        className="bg-white rounded-2xl p-4 sm:p-6 max-w-md w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <h3
            id="payment-modal-title"
            className="text-lg sm:text-xl font-bold text-gray-900"
          >
            Complete Payment
          </h3>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
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

        {/* Customer Details */}
        {!isPlatformDelivery && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-xl">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">
              Customer Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Mobile
                </label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="10-digit number"
                  maxLength={10}
                  inputMode="numeric"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
          </div>
        )}

        {/* Platform Order Info Banner */}
        {isPlatformDelivery && (
          <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
            <div className="flex items-start space-x-3">
              <CheckCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                  {order.deliveryInfo.deliveryPlatform} Order
                </h4>
                <p className="text-xs text-blue-700">
                  Payment already collected by{" "}
                  {order.deliveryInfo.deliveryPlatform}. Mark order as paid to
                  complete processing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order Type Info */}
        {(isDirectDelivery || isTakeaway) && (
          <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-sm text-gray-700">
              {isDirectDelivery && (
                <span>
                  <strong>Direct Delivery:</strong> Cash on delivery or counter
                  payment available
                </span>
              )}
              {isTakeaway && (
                <span>
                  <strong>Takeaway Order:</strong> Immediate payment required
                </span>
              )}
            </p>
          </div>
        )}

        {/* Payment Methods */}
        <div className="mb-4 sm:mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
            Select Payment Method
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {/* Already Paid (Platform Orders) */}
            {isMethodAvailable("ALREADY_PAID") && (
              <button
                onClick={() => setPaymentMode("ALREADY_PAID")}
                className="col-span-2 p-3 sm:p-4 rounded-xl border-2 border-blue-500 bg-blue-50 transition-all flex items-center justify-center space-x-2 sm:space-x-3 active:scale-95"
              >
                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                <div className="text-left">
                  <span className="block text-xs sm:text-sm font-bold text-blue-600">
                    Already Paid via {order.deliveryInfo?.deliveryPlatform}
                  </span>
                  <span className="block text-[10px] sm:text-xs text-blue-700">
                    Mark order as paid to continue
                  </span>
                </div>
              </button>
            )}

            {/* Cash */}
            {isMethodAvailable("CASH") && (
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
                <span className="text-xs text-gray-500">
                  {isDirectDelivery ? "Cash on Delivery" : "Pay at counter"}
                </span>
              </button>
            )}

            {/* Card (POS) */}
            {isMethodAvailable("CARD") && (
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
            )}

            {/* UPI (Manual) */}
            {isMethodAvailable("UPI") && (
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
            )}

            {/* Split Payment */}
            {isMethodAvailable("SPLIT") && (
              <button
                onClick={() => {
                  setPaymentMode("SPLIT");
                  setShowSplitInterface(true);
                }}
                className="p-4 rounded-xl border-2 border-orange-200 hover:border-orange-300 bg-gradient-to-r from-orange-50 to-yellow-50 transition-all flex flex-col items-center space-y-2"
              >
                <Split className="w-6 h-6 text-orange-600" />
                <span className="text-sm font-medium text-orange-600">
                  Split Payment
                </span>
                <span className="text-xs text-gray-500">
                  Pay with 2 methods
                </span>
              </button>
            )}

            {/* Pay Later */}
            {isMethodAvailable("PAY_LATER") && (
              <button
                onClick={() => setPaymentMode("PAY_LATER")}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center space-y-2 ${
                  paymentMode === "PAY_LATER"
                    ? "border-indigo-500 bg-indigo-50"
                    : "border-indigo-200 hover:border-indigo-300 bg-gradient-to-r from-indigo-50 to-blue-50"
                }`}
              >
                <Clock className="w-6 h-6 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-600">
                  Pay Later
                </span>
                <span className="text-xs text-gray-500">
                  Save customer details
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Split Payment Interface */}
        {showSplitInterface && (
          <SplitPaymentInterface
            orderTotal={amount}
            onConfirm={handleSplitPayment}
            onCancel={() => setShowSplitInterface(false)}
          />
        )}

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
                  {paymentMode === "ALREADY_PAID"
                    ? "Confirm Payment Received"
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
      </div>
    </div>
  );
};

export default PaymentModal;
