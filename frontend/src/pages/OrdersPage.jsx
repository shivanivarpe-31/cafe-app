import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Printer,
  Search,
  ChefHat,
  DollarSign,
  Calendar,
  RefreshCw,
  X,
  CreditCard,
  Edit,
} from "lucide-react";
import Navbar from "../components/navbar";
import PaymentModal from "../components/PaymentModal";
import PaymentSuccess from "../components/PaymentSuccess";
import CollectPaymentModal from "../components/CollectPaymentModal";
import EditOrderModal from "../components/EditOrderModal";
import { useSmartPolling } from "../hooks/useSmartPolling";
import { showSuccess, showError } from "../utils/toast";

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Payment modal states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState(null);
  const [paymentId, setPaymentId] = useState(null);

  // Collect payment modal states
  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [selectedOrderForCollection, setSelectedOrderForCollection] = useState(
    null,
  );

  // Edit order modal states
  const [showEditOrderModal, setShowEditOrderModal] = useState(false);
  const [selectedOrderForEdit, setSelectedOrderForEdit] = useState(null);

  // Define fetchOrders with useCallback before using it in useSmartPolling
  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get("/api/orders");
      setOrders(res.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Smart polling for orders (only when page is visible and user is active)
  useSmartPolling(
    fetchOrders,
    30000, // Poll every 30 seconds when user is active
    120000, // Poll every 2 minutes when user is inactive
    300000, // Consider user inactive after 5 minutes of no activity
  );

  useEffect(() => {
    filterOrders();
    // eslint-disable-next-line
  }, [orders, selectedStatus, searchTerm]);

  const filterOrders = () => {
    let filtered = [...orders];

    if (selectedStatus !== "all") {
      filtered = filtered.filter(
        (order) => order.status?.toLowerCase() === selectedStatus.toLowerCase(),
      );
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (order) =>
          order.billNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          order.table?.number?.toString().includes(searchTerm),
      );
    }

    setFilteredOrders(filtered);
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`/api/orders/${orderId}/status`, {
        status: newStatus.toUpperCase(),
      });
      showSuccess(`Order status updated to ${newStatus.toUpperCase()}`);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus.toUpperCase() });
      }
    } catch (err) {
      showError("Failed to update order status");
      console.error(err);
    }
  };

  // Payment handlers
  const handlePaymentClick = (order) => {
    setSelectedOrderForPayment(order);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = (paidOrder) => {
    setPaymentId(paidOrder.paymentId);
    setShowPaymentModal(false);
    setShowSuccessModal(true);
    fetchOrders();
    window.dispatchEvent(new Event("order-updated"));
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    setSelectedOrderForPayment(null);
    setPaymentId(null);
  };

  // Collect payment handlers
  const handleCollectPaymentClick = async (order) => {
    try {
      // Fetch the order with detailed payment info
      const res = await axios.get(`/api/orders/pending-payments`);
      const orderWithPayments = res.data.orders.find((o) => o.id === order.id);
      if (orderWithPayments) {
        setSelectedOrderForCollection(orderWithPayments);
        setShowCollectPaymentModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch payment details:", err);
      showError("Failed to load payment details");
    }
  };

  const handleCollectPaymentSuccess = () => {
    setShowCollectPaymentModal(false);
    setSelectedOrderForCollection(null);
    fetchOrders();
    showSuccess("Payment collected successfully!");
  };

  // Edit order handlers
  const handleEditOrderClick = (order) => {
    setSelectedOrderForEdit(order);
    setShowEditOrderModal(true);
  };

  const handleOrderUpdated = (updatedOrder) => {
    setShowEditOrderModal(false);
    setSelectedOrderForEdit(null);
    fetchOrders();
    // Dispatch event for other components
    window.dispatchEvent(new Event("order-updated"));
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const printBill = (order) => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Bill #${order.billNumber}</title>
          <style>
            body { font-family: monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
            h1 { text-align: center; margin-bottom: 5px; font-size: 20px; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
            table { width: 100%; border-collapse: collapse; margin: 15px 0; }
            th, td { padding: 8px 4px; text-align: left; }
            th { border-bottom: 1px solid #000; font-weight: bold; }
            .item-row { border-bottom: 1px dashed #ccc; }
            .totals { border-top: 2px solid #000; margin-top: 10px; padding-top: 10px; }
            .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
            .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid #000; margin-top: 5px; padding-top: 5px; }
            .footer { text-align: center; margin-top: 20px; border-top: 2px dashed #000; padding-top: 10px; font-size: 12px; }
            .info { font-size: 12px; margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🍽️ CAFE POS</h1>
            <div class="info">123 Restaurant Street, City</div>
            <div class="info">Phone: +91 98765 43210</div>
          </div>
          
          <div class="info"><strong>Bill No:</strong> ${order.billNumber}</div>
          <div class="info"><strong>Table:</strong> ${
            order.table?.number || order.orderType
          }</div>
          <div class="info"><strong>Date:</strong> ${new Date(
            order.createdAt,
          ).toLocaleString()}</div>
          <div class="info"><strong>Payment:</strong> ${
            order.paymentMode?.toUpperCase() || "PENDING"
          }</div>
          
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: center;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${order.items
                ?.map(
                  (item) => `
                <tr class="item-row">
                  <td>${item.menuItem?.name || "Item"}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td style="text-align: right;">₹${Number(item.price).toFixed(
                    2,
                  )}</td>
                  <td style="text-align: right;">₹${(
                    Number(item.price) * item.quantity
                  ).toFixed(2)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
          
          <div class="totals">
            <div class="total-row"><span>Subtotal:</span><span>₹${Number(
              order.subtotal,
            ).toFixed(2)}</span></div>
            <div class="total-row"><span>GST (5%):</span><span>₹${Number(
              order.tax,
            ).toFixed(2)}</span></div>
            <div class="total-row grand-total"><span>TOTAL:</span><span>₹${Number(
              order.total,
            ).toFixed(2)}</span></div>
          </div>
          
          <div class="footer">
            <p>Thank you for visiting!</p>
            <p>Please come again</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      PENDING: { bg: "bg-yellow-100", text: "text-yellow-800", icon: Clock },
      PREPARING: {
        bg: "bg-orange-100",
        text: "text-orange-800",
        icon: ChefHat,
      },
      SERVED: { bg: "bg-blue-100", text: "text-blue-800", icon: CheckCircle },
      PAID: { bg: "bg-green-100", text: "text-green-800", icon: DollarSign },
      PARTIALLY_PAID: {
        bg: "bg-indigo-100",
        text: "text-indigo-800",
        icon: Clock,
      },
      CANCELLED: { bg: "bg-red-100", text: "text-red-800", icon: XCircle },
    };

    const config = statusConfig[status?.toUpperCase()] || statusConfig.PENDING;
    const IconComponent = config.icon;

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
      >
        <IconComponent className="w-3 h-3 mr-1" />
        {status}
      </span>
    );
  };

  const statusTabs = [
    { key: "all", label: "All Orders" },
    { key: "pending", label: "Pending" },
    { key: "preparing", label: "Preparing" },
    { key: "served", label: "Served" },
    { key: "paid", label: "Paid" },
    { key: "partially_paid", label: "Pending Payments" },
    { key: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and track all orders
              </p>
            </div>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bill number or table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedStatus(tab.key)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    selectedStatus === tab.key
                      ? "bg-red-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all ${
                order.status === "PENDING"
                  ? "border-2 border-blue-300 ring-2 ring-blue-100"
                  : "border border-gray-200"
              }`}
            >
              {/* Order Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-gray-900">
                      {order.billNumber}
                    </span>
                    {order.status === "PENDING" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        Editable
                      </span>
                    )}
                  </div>
                  {getStatusBadge(order.status)}
                </div>
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {new Date(order.createdAt).toLocaleString()}
                  </span>
                  <span>
                    {order.table
                      ? `Table ${order.table.number}`
                      : order.orderType}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              <div className="p-4 border-b border-gray-100 max-h-32 overflow-y-auto">
                {order.items?.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">
                      {item.quantity}x {item.menuItem?.name}
                    </span>
                    <span className="text-gray-500">
                      ₹{(Number(item.price) * item.quantity).toFixed(0)}
                    </span>
                  </div>
                ))}
                {order.items?.length > 3 && (
                  <p className="text-xs text-gray-400 mt-1">
                    +{order.items.length - 3} more items
                  </p>
                )}
              </div>

              {/* Order Footer */}
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="text-lg font-bold text-red-600">
                    ₹{Number(order.total).toFixed(2)}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {order.status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleEditOrderClick(order)}
                        className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg"
                        title="Edit Order"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, "PREPARING")}
                        className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg"
                      >
                        Start Preparing
                      </button>
                    </>
                  )}
                  {order.status === "PREPARING" && (
                    <button
                      onClick={() => updateOrderStatus(order.id, "SERVED")}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg"
                    >
                      Mark Served
                    </button>
                  )}
                  {order.status === "SERVED" && (
                    <button
                      onClick={() => handlePaymentClick(order)}
                      className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg"
                    >
                      Process Payment
                    </button>
                  )}
                  {order.status === "PARTIALLY_PAID" && (
                    <button
                      onClick={() => handleCollectPaymentClick(order)}
                      className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center space-x-1"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>Collect Payment</span>
                    </button>
                  )}
                  <button
                    onClick={() => viewOrderDetails(order)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => printBill(order)}
                    className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg"
                    title="Print Bill"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No orders found</p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Order #{selectedOrder.billNumber}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Status</span>
                {getStatusBadge(selectedOrder.status)}
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Table</span>
                <span className="font-medium">
                  {selectedOrder.table?.number || selectedOrder.orderType}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Created</span>
                <span className="font-medium">
                  {new Date(selectedOrder.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-2">Items</h4>
                {selectedOrder.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span>
                      {item.quantity}x {item.menuItem?.name}
                    </span>
                    <span>
                      ₹{(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>₹{Number(selectedOrder.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax (5%)</span>
                  <span>₹{Number(selectedOrder.tax).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-red-600">
                    ₹{Number(selectedOrder.total).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                {selectedOrder.status === "SERVED" && (
                  <button
                    onClick={() => {
                      setShowDetailsModal(false);
                      handlePaymentClick(selectedOrder);
                    }}
                    className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl"
                  >
                    Process Payment
                  </button>
                )}
                <button
                  onClick={() => printBill(selectedOrder)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
                >
                  Print Bill
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        order={selectedOrderForPayment}
        onPaymentSuccess={handlePaymentSuccess}
      />

      {/* Payment Success Modal */}
      <PaymentSuccess
        isOpen={showSuccessModal}
        onClose={handleSuccessClose}
        order={selectedOrderForPayment}
        paymentId={paymentId}
      />

      {/* Collect Payment Modal */}
      <CollectPaymentModal
        isOpen={showCollectPaymentModal}
        onClose={() => setShowCollectPaymentModal(false)}
        order={selectedOrderForCollection}
        onPaymentSuccess={handleCollectPaymentSuccess}
      />

      {/* Edit Order Modal */}
      <EditOrderModal
        isOpen={showEditOrderModal}
        onClose={() => setShowEditOrderModal(false)}
        order={selectedOrderForEdit}
        onOrderUpdated={handleOrderUpdated}
      />
    </div>
  );
};

export default OrdersPage;
