import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Plus, Minus, Trash2, Search, ShoppingCart } from "lucide-react";
import { useMenu } from "../context/MenuContext";
import { showSuccess, showError } from "../utils/toast";
import config from "../config/businessConfig";
import ErrorDisplay from "./ErrorDisplay";
import { formatApiError, getUserFriendlyMessage } from "../utils/errorHandler";
import { useFocusTrap } from "../hooks/useFocusTrap";

const EditOrderModal = ({ isOpen, onClose, order, onOrderUpdated }) => {
  const { menuItems } = useMenu();
  const focusTrapRef = useFocusTrap(isOpen, onClose);
  const [cart, setCart] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Initialize cart with existing order items
  useEffect(() => {
    if (order && order.items) {
      const initialCart = order.items.map((item) => ({
        menuItemId: item.menuItem.id,
        name: item.menuItem.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || "",
        category: item.menuItem.category?.name || "",
      }));
      setCart(initialCart);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  // Filter menu items by search
  const filteredItems = menuItems.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Add item to cart
  const addToCart = (item) => {
    const existing = cart.find((c) => c.menuItemId === item.id);
    if (existing) {
      setCart(
        cart.map((c) =>
          c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          notes: "",
          category: item.category?.name || "",
        },
      ]);
    }
  };

  // Remove item from cart
  const removeFromCart = (menuItemId) => {
    setCart(cart.filter((item) => item.menuItemId !== menuItemId));
  };

  // Update quantity
  const updateQuantity = (menuItemId, delta) => {
    setCart(
      cart
        .map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  // Calculate totals
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const tax = subtotal * config.tax.rate;
  const total = subtotal + tax;

  // Update order
  const handleUpdateOrder = async () => {
    if (cart.length === 0) {
      showError("Cart cannot be empty");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const orderItems = cart.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: item.price,
        notes: item.notes || null,
        modifications: [],
      }));

      const response = await axios.put(`/api/orders/${order.id}`, {
        orderItems,
      });

      showSuccess("Order updated successfully!");
      onOrderUpdated(response.data.order);
      onClose();
    } catch (err) {
      console.error("Update order error:", err);
      const apiError = formatApiError(err, "Failed to update order");
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-order-title"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2
              id="edit-order-title"
              className="text-2xl font-bold text-gray-900"
            >
              Edit Order
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Order #{order.billNumber} - Table {order.table?.number}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="p-4 border-b border-gray-200">
            <ErrorDisplay error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Menu Items */}
          <div className="flex-1 p-6 overflow-y-auto border-r border-gray-200">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-red-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {filteredItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-white border-2 border-gray-200 rounded-xl p-4 hover:border-red-300 hover:shadow-md transition-all text-left"
                >
                  <div className="font-semibold text-gray-900 mb-1">
                    {item.name}
                  </div>
                  <div className="text-sm text-gray-500 mb-2">
                    {item.category?.name}
                  </div>
                  <div className="text-lg font-bold text-red-600">
                    ₹{item.price}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="w-96 flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2 text-red-500" />
                Order Items ({cart.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No items in order</p>
                  <p className="text-sm mt-2">Add items from the menu</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.menuItemId}
                    className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">
                          {item.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          ₹{item.price} each
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.menuItemId)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.menuItemId, -1)}
                          className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold w-8 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.menuItemId, 1)}
                          className="p-1 bg-white border border-gray-300 rounded hover:bg-gray-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="font-bold text-red-600">
                        ₹{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Totals and Actions */}
            <div className="border-t border-gray-200 p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">GST (5%)</span>
                  <span className="font-semibold">₹{tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span className="text-red-600">₹{total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 px-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateOrder}
                  disabled={loading || cart.length === 0}
                  className="flex-1 py-3 px-4 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Updating..." : "Update Order"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditOrderModal;
