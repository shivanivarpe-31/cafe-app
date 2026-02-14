import axios from "axios";
import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import Navbar from "../components/navbar";
import { useSmartPolling } from "../hooks/useSmartPolling";
import {
  formatApiError,
  getUserFriendlyMessage,
  logError,
} from "../utils/errorHandler";
import ErrorDisplay from "../components/ErrorDisplay";
import { LoadingSection, SkeletonGrid, SkeletonCard, Spinner } from "../components/Loading";
import { EmptyCart, EmptySearchResults, EmptyTables, EmptyMenu } from "../components/EmptyState";
import { showSuccess, showError, showWarning } from "../utils/toast";

const BillingPage = () => {
  const { menuItems, loading: menuLoading } = useMenu();
  const [tables, setTables] = useState([]);
  const [cart, setCart] = useState([]);
  const [tableId, setTableId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

  // Wrap fetchTables in useCallback
  const fetchTables = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        axios.get("/api/orders/tables"),
        axios.get("/api/tables"),
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
    }
  }, []);

  // NEW: Fetch modifications
  const fetchModifications = useCallback(async () => {
    try {
      const res = await axios.get("/api/modifications");
      setModifications(res.data || { all: [], grouped: {} });
    } catch (err) {
      console.error("Failed to fetch modifications:", err);
    }
  }, []);

  // Fetch tables on mount and set up smart polling
  useEffect(() => {
    fetchModifications(); // Fetch once
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
    if (!tableId) {
      showWarning("Please select a table!");
      return;
    }
    const table = tables.find((t) => t.id === tableId);
    if (!table) {
      showError("Invalid table selected");
      return;
    }

    if (getStatus(table.status) === "reserved") {
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
    setError(null); // Clear previous errors
    try {
      // UPDATED: Include notes and modifications
      const orderItems = cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || null,
        modifications: item.modifications || [],
      }));

      const res = await axios.post("/api/orders", { tableId, orderItems });
      const createdOrder = res.data?.order || res.data;
      const billNumber = res.data?.billNumber ?? createdOrder?.billNumber;

      if (!createdOrder || !createdOrder.id) {
        throw new Error("Invalid order response");
      }

      // Order stays in PENDING status - kitchen can review and edit before preparing
      showSuccess(
        `Order ${billNumber} placed for Table ${getTableLabel(
          table,
        )} - Pending kitchen review`,
      );

      setCart([]);
      fetchTables();
    } catch (err) {
      logError('Place Order', err);
      const apiError = formatApiError(err, 'Failed to create order');
      const friendlyError = getUserFriendlyMessage(apiError.code, apiError.details);

      // Set structured error for display
      setError({
        ...friendlyError,
        message: apiError.message,
        code: apiError.code,
        details: apiError.details,
      });

      // Scroll to top to show error
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setLoading(false);
    }
  };

  // UPDATED: Use getItemTotal for calculations
  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const tax = subtotal * 0.05;
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
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">POS Billing</h1>
              <p className="text-sm text-gray-500 mt-1">
                Create and manage orders
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">
                  Table:
                </label>
                <select
                  value={tableId ?? ""}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTableId(Number.isFinite(val) ? val : null);
                  }}
                  className="px-4 py-2 border-2 border-gray-200 rounded-xl text-sm font-medium focus:border-red-300 focus:outline-none bg-white hover:border-gray-300 transition-colors"
                >
                  <option value="">Select Table</option>
                  {tables.length === 0 && (
                    <option disabled>— No tables available —</option>
                  )}
                  {tables.map((table) => (
                    <option key={table.id} value={table.id}>
                      Table {getTableLabel(table)} -{" "}
                      {String(table.status ?? "").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={fetchTables}
                className="px-3 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <ErrorDisplay
            error={error}
            onDismiss={() => setError(null)}
            className="animate-fadeIn"
          />
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2 space-y-6">
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
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none text-sm"
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
                  searchTerm={selectedCategory !== "All" ? selectedCategory : ""}
                  onClearSearch={() => setSelectedCategory("All")}
                />
              )
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className="bg-white rounded-2xl shadow-sm border-2 border-gray-200 p-4 hover:shadow-lg hover:border-red-300 transition-all cursor-pointer group"
                  >
                    <div className="aspect-square bg-gray-100 rounded-xl mb-3 flex items-center justify-center group-hover:bg-red-50 transition-colors">
                      <span className="text-4xl">🍽️</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">
                      {item.name}
                    </h3>
                    <p className="text-xs text-gray-500 mb-2">
                      {item.category?.name}
                    </p>
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-bold text-red-600">
                        ₹{item.price}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 sticky top-24">
              {/* Cart Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <ShoppingCart className="w-5 h-5 mr-2 text-red-500" />
                    Current Order
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center space-x-1"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Clear</span>
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-500">
                  {tableId
                    ? `Table ${getTableLabel(
                        tables.find((t) => t.id === tableId),
                      )}`
                    : "No table selected"}{" "}
                  • {cart.length} items
                </p>
              </div>

              {/* Cart Items */}
              <div className="p-6 max-h-96 overflow-y-auto">
                {cart.length === 0 ? (
                  <EmptyCart />
                ) : (
                  <div className="space-y-3">
                    {cart.map((item, index) => (
                      <div
                        key={index}
                        className="flex flex-col p-3 bg-gray-50 rounded-xl border border-gray-200"
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
                <div className="p-6 border-t border-gray-200 space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span className="font-medium">
                        ₹{subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>GST (5%)</span>
                      <span className="font-medium">₹{tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
                      <span>Total</span>
                      <span className="text-red-600">₹{total.toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={placeOrder}
                    disabled={!tableId || loading}
                    className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transition-all"
                  >
                    <ChefHat className="w-5 h-5" />
                    <span>
                      {loading ? "Sending to Kitchen..." : "Send to Kitchen"}
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
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                Customize: {cart[editingCartIndex]?.name}
              </h3>
              <button
                onClick={() => setShowModModal(false)}
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
