import React from "react";
import { CheckCircle, Download, Printer, X } from "lucide-react";

const PaymentSuccess = ({ isOpen, onClose, order, paymentId }) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>

        {/* Success Message */}
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Payment Successful!
        </h2>
        <p className="text-gray-600 mb-6">Thank you for your payment</p>

        {/* Payment Details */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Bill Number</span>
            <span className="font-semibold text-gray-900">
              {order.billNumber}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Amount Paid</span>
            <span className="font-bold text-green-600">
              ₹{parseFloat(order.total).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Payment Mode</span>
            <span className="font-medium text-gray-700">
              {order.paymentMode}
            </span>
          </div>
          {paymentId && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Transaction ID</span>
              <span className="font-mono text-xs text-gray-700">
                {paymentId}
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={handlePrint}
            className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            <Printer className="w-5 h-5" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl flex items-center justify-center space-x-2"
          >
            <CheckCircle className="w-5 h-5" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccess;
