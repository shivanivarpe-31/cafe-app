import React, { useState, useCallback } from "react";
import axios from "axios";
import { Clock, User, Phone, MapPin, CreditCard } from "lucide-react";
import CollectPaymentModal from "../components/CollectPaymentModal";
import { useSmartPolling } from "../hooks/useSmartPolling";

const PendingPaymentsPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Define fetchPendingPayments with useCallback before using it in useSmartPolling
  const fetchPendingPayments = useCallback(async () => {
    try {
      const res = await axios.get("/api/orders/pending-payments");
      setOrders(res.data.orders);
    } catch (error) {
      console.error("Error fetching pending payments:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Smart polling for pending payments (only when page is visible and user is active)
  useSmartPolling(
    fetchPendingPayments,
    30000, // Poll every 30 seconds when user is active
    120000, // Poll every 2 minutes when user is inactive
    300000, // Consider user inactive after 5 minutes of no activity
  );

  const handleCollectPayment = (order) => {
    setSelectedOrder(order);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    fetchPendingPayments();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Pending Payments
      </h1>

      {loading ? (
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-gray-600">Loading...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <Clock className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No pending payments</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-lg">
                    Bill #{order.billNumber}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total</p>
                  <p className="text-xl font-bold text-gray-900">
                    ₹{parseFloat(order.total).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Customer Details */}
              {order.deliveryInfo && (
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center space-x-2 mb-1">
                    <User className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium">
                      {order.deliveryInfo.customerName}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 mb-1">
                    <Phone className="w-4 h-4 text-gray-600" />
                    <span className="text-sm text-gray-600">
                      {order.deliveryInfo.customerPhone}
                    </span>
                  </div>
                  {order.deliveryInfo.deliveryAddress && (
                    <div className="flex items-center space-x-2">
                      <MapPin className="w-4 h-4 text-gray-600" />
                      <span className="text-sm text-gray-600">
                        {order.deliveryInfo.deliveryAddress}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Payment Status */}
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg mb-3">
                <div>
                  <p className="text-sm text-gray-600">Paid</p>
                  <p className="font-semibold text-green-600">
                    ₹{order.totalPaid.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Remaining</p>
                  <p className="font-bold text-orange-600">
                    ₹{order.remainingBalance.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Payment History */}
              {order.payments.filter(
                (p) => p.status === "SUCCESS" && p.amount > 0,
              ).length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">
                    Payment History
                  </p>
                  {order.payments
                    .filter((p) => p.status === "SUCCESS" && p.amount > 0)
                    .map((payment, idx) => (
                      <div
                        key={payment.id}
                        className="text-xs text-gray-600 flex justify-between"
                      >
                        <span>
                          Payment {idx + 1} ({payment.paymentMode})
                        </span>
                        <span>₹{parseFloat(payment.amount).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
              )}

              <button
                onClick={() => handleCollectPayment(order)}
                className="w-full py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-semibold rounded-lg flex items-center justify-center space-x-2"
              >
                <CreditCard className="w-5 h-5" />
                <span>Collect Payment</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {showPaymentModal && (
        <CollectPaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          order={selectedOrder}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default PendingPaymentsPage;
