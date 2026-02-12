import React, { useState } from "react";
import {
  Banknote,
  CreditCard,
  Wallet,
  X,
  CheckCircle,
  AlertCircle,
  Split,
} from "lucide-react";

const SplitPaymentInterface = ({ orderTotal, onConfirm, onCancel }) => {
  const [method1, setMethod1] = useState("");
  const [amount1, setAmount1] = useState("");
  const [method2, setMethod2] = useState("");
  const [amount2, setAmount2] = useState("");
  const [error, setError] = useState("");

  const paymentMethods = [
    {
      value: "CASH",
      label: "Cash",
      icon: Banknote,
      selectedClass: "border-green-500 bg-green-50",
      iconClass: "text-green-600",
      textClass: "text-green-600",
    },
    {
      value: "CARD",
      label: "Card",
      icon: CreditCard,
      selectedClass: "border-blue-500 bg-blue-50",
      iconClass: "text-blue-600",
      textClass: "text-blue-600",
    },
    {
      value: "UPI",
      label: "UPI",
      icon: Wallet,
      selectedClass: "border-purple-500 bg-purple-50",
      iconClass: "text-purple-600",
      textClass: "text-purple-600",
    },
  ];

  // Calculate remaining amount
  const amt1 = parseFloat(amount1) || 0;
  const amt2 = parseFloat(amount2) || 0;
  const remaining = orderTotal - amt1 - amt2;
  const isValid =
    method1 &&
    method2 &&
    method1 !== method2 &&
    Math.abs(remaining) < 0.01 &&
    amt1 > 0 &&
    amt2 > 0;

  // Auto-calculate amount2 when amount1 changes
  const handleAmount1Change = (value) => {
    setAmount1(value);
    const amt = parseFloat(value) || 0;
    if (amt > 0 && amt <= orderTotal) {
      const remaining = (orderTotal - amt).toFixed(2);
      setAmount2(remaining);
    }
  };

  // Split 50/50 helper function
  const handleSplit5050 = () => {
    const half = (orderTotal / 2).toFixed(2);
    setAmount1(half);
    setAmount2(half);
  };

  // Handle confirm
  const handleConfirm = () => {
    setError("");

    if (!method1 || !method2) {
      setError("Please select both payment methods");
      return;
    }

    if (method1 === method2) {
      setError("Cannot use the same payment method twice");
      return;
    }

    if (amt1 <= 0 || amt2 <= 0) {
      setError("Amounts must be greater than zero");
      return;
    }

    if (Math.abs(remaining) >= 0.01) {
      setError(
        `Split amounts must equal total (Remaining: ₹${Math.abs(
          remaining,
        ).toFixed(2)})`,
      );
      return;
    }

    onConfirm([
      { paymentMode: method1, amount: amt1 },
      { paymentMode: method2, amount: amt2 },
    ]);
  };

  return (
    <div className="mb-6 p-6 bg-gradient-to-br from-orange-50 via-yellow-50 to-orange-50 rounded-2xl border-2 border-orange-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-md">
            <Split className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Split Payment</h3>
            <p className="text-xs text-gray-600">
              Pay with 2 different methods
            </p>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-white/50 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Total Amount Display */}
      <div className="bg-white rounded-xl p-4 mb-6 shadow-sm border border-orange-200">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">
            Total to Split
          </span>
          <span className="text-2xl font-bold text-orange-600">
            ₹{orderTotal.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Payment Method 1 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Payment 1
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {paymentMethods.map((pm) => {
              const Icon = pm.icon;
              const isSelected = method1 === pm.value;
              return (
                <button
                  key={pm.value}
                  onClick={() => setMethod1(pm.value)}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center space-y-1 ${
                    isSelected
                      ? pm.selectedClass
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? pm.iconClass : "text-gray-600"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? pm.textClass : "text-gray-700"
                    }`}
                  >
                    {pm.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              ₹
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount1}
              onChange={(e) => handleAmount1Change(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-lg font-semibold"
            />
          </div>
        </div>

        {/* Payment Method 2 */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            Payment 2
          </label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {paymentMethods.map((pm) => {
              const Icon = pm.icon;
              const isSelected = method2 === pm.value;
              return (
                <button
                  key={pm.value}
                  onClick={() => setMethod2(pm.value)}
                  className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center space-y-1 ${
                    isSelected
                      ? pm.selectedClass
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${
                      isSelected ? pm.iconClass : "text-gray-600"
                    }`}
                  />
                  <span
                    className={`text-xs font-medium ${
                      isSelected ? pm.textClass : "text-gray-700"
                    }`}
                  >
                    {pm.label}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
              ₹
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount2}
              onChange={(e) => setAmount2(e.target.value)}
              placeholder="0.00"
              className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-lg font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Remaining Amount Indicator */}
      <div className="mb-4">
        <div
          className={`p-4 rounded-xl border-2 flex items-center justify-between transition-all ${
            Math.abs(remaining) < 0.01
              ? "bg-green-50 border-green-300 shadow-sm"
              : remaining > 0
              ? "bg-orange-100 border-orange-300"
              : "bg-red-50 border-red-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {Math.abs(remaining) < 0.01 ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle
                className={`w-5 h-5 ${
                  remaining > 0 ? "text-orange-600" : "text-red-600"
                }`}
              />
            )}
            <span className="font-semibold text-gray-800">
              {Math.abs(remaining) < 0.01
                ? "Perfectly Split!"
                : remaining > 0
                ? "Remaining"
                : "Over by"}
            </span>
          </div>
          <span
            className={`text-xl font-bold ${
              Math.abs(remaining) < 0.01
                ? "text-green-600"
                : remaining > 0
                ? "text-orange-600"
                : "text-red-600"
            }`}
          >
            ₹{Math.abs(remaining).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Quick Split Button */}
      <button
        onClick={handleSplit5050}
        className="w-full py-3 mb-4 bg-white hover:bg-orange-50 text-orange-600 font-semibold rounded-xl transition-colors border-2 border-orange-200 hover:border-orange-300 shadow-sm"
      >
        Split 50/50 Equally
      </button>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-3">
        <button
          onClick={handleConfirm}
          disabled={!isValid}
          className="flex-1 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-bold rounded-xl flex items-center justify-center space-x-2 shadow-md hover:shadow-lg transition-all"
        >
          <CheckCircle className="w-5 h-5" />
          <span>Confirm Split Payment</span>
        </button>
        <button
          onClick={onCancel}
          className="px-6 py-3 bg-white hover:bg-gray-50 text-gray-700 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default SplitPaymentInterface;
