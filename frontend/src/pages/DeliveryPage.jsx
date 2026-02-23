import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { useMenu } from "../context/MenuContext";
import config from "../config/businessConfig";
import {
  Truck,
  ShoppingBag,
  Phone,
  User,
  MapPin,
  Clock,
  Search,
  Plus,
  Minus,
  X,
  ChefHat,
  Package,
  RefreshCw,
  Filter,
  CheckCircle,
} from "lucide-react";
import Navbar from "../components/navbar";
import { showSuccess, showError, showWarning } from "../utils/toast";

const DeliveryPage = () => {
  const { menuItems } = useMenu();

  // Tab state
  const [activeTab, setActiveTab] = useState("new"); // new, orders
  const [orderType, setOrderType] = useState("TAKEAWAY"); // TAKEAWAY, DELIVERY

  // Order form state
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [estimatedTime, setEstimatedTime] = useState("");
  const [platform, setPlatform] = useState("DIRECT");
  const [platformOrderId, setPlatformOrderId] = useState("");

  // Fees
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [packagingFee, setPackagingFee] = useState(10);

  // Orders list
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");

  // Stats
  const [stats, setStats] = useState(null);

  const abortControllerRef = useRef(null);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "all") params.append("status", filterStatus);
      if (filterPlatform !== "all") params.append("platform", filterPlatform);

      const res = await axios.get(`/api/delivery?${params.toString()}`, {
        signal: abortControllerRef.current?.signal,
      });
      setOrders(res.data.data || res.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.error("Failed to fetch orders:", err);
    }
  }, [filterStatus, filterPlatform]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get("/api/delivery/stats", {
        signal: abortControllerRef.current?.signal,
      });
      setStats(res.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.error("Failed to fetch stats:", err);
    }
  }, []);

  useEffect(() => {
    abortControllerRef.current = new AbortController();
    if (activeTab === "orders") {
      fetchOrders();
      fetchStats();
    }
    return () => {
      abortControllerRef.current.abort();
    };
  }, [activeTab, fetchOrders, fetchStats]);

  // Cart functions
  const addToCart = (item) => {
    const existingIndex = cart.findIndex((c) => c.menuItemId === item.id);
    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          price: parseFloat(item.price),
          quantity: 1,
          notes: "",
          modifications: [],
        },
      ]);
    }
  };

  const updateQuantity = (index, qty) => {
    if (qty <= 0) {
      setCart(cart.filter((_, i) => i !== index));
    } else {
      const updated = [...cart];
      updated[index].quantity = qty;
      setCart(updated);
    }
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const tax = subtotal * config.tax.rate;
  const totalFees = parseFloat(deliveryFee) + parseFloat(packagingFee);
  const total = subtotal + tax + totalFees;

  // Place order
  const placeOrder = async () => {
    if (!customerName || !customerPhone) {
      showWarning("Customer name and phone are required");
      return;
    }
    if (orderType === "DELIVERY" && !deliveryAddress) {
      showWarning("Delivery address is required");
      return;
    }
    if (cart.length === 0) {
      showWarning("Cart is empty");
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        orderType === "TAKEAWAY"
          ? "/api/delivery/takeaway"
          : "/api/delivery/delivery";

      const payload = {
        customerName,
        customerPhone,
        customerEmail,
        orderItems: cart,
        specialInstructions,
        packagingFee,
        estimatedTime: estimatedTime || null,
      };

      if (orderType === "DELIVERY") {
        payload.deliveryAddress = deliveryAddress;
        payload.deliveryFee = deliveryFee;
        payload.platform = platform;
        if (platform !== "DIRECT") {
          payload.platformOrderId = platformOrderId;
        }
      }

      const res = await axios.post(endpoint, payload);

      showSuccess(
        `${
          orderType === "TAKEAWAY" ? "Takeaway" : "Delivery"
        } order created! Bill: ${res.data.billNumber}`,
      );

      // Reset form
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerEmail("");
      setDeliveryAddress("");
      setSpecialInstructions("");
      setEstimatedTime("");
      setPlatformOrderId("");
    } catch (err) {
      showError("Order failed: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  // Update delivery status
  const updateStatus = async (orderId, newStatus) => {
    try {
      await axios.put(`/api/delivery/${orderId}/status`, {
        deliveryStatus: newStatus,
      });
      fetchOrders();
      fetchStats();
    } catch (err) {
      showError("Failed to update status");
    }
  };

  // Filter menu items
  const categories = [
    "All",
    ...new Set(menuItems.map((i) => i.category?.name).filter(Boolean)),
  ];
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory && item.isActive !== false;
  });

  // Status colors
  const getStatusColor = (status) => {
    const colors = {
      PENDING: "bg-yellow-100 text-yellow-800",
      CONFIRMED: "bg-blue-100 text-blue-800",
      PREPARING: "bg-orange-100 text-orange-800",
      READY_FOR_PICKUP: "bg-green-100 text-green-800",
      OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
      DELIVERED: "bg-green-100 text-green-800",
      CANCELLED: "bg-red-100 text-red-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  // Platform colors
  const getPlatformColor = (platform) => {
    const colors = {
      DIRECT: "bg-gray-100 text-gray-800",
      ZOMATO: "bg-red-100 text-red-800",
      SWIGGY: "bg-orange-100 text-orange-800",
    };
    return colors[platform] || "bg-gray-100 text-gray-800";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <Truck className="w-7 h-7 mr-3 text-red-500" />
                Delivery & Takeaway
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage delivery, takeaway, Zomato & Swiggy orders
              </p>
            </div>

            {/* Tabs */}
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab("new")}
                className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
                  activeTab === "new"
                    ? "bg-red-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Plus className="w-4 h-4 inline mr-2" />
                New Order
              </button>
              <button
                onClick={() => setActiveTab("orders")}
                className={`px-6 py-2.5 rounded-xl font-semibold transition-all ${
                  activeTab === "orders"
                    ? "bg-red-500 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Package className="w-4 h-4 inline mr-2" />
                Orders
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* New Order Tab */}
        {activeTab === "new" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Menu Section */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Type Selection */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex space-x-4">
                  <button
                    onClick={() => setOrderType("TAKEAWAY")}
                    className={`flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
                      orderType === "TAKEAWAY"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Takeaway</span>
                  </button>
                  <button
                    onClick={() => setOrderType("DELIVERY")}
                    className={`flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center space-x-2 ${
                      orderType === "DELIVERY"
                        ? "bg-red-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    <Truck className="w-5 h-5" />
                    <span>Delivery</span>
                  </button>
                </div>

                {/* Platform selection for delivery */}
                {orderType === "DELIVERY" && (
                  <div className="mt-4 flex space-x-2">
                    {["DIRECT", "ZOMATO", "SWIGGY"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          platform === p
                            ? p === "ZOMATO"
                              ? "bg-red-500 text-white"
                              : p === "SWIGGY"
                              ? "bg-orange-500 text-white"
                              : "bg-gray-700 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Platform order ID */}
                {orderType === "DELIVERY" && platform !== "DIRECT" && (
                  <div className="mt-4">
                    <input
                      type="text"
                      placeholder={`${platform} Order ID`}
                      value={platformOrderId}
                      onChange={(e) => setPlatformOrderId(e.target.value)}
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    />
                  </div>
                )}
              </div>

              {/* Search & Filter */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search menu..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    />
                  </div>
                  <div className="flex space-x-2 overflow-x-auto">
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap ${
                          selectedCategory === cat
                            ? "bg-red-500 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Menu Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => addToCart(item)}
                    aria-label={`Add ${item.name} — ₹${item.price}`}
                    className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-4 hover:shadow-lg hover:border-red-300 transition-all cursor-pointer text-left"
                  >
                    <div className="aspect-square bg-gray-100 rounded-xl mb-3 flex items-center justify-center">
                      <span className="text-3xl">🍽️</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm truncate">
                      {item.name}
                    </h3>
                    <p className="text-lg font-bold text-red-600 mt-1">
                      ₹{item.price}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 sticky top-24">
                <div className="p-6 border-b border-gray-200">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    {orderType === "TAKEAWAY" ? (
                      <ShoppingBag className="w-5 h-5 mr-2 text-red-500" />
                    ) : (
                      <Truck className="w-5 h-5 mr-2 text-red-500" />
                    )}
                    {orderType === "TAKEAWAY" ? "Takeaway" : "Delivery"} Order
                  </h2>
                </div>

                {/* Customer Info */}
                <div className="p-6 border-b border-gray-200 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Customer Name *
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Customer name"
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Phone *
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Phone number"
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  {orderType === "DELIVERY" && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Delivery Address *
                      </label>
                      <div className="relative">
                        <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                        <textarea
                          value={deliveryAddress}
                          onChange={(e) => setDeliveryAddress(e.target.value)}
                          placeholder="Full delivery address"
                          rows="2"
                          className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Estimated Time
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="datetime-local"
                        value={estimatedTime}
                        onChange={(e) => setEstimatedTime(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                      Special Instructions
                    </label>
                    <textarea
                      value={specialInstructions}
                      onChange={(e) => setSpecialInstructions(e.target.value)}
                      placeholder="Any special instructions..."
                      rows="2"
                      className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Cart Items */}
                <div className="p-6 max-h-48 overflow-y-auto border-b border-gray-200">
                  {cart.length === 0 ? (
                    <p className="text-center text-gray-500 text-sm">
                      No items added
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {cart.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              ₹{item.price} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() =>
                                updateQuantity(index, item.quantity - 1)
                              }
                              className="p-1 bg-gray-100 rounded"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateQuantity(index, item.quantity + 1)
                              }
                              className="p-1 bg-gray-100 rounded"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => removeFromCart(index)}
                              className="p-1 text-red-500"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Fees */}
                <div className="p-6 border-b border-gray-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Packaging Fee</span>
                    <input
                      type="number"
                      value={packagingFee}
                      onChange={(e) => setPackagingFee(e.target.value)}
                      className="w-20 px-2 py-1 border rounded text-right text-sm"
                    />
                  </div>
                  {orderType === "DELIVERY" && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Delivery Fee
                      </span>
                      <input
                        type="number"
                        value={deliveryFee}
                        onChange={(e) => setDeliveryFee(e.target.value)}
                        className="w-20 px-2 py-1 border rounded text-right text-sm"
                      />
                    </div>
                  )}
                </div>

                {/* Totals */}
                <div className="p-6 space-y-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Subtotal</span>
                    <span>₹{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{config.tax.label}</span>
                    <span>
                      {config.currency.symbol}
                      {tax.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Fees</span>
                    <span>₹{totalFees.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span className="text-red-600">₹{total.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={loading || cart.length === 0}
                    className="w-full mt-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl flex items-center justify-center space-x-2"
                  >
                    <ChefHat className="w-5 h-5" />
                    <span>{loading ? "Creating..." : "Create Order"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-500">Total Orders</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.totalOrders}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-500">Takeaway</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.takeawayOrders}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-500">Delivery</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.deliveryOrders}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-500">Zomato</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.byPlatform?.zomato || 0}
                  </p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200">
                  <p className="text-sm text-gray-500">Swiggy</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.byPlatform?.swiggy || 0}
                  </p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Filters:
                  </span>
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="PREPARING">Preparing</option>
                  <option value="SERVED">Ready</option>
                  <option value="PAID">Completed</option>
                </select>
                <select
                  value={filterPlatform}
                  onChange={(e) => setFilterPlatform(e.target.value)}
                  className="px-3 py-2 border rounded-lg text-sm"
                >
                  <option value="all">All Platforms</option>
                  <option value="DIRECT">Direct</option>
                  <option value="ZOMATO">Zomato</option>
                  <option value="SWIGGY">Swiggy</option>
                </select>
                <button
                  onClick={() => {
                    fetchOrders();
                    fetchStats();
                  }}
                  className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Orders List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">
                        {order.billNumber}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getPlatformColor(
                          order.deliveryInfo?.deliveryPlatform,
                        )}`}
                      >
                        {order.deliveryInfo?.deliveryPlatform || "DIRECT"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.orderType === "TAKEAWAY"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {order.orderType}
                      </span>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          order.deliveryInfo?.deliveryStatus,
                        )}`}
                      >
                        {order.deliveryInfo?.deliveryStatus?.replace(
                          /_/g,
                          " ",
                        ) || order.status}
                      </span>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="p-4 border-b border-gray-200">
                    <p className="font-semibold text-gray-900">
                      {order.deliveryInfo?.customerName}
                    </p>
                    <p className="text-sm text-gray-500">
                      {order.deliveryInfo?.customerPhone}
                    </p>
                    {order.deliveryInfo?.deliveryAddress && (
                      <p className="text-sm text-gray-500 mt-1">
                        {order.deliveryInfo.deliveryAddress}
                      </p>
                    )}
                  </div>

                  {/* Items */}
                  <div className="p-4 border-b border-gray-200 max-h-32 overflow-y-auto">
                    {order.items?.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span>
                          {item.quantity}x {item.menuItem?.name}
                        </span>
                        <span className="text-gray-500">
                          ₹{parseFloat(item.price) * item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Total & Actions */}
                  <div className="p-4">
                    <div className="flex justify-between mb-3">
                      <span className="font-semibold">Total</span>
                      <span className="font-bold text-red-600">
                        ₹{parseFloat(order.total).toFixed(0)}
                      </span>
                    </div>

                    {/* Status Actions */}
                    {order.deliveryInfo?.deliveryStatus !== "DELIVERED" &&
                      order.deliveryInfo?.deliveryStatus !== "CANCELLED" && (
                        <div className="flex flex-wrap gap-2">
                          {order.deliveryInfo?.deliveryStatus === "PENDING" && (
                            <button
                              onClick={() =>
                                updateStatus(order.id, "PREPARING")
                              }
                              className="flex-1 py-2 bg-orange-500 text-white text-xs rounded-lg"
                            >
                              Start Preparing
                            </button>
                          )}
                          {order.deliveryInfo?.deliveryStatus ===
                            "PREPARING" && (
                            <button
                              onClick={() =>
                                updateStatus(order.id, "READY_FOR_PICKUP")
                              }
                              className="flex-1 py-2 bg-green-500 text-white text-xs rounded-lg"
                            >
                              Mark Ready
                            </button>
                          )}
                          {order.deliveryInfo?.deliveryStatus ===
                            "READY_FOR_PICKUP" &&
                            order.orderType === "DELIVERY" && (
                              <button
                                onClick={() =>
                                  updateStatus(order.id, "OUT_FOR_DELIVERY")
                                }
                                className="flex-1 py-2 bg-purple-500 text-white text-xs rounded-lg"
                              >
                                Out for Delivery
                              </button>
                            )}
                          {(order.deliveryInfo?.deliveryStatus ===
                            "READY_FOR_PICKUP" ||
                            order.deliveryInfo?.deliveryStatus ===
                              "OUT_FOR_DELIVERY") && (
                            <button
                              onClick={() =>
                                updateStatus(order.id, "DELIVERED")
                              }
                              className="flex-1 py-2 bg-green-600 text-white text-xs rounded-lg"
                            >
                              Complete
                            </button>
                          )}
                          <button
                            onClick={() => updateStatus(order.id, "CANCELLED")}
                            className="py-2 px-3 bg-red-100 text-red-600 text-xs rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                    {order.deliveryInfo?.deliveryStatus === "DELIVERED" && (
                      <div className="flex items-center justify-center text-green-600">
                        <CheckCircle className="w-4 h-4 mr-1" />
                        <span className="text-sm font-medium">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {orders.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No orders found</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryPage;
