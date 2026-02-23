import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import {
  Clock,
  Flame,
  Users,
  ChefHat,
  CheckCircle,
  AlertTriangle,
  Utensils,
  Bell,
} from "lucide-react";
import { showSuccess, showError } from "../utils/toast";
import { useSmartPolling } from "../hooks/useSmartPolling";

const KitchenDisplay = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const previousOrderIdsRef = useRef(new Set());
  const audioRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [showNewOrderAlert, setShowNewOrderAlert] = useState(false);

  // Update current time every second for live timer display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const abortControllerRef = useRef(null);

  // Fetch kitchen orders
  const fetchOrders = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    try {
      const response = await axios.get("/api/kitchen/orders", {
        signal: abortControllerRef.current.signal,
      });
      const newOrders = response.data;

      // Check for new orders (for audio notification)
      const newOrderIds = new Set(newOrders.map((o) => o.id));
      const hasNewOrders = newOrders.some(
        (order) => !previousOrderIdsRef.current.has(order.id),
      );

      if (hasNewOrders && previousOrderIdsRef.current.size > 0) {
        // Play audio notification for new orders
        playNotification();
        // Show visual alert
        setShowNewOrderAlert(true);
        setTimeout(() => setShowNewOrderAlert(false), 3000);
      }

      previousOrderIdsRef.current = newOrderIds;
      setOrders(newOrders);
      setLoading(false);
    } catch (error) {
      if (error.name === "CanceledError" || error.name === "AbortError") return;
      console.error("Fetch kitchen orders error:", error);
      showError("Failed to load kitchen orders");
      setLoading(false);
    }
  }, []);

  // Setup smart polling (5s active, 30s idle)
  useSmartPolling(fetchOrders);

  // Cleanup: abort in-flight request on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Play audio notification
  const playNotification = () => {
    if (audioRef.current) {
      audioRef.current.play().catch((err) => {
        console.log("Audio playback failed:", err);
      });
    }
  };

  // Update order status
  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`/api/orders/${orderId}/status`, { status: newStatus });
      showSuccess(`Order marked as ${newStatus.toLowerCase()}`);
      fetchOrders(); // Refresh orders
    } catch (error) {
      console.error("Update status error:", error);
      showError(error.response?.data?.error || "Failed to update order status");
    }
  };

  // Format time elapsed
  const formatTimeElapsed = (createdAt) => {
    const elapsed = Math.floor(
      (currentTime - new Date(createdAt).getTime()) / 1000,
    );
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Check if order is urgent (>15 minutes)
  const isOrderUrgent = (createdAt) => {
    const elapsed = Math.floor(
      (currentTime - new Date(createdAt).getTime()) / 1000,
    );
    return elapsed >= 900; // 15 minutes
  };

  // Group orders by status
  const pendingOrders = orders.filter((o) => o.status === "PENDING");
  const preparingOrders = orders.filter((o) => o.status === "PREPARING");
  const servedOrders = orders.filter((o) => o.status === "SERVED");

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent mb-4"></div>
          <div className="text-gray-900 text-2xl font-semibold">
            Loading Kitchen Display...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {/* Audio element for notifications */}
      <audio
        ref={audioRef}
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZSA0PVqzn77BdGAg+ltzy0H0pBSh+zPLaizsIGGS57OihUAwKTKXh8bllHAU2jtLzzn4sBS1+zPDajzwIFl+16+mlUQwJQ5zf8bxnHgU0i9Dz0YA0BiqCzvLajzsIFmS56+mjUgwJRJzg8r9qIAUyiM/z0oE2Byh/zPDckj0IWbXp7KpYEgxIo+Lxu28gBTOLz/TSgTYHKH/M8NySPQhZtejqqlYSDUej4fG7byAFM4vQ89KBNgcof8zw3JI9CFm16OqqVhINR6Ph8btvIAUzi9Dz0oE2Byh/zPDckj0IWbXo6qpWEg1Ho+Hxu28gBTOL0PPSgTYHKH/M8NySPQhZtejqqlaSDkbe3/LAciUGJ33N8N2SPQhYtunqqlYSDkbe3/LAciUGJ33N8N2SPQhYtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33N8N2SPAhZtunqqlYSDkbe3/LAciUGJ33O8d2SPAhZtunqqlYSDkbe3/LAciUGJ33O8d2SPAhZtunqqlYSDkfgwe"
        preload="auto"
      />

      {/* New Order Alert Banner */}
      {showNewOrderAlert && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-8 py-4 rounded-2xl shadow-2xl flex items-center space-x-3">
            <Bell className="w-8 h-8 animate-pulse" />
            <span className="text-2xl font-bold">NEW ORDER RECEIVED!</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-lg border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-br from-red-500 to-red-600 p-4 rounded-2xl shadow-lg">
                <ChefHat className="w-10 h-10 md:w-12 md:h-12 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-600">
                  Kitchen Display
                </h1>
                <p className="text-gray-600 mt-1 text-sm md:text-base flex items-center space-x-2">
                  <Utensils className="w-4 h-4" />
                  <span>Real-time Order Management</span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4 md:space-x-6">
              {/* Active Orders Counter */}
              <div className="bg-red-50 rounded-2xl px-6 py-4 text-center border-2 border-red-200">
                <div className="text-4xl md:text-5xl font-bold text-red-600">
                  {orders.length}
                </div>
                <div className="text-gray-600 text-xs md:text-sm font-medium mt-1">
                  Active Orders
                </div>
              </div>

              {/* Live Clock */}
              <div className="bg-gray-100 rounded-2xl px-6 py-4 text-center border-2 border-gray-300">
                <div className="text-2xl md:text-3xl font-mono font-bold text-gray-900">
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <div className="text-gray-600 text-xs md:text-sm font-medium mt-1">
                  Current Time
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Orders Grid - Kanban Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* NEW ORDERS Column */}
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  NEW ORDERS
                </h2>
              </div>
              <div className="bg-white text-red-600 font-bold text-2xl md:text-3xl rounded-xl px-4 py-2 shadow-lg">
                {pendingOrders.length}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                statusColor="red"
                isUrgent={isOrderUrgent(order.createdAt)}
                timeElapsed={formatTimeElapsed(order.createdAt)}
                onStatusChange={updateOrderStatus}
                nextStatus="PREPARING"
                nextStatusLabel="Start Cooking"
              />
            ))}
            {pendingOrders.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-200 shadow-sm">
                <CheckCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  No new orders
                </p>
              </div>
            )}
          </div>
        </div>

        {/* PREPARING Column */}
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-xl animate-pulse">
                  <Flame className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  PREPARING
                </h2>
              </div>
              <div className="bg-white text-orange-600 font-bold text-2xl md:text-3xl rounded-xl px-4 py-2 shadow-lg">
                {preparingOrders.length}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {preparingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                statusColor="orange"
                isUrgent={isOrderUrgent(order.createdAt)}
                timeElapsed={formatTimeElapsed(order.createdAt)}
                onStatusChange={updateOrderStatus}
                nextStatus="SERVED"
                nextStatusLabel="Mark Ready"
              />
            ))}
            {preparingOrders.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-200 shadow-sm">
                <Flame className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  No orders cooking
                </p>
              </div>
            )}
          </div>
        </div>

        {/* READY/SERVED Column */}
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">
                  READY
                </h2>
              </div>
              <div className="bg-white text-green-600 font-bold text-2xl md:text-3xl rounded-xl px-4 py-2 shadow-lg">
                {servedOrders.length}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {servedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                statusColor="green"
                isUrgent={isOrderUrgent(order.createdAt)}
                timeElapsed={formatTimeElapsed(order.createdAt)}
                onStatusChange={updateOrderStatus}
                nextStatus={null}
                nextStatusLabel={null}
              />
            ))}
            {servedOrders.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border-2 border-gray-200 shadow-sm">
                <Utensils className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg font-medium">
                  No orders ready
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Order Card Component
const OrderCard = ({
  order,
  statusColor,
  isUrgent,
  timeElapsed,
  onStatusChange,
  nextStatus,
  nextStatusLabel,
}) => {
  const getCardStyles = () => {
    const baseStyles =
      "transform transition-all duration-300 hover:scale-105 hover:shadow-xl";

    switch (statusColor) {
      case "red":
        return `${baseStyles} bg-white border-2 ${
          isUrgent
            ? "border-red-500 animate-pulse shadow-lg shadow-red-200"
            : "border-red-200 shadow-md"
        }`;
      case "orange":
        return `${baseStyles} bg-white border-2 ${
          isUrgent
            ? "border-orange-500 animate-pulse shadow-lg shadow-orange-200"
            : "border-orange-200 shadow-md"
        }`;
      case "green":
        return `${baseStyles} bg-white border-2 border-green-200 shadow-md`;
      default:
        return baseStyles;
    }
  };

  return (
    <div className={`${getCardStyles()} rounded-2xl p-5`}>
      {/* Order Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          {order.table ? (
            <>
              <div className="bg-red-50 p-2 rounded-lg">
                <Users className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-bold text-xl text-gray-900">
                  Table {order.table.number}
                </div>
                <div className="text-xs text-gray-500">Dine-in</div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-red-50 p-2 rounded-lg">
                <ChefHat className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="font-bold text-xl text-gray-900">
                  {order.orderType}
                </div>
                <div className="text-xs text-gray-500">Takeaway</div>
              </div>
            </>
          )}
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Bill No.</div>
          <div className="text-sm font-bold text-gray-900">
            #{order.billNumber}
          </div>
        </div>
      </div>

      {/* Timer Display */}
      <div
        className={`flex items-center justify-center space-x-3 mb-4 p-4 rounded-xl ${
          isUrgent
            ? "bg-gradient-to-r from-red-500 to-red-600 animate-pulse"
            : "bg-gray-100 border border-gray-300"
        }`}
      >
        <Clock
          className={`w-6 h-6 ${isUrgent ? "text-white" : "text-gray-700"} ${
            isUrgent ? "animate-pulse" : ""
          }`}
        />
        <span
          className={`text-3xl font-mono font-bold ${
            isUrgent ? "text-white" : "text-gray-900"
          }`}
        >
          {timeElapsed}
        </span>
        {isUrgent && (
          <AlertTriangle className="w-6 h-6 text-yellow-300 animate-bounce" />
        )}
      </div>

      {/* Order Items */}
      <div className="space-y-3 mb-4">
        {order.items.map((item) => (
          <div
            key={item.id}
            className="bg-gray-50 rounded-xl p-3 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-gray-900 text-base">
                <span className="inline-block bg-red-100 text-red-700 rounded-lg px-2 py-1 text-sm mr-2">
                  {item.quantity}x
                </span>
                {item.menuItem.name}
              </span>
              <span className="text-gray-500 text-xs bg-gray-200 px-2 py-1 rounded-lg">
                {item.menuItem.category.name}
              </span>
            </div>
            {item.notes && (
              <div className="flex items-start space-x-2 mt-2 p-2 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-yellow-800 font-medium italic">
                  {item.notes}
                </span>
              </div>
            )}
            {item.modifications && item.modifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {item.modifications.map((mod) => (
                  <span
                    key={mod.id}
                    className="text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-lg border border-blue-200"
                  >
                    + {mod.modification.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action Button */}
      {nextStatus ? (
        <button
          onClick={() => onStatusChange(order.id, nextStatus)}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 active:scale-95 shadow-lg ${
            statusColor === "red"
              ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
              : statusColor === "orange"
              ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
              : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
          }`}
        >
          {nextStatusLabel}
        </button>
      ) : (
        <div className="w-full py-4 text-center rounded-xl bg-green-50 border-2 border-green-200">
          <div className="flex items-center justify-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-600 font-semibold text-lg">
              Ready for Service
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
