import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useMenu } from "../context/MenuContext";
import {
  DollarSign,
  ShoppingCart,
  Users,
  AlertTriangle,
  Clock,
  Eye,
  RefreshCw,
  Plus,
  CheckCircle,
  Truck,
  Bell,
  Volume2,
  VolumeX,
  Link as LinkIcon,
  ChefHat,
  Keyboard,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import Navbar from "../components/navbar";
import TableMergeModal from "../components/TableMergeModal";
import KeyboardShortcutsHelp from "../components/KeyboardShortcutsHelp";
import { useSmartPolling } from "../hooks/useSmartPolling";
import {
  useKeyboardShortcuts,
  useNavigationShortcuts,
} from "../hooks/useKeyboardShortcuts";
import { showSuccess, showError, showWarning } from "../utils/toast";
import {
  POLLING_INTERVALS,
  ALERT_DURATION,
  MAX_DELIVERY_ORDERS_PREVIEW,
  MAX_RECENT_ORDERS,
  DASHBOARD_SECTIONS,
  NOTIFICATION_SOUNDS,
  VOICE_SETTINGS,
} from "../utils/dashboardConstants";
import {
  getStatus,
  getTableColor,
  getStatusBadge,
  getPlatformStyle,
  getPlatformBorder,
  getDeliveryStatusColor,
  getTimeRemaining,
  getTimeAgo,
  calculateOccupancyPercentage,
  getActiveDeliveryOrders,
  detectNewOrders,
  validateReservationData,
} from "../utils/dashboardHelpers";

const Dashboard = () => {
  const { menuItems } = useMenu();
  const navigate = useNavigate();

  // Core states
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    lowStockCount: 0,
    totalItemsSold: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dashboard-specific states
  const [selectedSection, setSelectedSection] = useState("All Tables");
  const [tables, setTables] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [showReservationForm, setShowReservationForm] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [reservationData, setReservationData] = useState({
    tableId: "",
    customerName: "",
    customerPhone: "",
    reservedFrom: "",
    reservedUntil: "",
  });

  // Online delivery orders state
  const [deliveryOrders, setDeliveryOrders] = useState([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Loading states for async actions
  const [clearingTable, setClearingTable] = useState(null);
  const [updatingDeliveryStatus, setUpdatingDeliveryStatus] = useState(null);

  // Use ref to track previous order IDs (doesn't cause re-renders)
  const previousOrderIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const abortControllerRef = useRef(null);

  // Sections shown as filter buttons
  const sections = DASHBOARD_SECTIONS;

  // Global navigation shortcuts
  useNavigationShortcuts();

  // Dashboard-specific shortcuts
  useKeyboardShortcuts({
    "1": () => setSelectedSection("All Tables"),
    "2": () => setSelectedSection("Available"),
    "3": () => setSelectedSection("Occupied"),
    "4": () => setSelectedSection("Reserved"),
    "?": () => setShowShortcutsHelp(true),
    escape: () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (showReservationForm) setShowReservationForm(false);
      else if (showMergeModal) setShowMergeModal(false);
    },
  });

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();

      // First ding
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = NOTIFICATION_SOUNDS.FIRST_DING;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.5,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);

      // Second ding
      setTimeout(() => {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.frequency.value = NOTIFICATION_SOUNDS.SECOND_DING;
        osc2.type = "sine";

        gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(
          0.01,
          audioContext.currentTime + 0.5,
        );

        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.5);
      }, NOTIFICATION_SOUNDS.DELAY_MS);

      // Voice alert
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(VOICE_SETTINGS.TEXT);
        utterance.rate = VOICE_SETTINGS.RATE;
        utterance.pitch = VOICE_SETTINGS.PITCH;
        utterance.volume = VOICE_SETTINGS.VOLUME;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Error playing sound:", err);
    }
  }, [soundEnabled]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setRefreshing(true);
    try {
      const results = await Promise.allSettled([
        axios.get("/api/reports/stats", {
          signal: abortControllerRef.current.signal,
        }),
        axios.get("/api/tables", { signal: abortControllerRef.current.signal }),
        axios.get("/api/delivery", {
          signal: abortControllerRef.current.signal,
        }),
      ]);

      const [statsRes, tablesRes, deliveryRes] = results;

      // Handle tables
      if (tablesRes.status === "fulfilled") {
        setTables(tablesRes.value.data || []);
      } else {
        setTables([]);
      }

      // Handle stats
      if (statsRes.status === "fulfilled") {
        const statsData = statsRes.value.data || {};
        setStats(statsData);
        setRecentOrders(
          (statsData.recentOrders || []).slice(0, MAX_RECENT_ORDERS),
        );
      } else {
        setStats({
          todaySales: 0,
          todayOrders: 0,
          lowStockCount: 0,
          totalItemsSold: 0,
        });
        setRecentOrders([]);
      }

      // Handle delivery orders
      if (deliveryRes.status === "fulfilled") {
        const orders = deliveryRes.value.data || [];
        const activeOrders = getActiveDeliveryOrders(orders);

        if (!isFirstLoadRef.current) {
          const newOrders = detectNewOrders(
            activeOrders,
            previousOrderIdsRef.current,
          );

          if (newOrders.length > 0) {
            playNotificationSound();
            setNewOrderAlert(true);
            setTimeout(() => setNewOrderAlert(false), ALERT_DURATION);
          }

          previousOrderIdsRef.current = new Set(activeOrders.map((o) => o.id));
        } else {
          previousOrderIdsRef.current = new Set(activeOrders.map((o) => o.id));
          isFirstLoadRef.current = false;
        }

        setDeliveryOrders(activeOrders);
      } else {
        setDeliveryOrders([]);
      }
    } catch (err) {
      if (err.name === "AbortError" || err.name === "CanceledError") {
        return;
      }
      console.error("Error fetching dashboard data:", err);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [playNotificationSound]);

  // Smart polling
  useSmartPolling(
    fetchDashboardData,
    POLLING_INTERVALS.ACTIVE_POLL,
    POLLING_INTERVALS.IDLE_POLL,
    POLLING_INTERVALS.INACTIVE_AFTER,
  );

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Listen for order updates from other components
  useEffect(() => {
    const handleOrderUpdated = () => {
      fetchDashboardData();
    };
    window.addEventListener("order-updated", handleOrderUpdated);

    return () => {
      window.removeEventListener("order-updated", handleOrderUpdated);
    };
  }, [fetchDashboardData]);

  // Memoized values
  const filteredTables = useMemo(() => {
    return tables.filter((t) => {
      if (!t) return false;
      const status = getStatus(t.status);
      if (selectedSection === "All Tables") return true;
      if (selectedSection === "Available") return status === "available";
      if (selectedSection === "Occupied") return status === "occupied";
      if (selectedSection === "Reserved") return status === "reserved";
      return true;
    });
  }, [tables, selectedSection]);

  const occupiedCount = useMemo(() => {
    return tables.filter((t) => getStatus(t.status) === "occupied").length;
  }, [tables]);

  const occupancyPct = useMemo(() => {
    return calculateOccupancyPercentage(tables);
  }, [tables]);

  // Quick action: clear table
  const requestClearTable = async (tableId) => {
    if (
      !window.confirm(
        "Are you sure you want to clear this table and mark it as available?",
      )
    ) {
      return;
    }

    setClearingTable(tableId);
    try {
      await axios.put(`/api/orders/tables/${tableId}/status`, {
        status: "AVAILABLE",
      });
      showSuccess("Table cleared successfully");
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to clear table:", err);
      showError(err.response?.data?.error || "Failed to clear table");
    } finally {
      setClearingTable(null);
    }
  };

  // Create reservation
  const createReservation = async (e) => {
    e.preventDefault();

    const validation = validateReservationData(reservationData);
    if (!validation.valid) {
      showWarning(validation.error);
      return;
    }

    const {
      tableId,
      customerName,
      customerPhone,
      reservedFrom,
      reservedUntil,
    } = reservationData;

    try {
      await axios.post("/api/tables/reserve", {
        tableId,
        customerName,
        customerPhone,
        reservedFrom,
        reservedUntil,
      });

      setReservationData({
        tableId: "",
        customerName: "",
        customerPhone: "",
        reservedFrom: "",
        reservedUntil: "",
      });
      setShowReservationForm(false);
      showSuccess("Reservation created successfully!");
      fetchDashboardData();
    } catch (err) {
      console.error("Reservation error:", err);
      showError(err.response?.data?.error || "Failed to create reservation");
    }
  };

  // Handle delivery order click
  const handleDeliveryOrderClick = (orderId) => {
    navigate(`/delivery?orderId=${orderId}`);
  };

  // Quick update delivery status
  const updateDeliveryStatus = async (orderId, newStatus, e) => {
    e.stopPropagation();

    setUpdatingDeliveryStatus(orderId);
    try {
      await axios.put(`/api/delivery/${orderId}/status`, {
        deliveryStatus: newStatus,
      });
      showSuccess(`Order status updated to ${newStatus.replace(/_/g, " ")}`);
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to update status:", err);
      showError(err.response?.data?.error || "Failed to update status");
    } finally {
      setUpdatingDeliveryStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Navbar />
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const simulateOnlineOrder = async (platform) => {
    try {
      const res = await axios.post("/api/delivery/simulate", { platform });
      console.log(`✅ Simulated ${platform} order:`, res.data.billNumber);
      showSuccess(`Test ${platform} order created`);
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to simulate order:", err);
      showError("Failed to simulate order");
    }
  };

  // Only show test buttons in development
  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* New Order Alert Banner */}
      {newOrderAlert && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-500 to-orange-500 text-white py-3 px-6 flex items-center justify-center space-x-3 animate-pulse">
          <Bell className="w-6 h-6 animate-bounce" />
          <span className="text-lg font-bold">
            🔔 New Online Order Received!
          </span>
          <Bell className="w-6 h-6 animate-bounce" />
        </div>
      )}

      {/* Stats Bar */}
      <div
        className={`bg-white border-b border-gray-200 py-5 ${
          newOrderAlert ? "mt-12" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              Dashboard Overview
            </h2>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="hidden sm:flex items-center space-x-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all"
                title="Keyboard Shortcuts (?)"
              >
                <Keyboard className="w-4 h-4" />
                <span>Shortcuts</span>
              </button>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-lg transition-all ${
                  soundEnabled
                    ? "bg-green-100 text-green-600 hover:bg-green-200"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                }`}
                title={soundEnabled ? "Sound On" : "Sound Off"}
              >
                {soundEnabled ? (
                  <Volume2 className="w-5 h-5" />
                ) : (
                  <VolumeX className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={fetchDashboardData}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                <span>{refreshing ? "Updating..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
            <div className="flex items-center space-x-3 group hover:shadow-md transition-all p-3 rounded-xl">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center group-hover:bg-red-200 transition-colors">
                <DollarSign className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Today's Sales
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  ₹{Number(stats.todaySales || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 group hover:shadow-md transition-all p-3 rounded-xl">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Today's Orders
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.todayOrders || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 group hover:shadow-md transition-all p-3 rounded-xl">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Active Tables
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {occupiedCount}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 group hover:shadow-md transition-all p-3 rounded-xl">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Low Stock</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.lowStockCount || 0}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 group hover:shadow-md transition-all p-3 rounded-xl">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  deliveryOrders.length > 0
                    ? "bg-green-100 group-hover:bg-green-200"
                    : "bg-gray-100 group-hover:bg-gray-200"
                }`}
              >
                <Truck
                  className={`w-6 h-6 ${
                    deliveryOrders.length > 0
                      ? "text-green-600"
                      : "text-gray-600"
                  }`}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">
                  Online Orders
                </p>
                <p
                  className={`text-2xl font-bold ${
                    deliveryOrders.length > 0
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}
                >
                  {deliveryOrders.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Online Delivery Orders Section */}
        {deliveryOrders.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border-2 border-red-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center">
                <div className="relative mr-3">
                  <Truck className="w-6 h-6 text-red-500" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                </div>
                Online Orders
                <span className="ml-3 px-3 py-1 bg-red-500 text-white text-sm rounded-full">
                  {deliveryOrders.length} Active
                </span>
              </h3>
              <Link
                to="/delivery"
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold transition-all"
              >
                View All Orders →
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deliveryOrders
                .slice(0, MAX_DELIVERY_ORDERS_PREVIEW)
                .map((order) => (
                  <div
                    key={order.id}
                    onClick={() => handleDeliveryOrderClick(order.id)}
                    className={`relative cursor-pointer rounded-xl border-2 p-4 transition-all hover:shadow-lg hover:-translate-y-1 ${getPlatformBorder(
                      order.deliveryInfo?.deliveryPlatform,
                    )}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getPlatformStyle(
                          order.deliveryInfo?.deliveryPlatform,
                        )}`}
                      >
                        {order.deliveryInfo?.deliveryPlatform || "DIRECT"}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getDeliveryStatusColor(
                          order.deliveryInfo?.deliveryStatus,
                        )}`}
                      >
                        {order.deliveryInfo?.deliveryStatus?.replace(
                          /_/g,
                          " ",
                        ) || order.status}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900">
                          {order.billNumber}
                        </span>
                        <span className="text-xs text-gray-500">
                          {getTimeAgo(order.createdAt)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-gray-800">
                        {order.deliveryInfo?.customerName}
                      </p>
                      <p className="text-xs text-gray-500">
                        📞 {order.deliveryInfo?.customerPhone}
                      </p>

                      {order.deliveryInfo?.deliveryAddress && (
                        <p className="text-xs text-gray-500 truncate">
                          📍 {order.deliveryInfo.deliveryAddress}
                        </p>
                      )}

                      <div className="pt-2 border-t border-gray-200">
                        <p className="text-xs text-gray-600">
                          {order.items?.length || 0} items •
                          <span className="font-bold text-red-600 ml-1">
                            ₹{parseFloat(order.total).toFixed(0)}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex space-x-2">
                      {order.deliveryInfo?.deliveryStatus === "PENDING" && (
                        <button
                          onClick={(e) =>
                            updateDeliveryStatus(order.id, "PREPARING", e)
                          }
                          disabled={updatingDeliveryStatus === order.id}
                          className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {updatingDeliveryStatus === order.id
                            ? "Updating..."
                            : "Accept & Prepare"}
                        </button>
                      )}
                      {order.deliveryInfo?.deliveryStatus === "PREPARING" && (
                        <button
                          onClick={(e) =>
                            updateDeliveryStatus(
                              order.id,
                              "READY_FOR_PICKUP",
                              e,
                            )
                          }
                          disabled={updatingDeliveryStatus === order.id}
                          className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {updatingDeliveryStatus === order.id
                            ? "Updating..."
                            : "Mark Ready"}
                        </button>
                      )}
                      {order.deliveryInfo?.deliveryStatus ===
                        "READY_FOR_PICKUP" && (
                        <button
                          onClick={(e) =>
                            updateDeliveryStatus(
                              order.id,
                              "OUT_FOR_DELIVERY",
                              e,
                            )
                          }
                          disabled={updatingDeliveryStatus === order.id}
                          className="flex-1 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
                        >
                          {updatingDeliveryStatus === order.id
                            ? "Updating..."
                            : "Out for Delivery"}
                        </button>
                      )}
                    </div>

                    {order.deliveryInfo?.deliveryStatus === "PENDING" && (
                      <div className="absolute -top-2 -right-2">
                        <span className="flex h-5 w-5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 items-center justify-center">
                            <Bell className="w-3 h-3 text-white" />
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>

            {deliveryOrders.length > MAX_DELIVERY_ORDERS_PREVIEW && (
              <div className="mt-4 text-center">
                <Link
                  to="/delivery"
                  className="text-red-600 hover:text-red-700 font-semibold text-sm"
                >
                  +{deliveryOrders.length - MAX_DELIVERY_ORDERS_PREVIEW} more
                  orders →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Tables and Sidebar Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {sections.map((section) => (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      selectedSection === section
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-white text-gray-700 border border-gray-200 hover:border-red-300"
                    }`}
                  >
                    {section}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-4 text-xs">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-white border-2 border-gray-300 rounded"></div>
                  <span className="text-gray-600">Available</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-red-100 border-2 border-red-400 rounded"></div>
                  <span className="text-gray-600">Occupied</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
                  <span className="text-gray-600">Reserved</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {filteredTables.map((table) => (
                <Link
                  key={table.id}
                  to={`/billing?table=${table.id}`}
                  className={`group relative ${getTableColor(
                    table.status,
                  )} border-2 rounded-2xl p-4 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    table.isMerged ? "ring-2 ring-blue-400" : ""
                  }`}
                >
                  {table.isMerged && (
                    <div className="absolute -top-2 -left-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500 text-white shadow-md">
                        <LinkIcon className="w-3 h-3 mr-1" />
                        Merged
                      </span>
                    </div>
                  )}
                  <div className="text-center">
                    <div
                      className={`w-14 h-14 mx-auto mb-2 rounded-xl flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110 ${getStatusBadge(
                        table.status,
                      )} text-white`}
                    >
                      <span className="text-base font-bold">{table.id}</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">
                      {table.name}
                    </p>

                    {getStatus(table.status) === "occupied" && (
                      <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                        <p className="text-xs font-bold text-red-600">
                          ₹{table.currentBill || 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          {table.orderTime}
                        </p>
                      </div>
                    )}

                    {getStatus(table.status) === "reserved" && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-yellow-700">
                          {table.customerName}
                        </p>
                        <p className="text-xs text-yellow-600">
                          {getTimeRemaining(table.reservedUntil)}
                        </p>
                      </div>
                    )}

                    {getStatus(table.status) === "available" && (
                      <p className="text-xs text-gray-400 mt-1">Empty</p>
                    )}
                  </div>

                  {getStatus(table.status) === "occupied" && (
                    <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          requestClearTable(table.id);
                        }}
                        disabled={clearingTable === table.id}
                        className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg shadow-md disabled:opacity-50"
                        title="Payment Done - Clear Table"
                      >
                        {clearingTable === table.id ? (
                          <RefreshCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle className="w-3 h-3" />
                        )}
                      </button>
                      <div className="p-1 bg-white rounded-lg shadow-md hover:bg-gray-50">
                        <Eye className="w-3 h-3 text-gray-600" />
                      </div>
                    </div>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-red-500" />
                Recent Orders
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentOrders.length > 0 ? (
                  recentOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 bg-gray-50 rounded-xl border border-gray-200 hover:shadow-md transition-all"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-gray-900">
                          {order.billNumber || order.id}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full font-medium text-white bg-green-500">
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {order.table
                          ? `Table ${order.table?.number || order.tableId}`
                          : order.orderType}{" "}
                        • {new Date(order.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-sm text-gray-500">
                    No recent orders
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Menu Items</span>
                  <span className="text-lg font-bold text-gray-900">
                    {menuItems.length}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Total Items Sold
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {stats.totalItemsSold || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Table Occupancy</span>
                  <span className="text-lg font-bold text-blue-600">
                    {occupancyPct}%
                  </span>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={() => setShowReservationForm(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Reservation</span>
                </button>
                <button
                  onClick={() => setShowMergeModal(true)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Merge/Split Tables</span>
                </button>
                <Link
                  to="/kitchen"
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-green-500 to-teal-600 text-white font-semibold"
                >
                  <ChefHat className="w-4 h-4" />
                  <span>Kitchen Display</span>
                </Link>
                <Link
                  to="/delivery"
                  className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold"
                >
                  <Truck className="w-4 h-4" />
                  <span>Delivery Orders</span>
                </Link>
                {isDevelopment && (
                  <div className="flex space-x-2 mt-3">
                    <button
                      onClick={() => simulateOnlineOrder("ZOMATO")}
                      className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Test Zomato
                    </button>
                    <button
                      onClick={() => simulateOnlineOrder("SWIGGY")}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-all"
                    >
                      Test Swiggy
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Reservation Modal */}
            {showReservationForm && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">
                      New Reservation
                    </h3>
                    <button
                      onClick={() => setShowReservationForm(false)}
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100"
                    >
                      <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <form onSubmit={createReservation}>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Table ID
                        </label>
                        <input
                          value={reservationData.tableId}
                          onChange={(e) =>
                            setReservationData({
                              ...reservationData,
                              tableId: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Name
                        </label>
                        <input
                          value={reservationData.customerName}
                          onChange={(e) =>
                            setReservationData({
                              ...reservationData,
                              customerName: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Customer Phone
                        </label>
                        <input
                          value={reservationData.customerPhone}
                          onChange={(e) =>
                            setReservationData({
                              ...reservationData,
                              customerPhone: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reserved From
                        </label>
                        <input
                          type="datetime-local"
                          value={reservationData.reservedFrom}
                          onChange={(e) =>
                            setReservationData({
                              ...reservationData,
                              reservedFrom: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl"
                          required
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reserved Until
                        </label>
                        <input
                          type="datetime-local"
                          value={reservationData.reservedUntil}
                          onChange={(e) =>
                            setReservationData({
                              ...reservationData,
                              reservedUntil: e.target.value,
                            })
                          }
                          className="w-full p-3 border border-gray-200 rounded-xl"
                          required
                        />
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <button
                          type="submit"
                          className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 px-4 rounded-xl font-semibold transition-all shadow-md"
                        >
                          Create Reservation
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReservationForm(false)}
                          className="px-6 py-3 text-gray-600 hover:text-gray-900 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Table Merge Modal */}
            <TableMergeModal
              isOpen={showMergeModal}
              onClose={() => setShowMergeModal(false)}
              tables={tables}
              onTablesUpdated={fetchDashboardData}
            />

            {/* Keyboard Shortcuts Help */}
            <KeyboardShortcutsHelp
              isOpen={showShortcutsHelp}
              onClose={() => setShowShortcutsHelp(false)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
