import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Plus,
  Minus,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Package,
} from "lucide-react";
import { STOCK_ADJUSTMENTS } from "../../utils/menuConstants";
import { getStockColor } from "../../utils/menuHelpers";

/**
 * Stock Update Modal with improved UX
 * Features: animations, keyboard support, quick adjustments
 */
const StockUpdateModal = ({
  isOpen,
  onClose,
  item,
  onUpdate,
  isUpdating = false,
}) => {
  const [quantity, setQuantity] = useState(0);
  const inputRef = useRef(null);
  const modalRef = useRef(null);

  // Initialize quantity when item changes
  useEffect(() => {
    if (item) {
      setQuantity(item.inventory?.quantity || 0);
    }
  }, [item]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.select(), 100);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !isUpdating) {
        const qty = parseInt(quantity);
        if (!isNaN(qty) && qty >= 0) {
          onUpdate(qty);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setQuantity((prev) => Math.max(0, parseInt(prev || 0) + 1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setQuantity((prev) => Math.max(0, parseInt(prev || 0) - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isUpdating, quantity, onClose, onUpdate]);

  // Click outside to close
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  const adjustQuantity = useCallback((amount) => {
    setQuantity((prev) => Math.max(0, parseInt(prev || 0) + amount));
  }, []);

  const handleSubmit = () => {
    const qty = parseInt(quantity);
    if (!isNaN(qty) && qty >= 0) {
      onUpdate(qty);
    }
  };

  if (!isOpen || !item) return null;

  const currentStock = item.inventory?.quantity || 0;
  const stockDiff = parseInt(quantity || 0) - currentStock;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-labelledby="stock-modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3
                id="stock-modal-title"
                className="text-lg font-bold text-gray-900"
              >
                Update Stock
              </h3>
              <p className="text-sm text-gray-500 capitalize">
                {item.category?.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {/* Item name */}
          <div className="text-center mb-6">
            <h4 className="text-xl font-semibold text-gray-900">{item.name}</h4>
            <p className="text-sm text-gray-500 mt-1">
              Current stock:{" "}
              <span
                className={`font-semibold ${getStockColor(
                  currentStock,
                  item.inventory?.lowStock,
                )}`}
              >
                {currentStock} units
              </span>
            </p>
          </div>

          {/* Quantity input with controls */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700 text-center">
              New Quantity
            </label>

            {/* Quick adjustment buttons */}
            <div className="flex items-center justify-center gap-2">
              {/* Decrease buttons */}
              <button
                type="button"
                onClick={() => adjustQuantity(-STOCK_ADJUSTMENTS.LARGE)}
                className="flex flex-col items-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[44px]"
                title="Decrease by 10"
              >
                <ChevronDown className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">10</span>
              </button>
              <button
                type="button"
                onClick={() => adjustQuantity(-STOCK_ADJUSTMENTS.MEDIUM)}
                className="flex flex-col items-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[44px]"
                title="Decrease by 5"
              >
                <Minus className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">5</span>
              </button>
              <button
                type="button"
                onClick={() => adjustQuantity(-STOCK_ADJUSTMENTS.SMALL)}
                className="p-3 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl transition-colors"
                title="Decrease by 1"
              >
                <Minus className="w-5 h-5" />
              </button>

              {/* Input */}
              <input
                ref={inputRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-24 px-3 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-2xl font-bold text-center transition-all"
                min="0"
              />

              {/* Increase buttons */}
              <button
                type="button"
                onClick={() => adjustQuantity(STOCK_ADJUSTMENTS.SMALL)}
                className="p-3 bg-green-100 hover:bg-green-200 text-green-600 rounded-xl transition-colors"
                title="Increase by 1"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => adjustQuantity(STOCK_ADJUSTMENTS.MEDIUM)}
                className="flex flex-col items-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[44px]"
                title="Increase by 5"
              >
                <Plus className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">5</span>
              </button>
              <button
                type="button"
                onClick={() => adjustQuantity(STOCK_ADJUSTMENTS.LARGE)}
                className="flex flex-col items-center p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[44px]"
                title="Increase by 10"
              >
                <ChevronUp className="w-4 h-4 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">10</span>
              </button>
            </div>

            {/* Change indicator */}
            {stockDiff !== 0 && (
              <p
                className={`text-center text-sm font-medium ${
                  stockDiff > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {stockDiff > 0 ? "+" : ""}
                {stockDiff} from current
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="flex-1 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isUpdating || parseInt(quantity || 0) < 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Updating...</span>
              </>
            ) : (
              <span>Update Stock</span>
            )}
          </button>
        </div>

        {/* Keyboard hints */}
        <div className="px-5 pb-4 text-center">
          <p className="text-xs text-gray-400">
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">
              ↑
            </kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">
              ↓
            </kbd>{" "}
            to adjust •{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">
              Enter
            </kbd>{" "}
            to save •{" "}
            <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono">
              Esc
            </kbd>{" "}
            to cancel
          </p>
        </div>
      </div>
    </div>
  );
};

export default StockUpdateModal;
