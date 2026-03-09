import axios from "axios";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useMenu } from "../context/MenuContext";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Search,
  X,
  ChefHat,
  Edit3,
  MessageSquare,
  UtensilsCrossed,
  Package,
  Truck,
  RefreshCw,
  MapPin,
} from "lucide-react";
import Navbar from "../components/navbar";
import { useSearchParams } from "react-router-dom";
import { useSmartPolling } from "../hooks/useSmartPolling";
import {
  formatApiError,
  getUserFriendlyMessage,
  logError,
} from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";
import { SkeletonGrid } from "../components/Loading";
import {
  EmptyCart,
  EmptySearchResults,
  EmptyMenu,
} from "../components/EmptyState";
import { showSuccess, showError, showWarning } from "../utils/toast";
import config from "../config/businessConfig";

const BillingPage = () => {
  const { menuItems, loading: menuLoading } = useMenu();
  const [searchParams] = useSearchParams();
  const tableParam = searchParams.get("table");
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tablesLoading, setTablesLoading] = useState(true);

  // Order type: DINE_IN, TAKEAWAY, DELIVERY
  const [orderType, setOrderType] = useState("DINE_IN");

  // NEW: Modifications state
  const [modifications, setModifications] = useState({ all: [], grouped: {} });
  const [showModModal, setShowModModal] = useState(false);
  const [editingCartIndex, setEditingCartIndex] = useState(null);
  const [selectedMods, setSelectedMods] = useState([]);
  const [itemNotes, setItemNotes] = useState("");

  // normalize status for comparisons
  const getStatus = (s) => String(s || "").toLowerCase();

  // Safe label for a table
  const getTableLabel = (t) => {
    if (!t) return "";
    if (typeof t.number !== "undefined" && t.number !== null) return t.number;
    if (typeof t.name === "string" && t.name.trim() !== "") return t.name;
    if (typeof t.tableNumber !== "undefined" && t.tableNumber !== null)
      return t.tableNumber;
    if (typeof t.label === "string" && t.label.trim() !== "") return t.label;
    return `#${t.id}`;
  };

  const abortControllerRef = useRef(null);

  // Wrap fetchTables in useCallback
  const fetchTables = useCallback(async () => {
    setTablesLoading(true);
    try {
      const results = await Promise.allSettled([
        axios.get("/api/orders/tables", {
          signal: abortControllerRef.current?.signal,
        }),
        axios.get("/api/tables", {
          signal: abortControllerRef.current?.signal,
        }),
      ]);
      let chosen = null;
      for (const r of results) {
        if (r.status === "fulfilled" && Array.isArray(r.value.data)) {
          chosen = r.value.data;
          break;
        }
      }
      const raw =
        chosen ||
        results.find((r) => r.status === "fulfilled")?.value?.data ||
        [];
      const normalized = (Array.isArray(raw) ? raw : []).map((t) => ({
        ...t,
        id: typeof t.id === "number" ? t.id : parseInt(t.id, 10),
        status: t.status ?? t.Status ?? t.STATUS ?? "",
      }));
      setTables(normalized);
      const firstAvailable = normalized.find(
        (t) => getStatus(t.status) === "available",
      );
      setTableId(firstAvailable ? Number(firstAvailable.id) : null);
    } catch (err) {
      console.error("Failed to fetch tables:", err);
      setTables([]);
      setTableId(null);
    } finally {
      setTablesLoading(false);
    }
  }, []);

  // NEW: Fetch modifications
  const fetchModifications = useCallback(async () => {
    try {
      const res = await axios.get("/api/modifications", {
        signal: abortControllerRef.current?.signal,
      });
      setModifications(res.data || { all: [], grouped: {} });
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      console.error("Failed to fetch modifications:", err);
    }
  }, []);

  // Fetch tables on mount and set up smart polling
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    fetchModifications(); // Fetch once
    return () => {
      abortControllerRef.current.abort();
    };
  }, [fetchModifications]);

  // Smart polling for tables (only when page is visible and user is active)
  useSmartPolling(
    fetchTables,
    30000, // Poll every 30 seconds when user is active
    120000, // Poll every 2 minutes when user is inactive
    300000, // Consider user inactive after 5 minutes of no activity
  );

  // Listen for order updates from other components
  useEffect(() => {
    const handleOrderUpdated = () => {
      fetchTables();
    };
    window.addEventListener("order-updated", handleOrderUpdated);

    return () => {
      window.removeEventListener("order-updated", handleOrderUpdated);
    };
  }, [fetchTables]);

  // Pre-select table from URL param (?table=<id>) when navigating from Dashboard
  useEffect(() => {
    if (!tableParam || !tables.length) return;
    const targetId = Number(tableParam);
    if (!targetId) return;
    const target = tables.find((t) => t.id === targetId);
    if (target) {
      setTableId(targetId);
      setOrderType("DINE_IN");
    }
  }, [tables, tableParam]);

  const addToCart = (item) => {
    const menuItemId = item.id;

    // Check for existing item without modifications
    const existingIndex = cart.findIndex(
      (c) =>
        c.menuItemId === menuItemId &&
        !c.notes &&
        (!c.modifications || c.modifications.length === 0),
    );

    if (existingIndex >= 0) {
      // Increment quantity for existing item
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      // Add new item to cart
      setCart([
        ...cart,
        {
          menuItemId: menuItemId,
          id: menuItemId,
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
      return;
    }
    const updated = [...cart];
    updated[index].quantity = qty;
    setCart(updated);
  };

  const removeFromCart = (index) => setCart(cart.filter((_, i) => i !== index));

  const clearCart = () => {
    if (window.confirm("Clear entire cart?")) setCart([]);
  };

  // NEW: Open modification modal
  const openModModal = (index) => {
    const item = cart[index];
    setEditingCartIndex(index);
    setSelectedMods(item.modifications || []);
    setItemNotes(item.notes || "");
    setShowModModal(true);
  };

  // NEW: Toggle modification
  const toggleMod = (mod) => {
    const existingIndex = selectedMods.findIndex((m) => m.id === mod.id);
    if (existingIndex >= 0) {
      setSelectedMods(selectedMods.filter((m) => m.id !== mod.id));
    } else {
      setSelectedMods([...selectedMods, { ...mod, quantity: 1 }]);
    }
  };

  // NEW: Update mod quantity
  const updateModQuantity = (modId, delta) => {
    setSelectedMods(
      selectedMods.map((m) => {
        if (m.id === modId) {
          const newQty = Math.max(1, (m.quantity || 1) + delta);
          return { ...m, quantity: newQty };
        }
        return m;
      }),
    );
  };

  // NEW: Save modifications
  const saveModifications = () => {
    const updated = [...cart];
    updated[editingCartIndex] = {
      ...updated[editingCartIndex],
      modifications: selectedMods,
      notes: itemNotes,
    };
    setCart(updated);
    setShowModModal(false);
    setEditingCartIndex(null);
    setSelectedMods([]);
    setItemNotes("");
  };

  // NEW: Calculate item total (with modifications)
  const getItemTotal = (item) => {
    let total = item.price * item.quantity;
    if (item.modifications) {
      for (const mod of item.modifications) {
        total +=
          parseFloat(mod.price || 0) * (mod.quantity || 1) * item.quantity;
      }
    }
    return total;
  };

  const placeOrder = async () => {
    if (cart.length === 0) {
      showWarning("Cart is empty!");
      return;
    }
    if (orderType === "DINE_IN" && !tableId) {
      showWarning("Please select a table for dine-in orders!");
      return;
    }
    const table =
      orderType === "DINE_IN" ? tables.find((t) => t.id === tableId) : null;
    if (orderType === "DINE_IN" && !table) {
      showError("Invalid table selected");
      return;
    }
    if (table && getStatus(table.status) === "reserved") {
      const from = table.reservedFrom ? new Date(table.reservedFrom) : null;
      const to = table.reservedUntil ? new Date(table.reservedUntil) : null;
      const now = new Date();
      if (from && to) {
        if (now < from || now > to) {
          showWarning(
            `Table ${getTableLabel(
              table,
            )} is reserved from ${from.toLocaleString()} to ${to.toLocaleString()}. Orders can be placed only during the reserved window.`,
          );
          return;
        }
      } else {
        showWarning(
          `Table ${getTableLabel(
            table,
          )} is reserved. You can only place orders during the reservation window.`,
        );
        return;
      }
    }

    setLoading(true);
    setError(null);
    try {
      const orderItems = cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || null,
        modifications: item.modifications || [],
      }));
      const orderPayload = { orderItems, orderType };
      if (orderType === "DINE_IN" && tableId) orderPayload.tableId = tableId;

      const res = await axios.post("/api/orders", orderPayload);
      const createdOrder = res.data?.order || res.data;
      const billNumber = res.data?.billNumber ?? createdOrder?.billNumber;
      if (!createdOrder || !createdOrder.id)
        throw new Error("Invalid order response");

      const orderTypeLabel =
        orderType === "DINE_IN"
          ? `Table ${getTableLabel(table)}`
          : orderType === "TAKEAWAY"
          ? "Takeaway"
          : "Delivery";
      showSuccess(
        `Order ${billNumber} placed for ${orderTypeLabel} - Pending kitchen review`,
      );
      setCart([]);
      if (orderType === "DINE_IN") fetchTables();
    } catch (err) {
      logError("Place Order", err);
      const apiError = formatApiError(err, "Failed to create order");
      const friendlyError = getUserFriendlyMessage(
        apiError.code,
        apiError.details,
      );
      setError({
        ...friendlyError,
        message: apiError.message,
        code: apiError.code,
        details: apiError.details,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Use getItemTotal for calculations
  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const tax = subtotal * config.tax.rate;
  const total = subtotal + tax;

  const categories = [
    "All",
    ...new Set(menuItems.map((item) => item.category?.name).filter(Boolean)),
  ];
  const filteredItems = menuItems.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category?.name === selectedCategory;
    const isActive = item.isActive !== false;
    return matchesSearch && matchesCategory && isActive;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Billing Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                <ShoppingCart className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">New Order</h1>
                <p className="text-sm text-gray-500">
                  Create orders for dine-in, takeaway, or delivery
                </p>
              </div>
            </div>
            <button
              onClick={fetchTables}
              disabled={tablesLoading}
              className="flex items-center space-x-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
              title="Refresh tables"
            >
              <RefreshCw
                className={`w-4 h-4 ${tablesLoading ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>

          {/* Order Type Selector */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <button
              onClick={() => {
                setOrderType("DINE_IN");
                setTableId(
                  tables.find((t) => getStatus(t.status) === "available")?.id ||
                    null,
                );
              }}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${
                orderType === "DINE_IN"
                  ? "border-red-500 bg-red-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  orderType === "DINE_IN"
                    ? "bg-red-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <UtensilsCrossed className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p
                  className={`font-semibold ${
                    orderType === "DINE_IN" ? "text-red-700" : "text-gray-900"
                  }`}
                >
                  Dine In
                </p>
                <p className="text-xs text-gray-500">Eat at restaurant</p>
              </div>
            </button>
            <button
              onClick={() => {
                setOrderType("TAKEAWAY");
                setTableId(null);
              }}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${
                orderType === "TAKEAWAY"
                  ? "border-orange-500 bg-orange-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  orderType === "TAKEAWAY"
                    ? "bg-orange-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <Package className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p
                  className={`font-semibold ${
                    orderType === "TAKEAWAY"
                      ? "text-orange-700"
                      : "text-gray-900"
                  }`}
                >
                  Takeaway
                </p>
                <p className="text-xs text-gray-500">Pack to go</p>
              </div>
            </button>
            <button
              onClick={() => {
                setOrderType("DELIVERY");
                setTableId(null);
              }}
              className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-center space-x-3 ${
                orderType === "DELIVERY"
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  orderType === "DELIVERY"
                    ? "bg-blue-500 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                <Truck className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p
                  className={`font-semibold ${
                    orderType === "DELIVERY" ? "text-blue-700" : "text-gray-900"
                  }`}
                >
                  Delivery
                </p>
                <p className="text-xs text-gray-500">Deliver to address</p>
              </div>
            </button>
          </div>

          {/* Table Selector - Only for Dine In */}
          {orderType === "DINE_IN" && (
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center">
                  <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                  Select Table
                </h3>
                <div className="flex items-center space-x-3 text-xs">
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-1"></span>
                    Available
                  </span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-red-500 mr-1"></span>
                    Occupied
                  </span>
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></span>
                    Reserved
                  </span>
                </div>
              </div>
              {tablesLoading ? (
                <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-gray-200 rounded-xl animate-pulse"
                    ></div>
                  ))}
                </div>
              ) : tables.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  No tables available
                </p>
              ) : (
                <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {tables.map((table) => {
                    const status = getStatus(table.status);
                    const isSelected = tableId === table.id;
                    const isOccupied = status === "occupied";
                    const isReserved = status === "reserved";

                    return (
                      <button
                        key={table.id}
                        onClick={() => setTableId(table.id)}
                        disabled={isOccupied}
                        className={`relative h-14 rounded-xl font-semibold text-sm transition-all flex flex-col items-center justify-center ${
                          isSelected
                            ? "bg-red-500 text-white shadow-lg ring-2 ring-red-300 ring-offset-2"
                            : isOccupied
                            ? "bg-red-100 text-red-400 cursor-not-allowed opacity-60"
                            : isReserved
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                        }`}
                      >
                        <span className="text-xs opacity-70">Table</span>
                        <span className="font-bold">
                          {getTableLabel(table)}
                        </span>
                        {isOccupied && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-2">
          <ErrorDisplay
            error={error}
            onDismiss={() => setError(null)}
            className="animate-fadeIn"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Menu Section */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Filter */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm transition-colors"
                  />
                </div>
                <div className="flex items-center space-x-2 overflow-x-auto">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                        selectedCategory === cat
                          ? "bg-red-500 text-white shadow-md"
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
            {menuLoading ? (
              <SkeletonGrid items={8} columns={4} />
            ) : filteredItems.length === 0 ? (
              searchTerm ? (
                <EmptySearchResults
                  searchTerm={searchTerm}
                  onClearSearch={() => setSearchTerm("")}
                />
              ) : menuItems.length === 0 ? (
                <EmptyMenu />
              ) : (
                <EmptySearchResults
                  searchTerm={
                    selectedCategory !== "All" ? selectedCategory : ""
                  }
                  onClearSearch={() => setSelectedCategory("All")}
                />
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredItems.map((item) => {
                  const cartItem = cart.find((c) => c.menuItemId === item.id);
                  const quantityInCart = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={item.id}
                      className={`bg-white rounded-2xl shadow-sm border-2 p-3 hover:shadow-lg transition-all cursor-pointer group relative overflow-hidden ${
                        quantityInCart > 0
                          ? "border-red-400 ring-2 ring-red-100"
                          : "border-gray-200 hover:border-red-300"
                      }`}
                    >
                      {/* Quantity badge */}
                      {quantityInCart > 0 && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center z-10 shadow-md">
                          {quantityInCart}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => addToCart(item)}
                        className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-50 rounded-xl mb-2 flex items-center justify-center group-hover:from-red-50 group-hover:to-orange-50 transition-colors relative"
                        aria-label={`Add ${item.name} to cart`}
                      >
                        <span className="text-3xl group-hover:scale-110 transition-transform">
                          🍽️
                        </span>
                      </button>

                      <h3
                        className="font-semibold text-gray-900 text-sm mb-0.5 truncate"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                      <p className="text-xs text-gray-400 mb-2 truncate">
                        {item.category?.name}
                      </p>

                      <div className="flex items-center justify-between">
                        <p className="text-base font-bold text-red-600">
                          ₹{item.price}
                        </p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(item);
                          }}
                          className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center justify-center transition-colors shadow-sm"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 sticky top-24">
              {/* Cart Header */}
              <div className="p-5 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <ShoppingCart className="w-5 h-5 mr-2 text-red-500" />
                    Current Order
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-sm text-red-500 hover:text-red-600 font-medium flex items-center space-x-1 hover:bg-red-50 px-2 py-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>

                {/* Order Info */}
                <div className="flex items-center space-x-2">
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      orderType === "DINE_IN"
                        ? "bg-red-100 text-red-700"
                        : orderType === "TAKEAWAY"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {orderType === "DINE_IN" && (
                      <UtensilsCrossed className="w-3 h-3 mr-1" />
                    )}
                    {orderType === "TAKEAWAY" && (
                      <Package className="w-3 h-3 mr-1" />
                    )}
                    {orderType === "DELIVERY" && (
                      <Truck className="w-3 h-3 mr-1" />
                    )}
                    {orderType === "DINE_IN"
                      ? "Dine In"
                      : orderType === "TAKEAWAY"
                      ? "Takeaway"
                      : "Delivery"}
                  </span>
                  {orderType === "DINE_IN" && tableId && (
                    <span className="text-sm text-gray-600 font-medium">
                      Table{" "}
                      {getTableLabel(tables.find((t) => t.id === tableId))}
                    </span>
                  )}
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500">
                    {cart.length} items
                  </span>
                </div>
              </div>

              {/* Cart Items */}
              <div className="p-4 max-h-80 overflow-y-auto">
                {cart.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <div className="space-y-2">
                    {cart.map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              ₹{item.price} × {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center space-x-3 ml-3">
                            <div className="flex items-center space-x-2 bg-white rounded-lg border border-gray-200">
                              <button
                                onClick={() =>
                                  updateQuantity(index, item.quantity - 1)
                                }
                                className="p-1.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-l-lg transition-colors"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <span className="w-8 text-center text-sm font-semibold">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateQuantity(index, item.quantity + 1)
                                }
                                className="p-1.5 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-r-lg transition-colors"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                            <p className="font-bold text-gray-900 w-16 text-right">
                              ₹{getItemTotal(item).toFixed(0)}
                            </p>
                            {/* NEW: Edit button for modifications */}
                            <button
                              onClick={() => openModModal(index)}
                              className="p-1.5 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Add notes/modifications"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeFromCart(index)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* NEW: Show modifications and notes */}
                        {((item.modifications &&
                          item.modifications.length > 0) ||
                          item.notes) && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {item.modifications &&
                              item.modifications.length > 0 && (
                                <div className="space-y-0.5">
                                  {item.modifications.map((mod, idx) => (
                                    <p
                                      key={idx}
                                      className="text-xs text-blue-600"
                                    >
                                      + {mod.name}{" "}
                                      {mod.quantity > 1
                                        ? `x${mod.quantity}`
                                        : ""}
                                      {parseFloat(mod.price) > 0 &&
                                        ` (+₹${
                                          parseFloat(mod.price) *
                                          (mod.quantity || 1)
                                        })`}
                                      {parseFloat(mod.price) < 0 &&
                                        ` (₹${
                                          parseFloat(mod.price) *
                                          (mod.quantity || 1)
                                        })`}
                                    </p>
                                  ))}
                                </div>
                              )}
                            {item.notes && (
                              <p className="text-xs text-orange-600 mt-1 flex items-center">
                                <MessageSquare className="w-3 h-3 mr-1" />
                                {item.notes}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="p-5 border-t border-gray-200 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-medium">
                        ₹{subtotal.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{config.tax.label}</span>
                      <span className="font-medium">
                        {config.currency.symbol}
                        {tax.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
                      <span>Total</span>
                      <span className="text-red-600">₹{total.toFixed(0)}</span>
                    </div>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={(orderType === "DINE_IN" && !tableId) || loading}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all text-white ${
                      orderType === "DINE_IN"
                        ? "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500"
                        : orderType === "TAKEAWAY"
                        ? "bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500"
                        : "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500"
                    }`}
                  >
                    <ChefHat className="w-5 h-5" />
                    <span>
                      {loading
                        ? "Sending..."
                        : orderType === "DINE_IN"
                        ? "Send to Kitchen"
                        : orderType === "TAKEAWAY"
                        ? "Create Takeaway Order"
                        : "Create Delivery Order"}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Modification Modal */}
      {showModModal && editingCartIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mod-modal-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                id="mod-modal-title"
                className="text-xl font-bold text-gray-900"
              >
                Customize: {cart[editingCartIndex]?.name}
              </h3>
              <button
                onClick={() => setShowModModal(false)}
                aria-label="Close modal"
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Special Instructions
              </label>
              <textarea
                value={itemNotes}
                onChange={(e) => setItemNotes(e.target.value)}
                placeholder="e.g., Less sugar, well done, no ice..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                rows="2"
              />
            </div>

            {/* Modifications by category */}
            {Object.entries(modifications.grouped || {}).map(
              ([category, mods]) => (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-bold text-gray-700 uppercase mb-3">
                    {category}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {mods.map((mod) => {
                      const isSelected = selectedMods.some(
                        (m) => m.id === mod.id,
                      );
                      const selectedMod = selectedMods.find(
                        (m) => m.id === mod.id,
                      );

                      return (
                        <div
                          key={mod.id}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            isSelected
                              ? "border-red-500 bg-red-50"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                          onClick={() => toggleMod(mod)}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 text-sm">
                              {mod.name}
                            </span>
                            {parseFloat(mod.price) !== 0 && (
                              <span
                                className={`text-xs font-semibold ${
                                  parseFloat(mod.price) > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {parseFloat(mod.price) > 0 ? "+" : ""}₹
                                {parseFloat(mod.price)}
                              </span>
                            )}
                          </div>

                          {/* Quantity selector for selected paid mods */}
                          {isSelected && parseFloat(mod.price) > 0 && (
                            <div className="flex items-center justify-center mt-2 space-x-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateModQuantity(mod.id, -1);
                                }}
                                className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="text-sm font-semibold w-6 text-center">
                                {selectedMod?.quantity || 1}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateModQuantity(mod.id, 1);
                                }}
                                className="p-1 bg-gray-200 hover:bg-gray-300 rounded"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ),
            )}

            {/* No modifications message */}
            {Object.keys(modifications.grouped || {}).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No modifications available</p>
                <p className="text-xs mt-1">
                  You can still add special instructions above
                </p>
              </div>
            )}

            {/* Summary */}
            {selectedMods.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 mb-4">
                <p className="text-sm font-semibold text-gray-700 mb-2">
                  Selected:
                </p>
                <div className="space-y-1">
                  {selectedMods.map((mod) => (
                    <div key={mod.id} className="flex justify-between text-sm">
                      <span>
                        {mod.name} {mod.quantity > 1 ? `x${mod.quantity}` : ""}
                      </span>
                      <span
                        className={
                          parseFloat(mod.price) >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {parseFloat(mod.price) !== 0 && (
                          <>
                            ₹
                            {(
                              parseFloat(mod.price) * (mod.quantity || 1)
                            ).toFixed(0)}
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={saveModifications}
                className="flex-1 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl"
              >
                Save Changes
              </button>
              <button
                onClick={() => setShowModModal(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillingPage;
