import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import {
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  Printer,
  Search,
  ChefHat,
  DollarSign,
  RefreshCw,
  X,
  CreditCard,
  Edit,
  Package,
  Truck,
  UtensilsCrossed,
} from "lucide-react";
import Navbar from "../components/navbar";
import PaymentModal from "../components/PaymentModal";
import PaymentSuccess from "../components/PaymentSuccess";
import CollectPaymentModal from "../components/CollectPaymentModal";
import EditOrderModal from "../components/EditOrderModal";
import { useSmartPolling } from "../hooks/useSmartPolling";
import { showSuccess, showError } from "../utils/toast";
import config from "../config/businessConfig";

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

  const abortControllerRef = useRef(null);

  // Define fetchOrders with useCallback before using it in useSmartPolling
  const fetchOrders = useCallback(async () => {
    // Abort any previous in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    try {
      setLoading(true);
      const res = await axios.get("/api/orders", {
        signal: abortControllerRef.current.signal,
      });
      setOrders(res.data.data || res.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
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

  // Cleanup: abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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
          order.table?.number?.toString().includes(searchTerm) ||
          order.customerName
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          order.customerPhone?.includes(searchTerm),
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
    if (!printWindow) {
      showError(
        "Popup blocked — please allow popups for this site to print bills.",
      );
      return;
    }
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
            <h1>🍽️ ${config.restaurant.name}</h1>
            <div class="info">${config.restaurant.address}</div>
            <div class="info">Phone: ${config.restaurant.phone}</div>
          </div>
          
          <div class="info"><strong>Bill No:</strong> ${order.billNumber}</div>
          ${
            order.customerName
              ? `<div class="info"><strong>Customer:</strong> ${order.customerName}</div>`
              : ""
          }
          ${
            order.customerPhone
              ? `<div class="info"><strong>Mobile:</strong> ${order.customerPhone}</div>`
              : ""
          }
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
            <div class="total-row"><span>${config.tax.label}:</span><span>${
      config.currency.symbol
    }${Number(order.tax).toFixed(2)}</span></div>
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
    { key: "all", label: "All Orders", icon: Package },
    { key: "pending", label: "Pending", icon: Clock },
    { key: "preparing", label: "Preparing", icon: ChefHat },
    { key: "served", label: "Served", icon: CheckCircle },
    { key: "paid", label: "Paid", icon: DollarSign },
    { key: "partially_paid", label: "Pending Payments", icon: CreditCard },
    { key: "cancelled", label: "Cancelled", icon: XCircle },
  ];

  // Calculate order stats
  const orderStats = useMemo(() => {
    const counts = {
      all: orders.length,
      pending: 0,
      preparing: 0,
      served: 0,
      paid: 0,
      partially_paid: 0,
      cancelled: 0,
    };
    orders.forEach((order) => {
      const status = order.status?.toLowerCase();
      if (counts.hasOwnProperty(status)) {
        counts[status]++;
      }
    });
    return counts;
  }, [orders]);

  // Skeleton loader component
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-2">
          <div className="h-5 w-24 bg-gray-200 rounded"></div>
          <div className="h-5 w-20 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-4 w-40 bg-gray-100 rounded"></div>
      </div>
      <div className="p-4 border-b border-gray-100">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-gray-100 rounded"></div>
          <div className="h-4 w-28 bg-gray-100 rounded"></div>
        </div>
      </div>
      <div className="p-4">
        <div className="flex justify-between mb-3">
          <div className="h-4 w-12 bg-gray-200 rounded"></div>
          <div className="h-6 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="flex space-x-2">
          <div className="flex-1 h-10 bg-gray-200 rounded-lg"></div>
          <div className="h-10 w-10 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    </div>
  );

  // Get order type icon
  const getOrderTypeIcon = (order) => {
    if (order.orderType === "DELIVERY") return <Truck className="w-4 h-4" />;
    if (order.orderType === "TAKEAWAY") return <Package className="w-4 h-4" />;
    return <UtensilsCrossed className="w-4 h-4" />;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Package className="w-7 h-7 mr-3 text-red-500" />
                Orders
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and track all orders
              </p>
            </div>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              title="Refresh orders"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by bill number or table..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm transition-colors"
              />
            </div>

            {/* Status Tabs */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => {
                const TabIcon = tab.icon;
                const count = orderStats[tab.key] || 0;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setSelectedStatus(tab.key)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                      selectedStatus === tab.key
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span
                        className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                          selectedStatus === tab.key
                            ? "bg-white/20 text-white"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && orders.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Orders Grid */}
        {(!loading || orders.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-white rounded-2xl shadow-sm overflow-hidden hover:shadow-lg transition-all duration-200 ${
                  order.status === "PENDING"
                    ? "border-2 border-yellow-300 ring-2 ring-yellow-100"
                    : order.status === "PREPARING"
                    ? "border-2 border-orange-300 ring-2 ring-orange-100"
                    : order.status === "SERVED"
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
                      {(order.status === "PENDING" ||
                        order.status === "PREPARING" ||
                        order.status === "SERVED") && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            order.status === "PENDING"
                              ? "bg-yellow-100 text-yellow-700"
                              : order.status === "PREPARING"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          Editable
                        </span>
                      )}
                    </div>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <span className="flex items-center">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {new Date(order.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="flex items-center space-x-1">
                      {getOrderTypeIcon(order)}
                      <span>
                        {order.table
                          ? `Table ${order.table.number}`
                          : order.orderType?.replace("_", " ")}
                      </span>
                    </span>
                  </div>
                  {(order.customerName || order.customerPhone) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
                      <span className="text-xs font-medium text-gray-700 truncate max-w-[50%]">
                        👤 {order.customerName || "—"}
                      </span>
                      {order.customerPhone && (
                        <span className="text-xs text-gray-500">
                          📞 {order.customerPhone}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Order Items */}
                <div className="p-4 border-b border-gray-100 max-h-32 overflow-y-auto bg-gray-50/50">
                  {order.items?.slice(0, 3).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between text-sm mb-1.5 last:mb-0"
                    >
                      <span className="text-gray-700 font-medium">
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
                    <span className="text-xl font-bold text-red-600">
                      ₹{Number(order.total).toFixed(0)}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    {order.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleEditOrderClick(order)}
                          className="p-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 rounded-lg transition-colors"
                          title="Edit Order"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            updateOrderStatus(order.id, "PREPARING")
                          }
                          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <ChefHat className="w-4 h-4" />
                          <span>Start Preparing</span>
                        </button>
                        <button
                          onClick={() =>
                            updateOrderStatus(order.id, "CANCELLED")
                          }
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {order.status === "PREPARING" && (
                      <>
                        <button
                          onClick={() => handleEditOrderClick(order)}
                          className="p-2 bg-orange-100 hover:bg-orange-200 text-orange-600 rounded-lg transition-colors"
                          title="Edit Order"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, "SERVED")}
                          className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Mark Served</span>
                        </button>
                        <button
                          onClick={() =>
                            updateOrderStatus(order.id, "CANCELLED")
                          }
                          className="p-2 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg transition-colors"
                          title="Cancel Order"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {order.status === "SERVED" && (
                      <>
                        <button
                          onClick={() => handleEditOrderClick(order)}
                          className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-colors"
                          title="Edit Order"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePaymentClick(order)}
                          className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1"
                        >
                          <DollarSign className="w-4 h-4" />
                          <span>Process Payment</span>
                        </button>
                      </>
                    )}
                    {order.status === "PARTIALLY_PAID" && (
                      <button
                        onClick={() => handleCollectPaymentClick(order)}
                        className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>Collect Payment</span>
                      </button>
                    )}
                    <button
                      onClick={() => viewOrderDetails(order)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => printBill(order)}
                      className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg transition-colors"
                      title="Print Bill"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredOrders.length === 0 && !loading && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">
              No orders found
            </h3>
            <p className="text-gray-500 text-sm">
              {selectedStatus !== "all"
                ? `No ${selectedStatus.replace("_", " ")} orders at the moment`
                : searchTerm
                ? "Try adjusting your search"
                : "Orders will appear here when customers place them"}
            </p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-details-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                id="order-details-title"
                className="text-xl font-bold text-gray-900"
              >
                Order #{selectedOrder.billNumber}
              </h3>
              <button
                onClick={() => setShowDetailsModal(false)}
                aria-label="Close modal"
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Status</p>
                  {getStatusBadge(selectedOrder.status)}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Location</p>
                  <p className="font-semibold text-gray-900">
                    {selectedOrder.table?.number
                      ? `Table ${selectedOrder.table.number}`
                      : selectedOrder.orderType?.replace("_", " ")}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">Time</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(selectedOrder.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              {(selectedOrder.customerName || selectedOrder.customerPhone) && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-center gap-4">
                  <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <span className="text-base">👤</span>
                  </div>
                  <div>
                    {selectedOrder.customerName && (
                      <p className="text-sm font-semibold text-gray-900">
                        {selectedOrder.customerName}
                      </p>
                    )}
                    {selectedOrder.customerPhone && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        📞 {selectedOrder.customerPhone}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3 flex items-center">
                  <Package className="w-4 h-4 mr-2 text-gray-400" />
                  Items ({selectedOrder.items?.length || 0})
                </h4>
                <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between py-1">
                      <span className="font-medium">
                        {item.quantity}x {item.menuItem?.name}
                      </span>
                      <span className="text-gray-600">
                        ₹{(Number(item.price) * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₹{Number(selectedOrder.subtotal).toFixed(0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{config.tax.label}</span>
                  <span>
                    {config.currency.symbol}
                    {Number(selectedOrder.tax).toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>Total</span>
                  <span className="text-red-600">
                    ₹{Number(selectedOrder.total).toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                {selectedOrder.status === "SERVED" && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEditOrderClick(selectedOrder);
                      }}
                      className="py-3 px-4 bg-blue-100 hover:bg-blue-200 text-blue-600 font-semibold rounded-xl"
                    >
                      Edit Order
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        handlePaymentClick(selectedOrder);
                      }}
                      className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-xl"
                    >
                      Process Payment
                    </button>
                  </>
                )}
                {selectedOrder.status === "PREPARING" && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEditOrderClick(selectedOrder);
                      }}
                      className="py-3 px-4 bg-orange-100 hover:bg-orange-200 text-orange-600 font-semibold rounded-xl"
                    >
                      Edit Order
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        updateOrderStatus(selectedOrder.id, "SERVED");
                      }}
                      className="flex-1 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl"
                    >
                      Mark Served
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        updateOrderStatus(selectedOrder.id, "CANCELLED");
                      }}
                      className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-600 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                  </>
                )}
                {selectedOrder.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        handleEditOrderClick(selectedOrder);
                      }}
                      className="py-3 px-4 bg-yellow-100 hover:bg-yellow-200 text-yellow-600 font-semibold rounded-xl"
                    >
                      Edit Order
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        updateOrderStatus(selectedOrder.id, "PREPARING");
                      }}
                      className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl"
                    >
                      Start Preparing
                    </button>
                    <button
                      onClick={() => {
                        setShowDetailsModal(false);
                        updateOrderStatus(selectedOrder.id, "CANCELLED");
                      }}
                      className="py-3 px-4 bg-red-100 hover:bg-red-200 text-red-600 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                  </>
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
