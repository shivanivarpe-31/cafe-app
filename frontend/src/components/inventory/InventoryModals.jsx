import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Plus,
  Minus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Package,
  Trash2,
  ChefHat,
  History,
  AlertTriangle,
} from "lucide-react";
import { getUnitLabel } from "./IngredientComponents";
import { useFocusTrap } from "../../hooks/useFocusTrap";

/**
 * Stock Update Modal (Add Stock / Record Wastage)
 */
export const StockModal = ({
  isOpen,
  onClose,
  ingredient,
  type = "add", // 'add' or 'wastage'
  onSubmit,
  isSubmitting = false,
}) => {
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const inputRef = useRef(null);
  const modalRef = useRef(null);
  const focusTrapRef = useFocusTrap(isOpen, onClose);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuantity("");
      setNotes("");
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, ingredient]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter" && !isSubmitting && quantity) {
        handleSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, quantity, onClose]);

  const handleSubmit = () => {
    if (!quantity || parseFloat(quantity) <= 0) return;
    onSubmit({
      quantity: parseFloat(quantity),
      notes,
    });
  };

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  // Quick quantity buttons
  const quickAmounts = [10, 25, 50, 100];

  if (!isOpen || !ingredient) return null;

  const isAdd = type === "add";
  const projectedStock = isAdd
    ? ingredient.currentStock + (parseFloat(quantity) || 0)
    : ingredient.currentStock - (parseFloat(quantity) || 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={(el) => {
          modalRef.current = el;
          if (typeof focusTrapRef === "object") focusTrapRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-label={isAdd ? "Add stock" : "Record wastage"}
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md transform animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-5 border-b border-gray-100 rounded-t-2xl ${
            isAdd ? "bg-green-50" : "bg-orange-50"
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                isAdd ? "bg-green-100" : "bg-orange-100"
              }`}
            >
              {isAdd ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-orange-600" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {isAdd ? "Add Stock" : "Record Wastage"}
              </h3>
              <p className="text-sm text-gray-500">{ingredient.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5">
          {/* Current stock info */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-600">Current Stock</span>
            <span className="font-bold text-gray-900">
              {ingredient.currentStock.toLocaleString()}{" "}
              {getUnitLabel(ingredient.unit)}
            </span>
          </div>

          {/* Quantity input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantity ({getUnitLabel(ingredient.unit)})
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setQuantity((p) =>
                    Math.max(0, (parseFloat(p) || 0) - 1).toString(),
                  )
                }
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Minus className="w-5 h-5 text-gray-600" />
              </button>
              <input
                ref={inputRef}
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-xl font-bold text-center transition-all"
                min="0"
                step="0.01"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantity((p) => ((parseFloat(p) || 0) + 1).toString())
                }
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 mt-3">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setQuantity(amt.toString())}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  {isAdd ? "+" : "-"}
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Projected stock */}
          {quantity && parseFloat(quantity) > 0 && (
            <div
              className={`flex items-center justify-between p-3 rounded-xl ${
                projectedStock < ingredient.minStock
                  ? "bg-orange-50 border border-orange-200"
                  : "bg-green-50 border border-green-200"
              }`}
            >
              <span className="text-sm text-gray-600">
                {isAdd ? "After adding" : "After wastage"}
              </span>
              <span
                className={`font-bold ${
                  projectedStock < ingredient.minStock
                    ? "text-orange-600"
                    : "text-green-600"
                }`}
              >
                {projectedStock.toLocaleString()}{" "}
                {getUnitLabel(ingredient.unit)}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                isAdd
                  ? "e.g., Purchased from supplier"
                  : "e.g., Expired items, spillage"
              }
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:border-blue-400 focus:ring-2 focus:ring-blue-100 outline-none text-sm transition-all"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !quantity || parseFloat(quantity) <= 0}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isAdd
                ? "bg-green-500 hover:bg-green-600 text-white"
                : "bg-orange-500 hover:bg-orange-600 text-white"
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>{isAdd ? "Add Stock" : "Record Wastage"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Recipe Editor Modal
 */
export const RecipeModal = ({
  isOpen,
  onClose,
  menuItem,
  recipe,
  ingredients,
  onAddIngredient,
  onUpdateIngredient,
  onRemoveIngredient,
  onSave,
  isSaving = false,
}) => {
  const modalRef = useRef(null);
  const focusTrapRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen || !menuItem) return null;

  // Calculate total cost
  const totalCost = recipe.reduce((sum, item) => {
    const ing = ingredients.find((i) => i.id === parseInt(item.ingredientId));
    if (ing && item.quantity) {
      return sum + ing.costPerUnit * parseFloat(item.quantity);
    }
    return sum;
  }, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={(el) => {
          modalRef.current = el;
          if (typeof focusTrapRef === "object") focusTrapRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-modal-title"
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h3
                id="recipe-modal-title"
                className="text-lg font-bold text-gray-900"
              >
                Edit Recipe
              </h3>
              <p className="text-sm text-gray-500">{menuItem.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-3">
            {recipe.map((item, index) => {
              const selectedIng = ingredients.find(
                (i) => i.id === parseInt(item.ingredientId),
              );
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                >
                  <select
                    value={item.ingredientId}
                    onChange={(e) =>
                      onUpdateIngredient(index, "ingredientId", e.target.value)
                    }
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none bg-white text-sm transition-all min-w-0"
                  >
                    <option value="">Select ingredient</option>
                    {ingredients.map((ing) => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({getUnitLabel(ing.unit)})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateIngredient(index, "quantity", e.target.value)
                      }
                      className="w-20 px-3 py-2.5 border border-gray-200 rounded-lg focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none text-sm text-center transition-all"
                      min="0"
                      step="0.01"
                    />
                    <span className="text-sm text-gray-500 w-12">
                      {selectedIng ? getUnitLabel(selectedIng.unit) : ""}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveIngredient(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            <button
              onClick={onAddIngredient}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Ingredient</span>
            </button>
          </div>

          {/* Cost summary */}
          {recipe.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  Estimated ingredient cost
                </span>
                <span className="font-bold text-blue-900">
                  ₹{totalCost.toFixed(2)}
                </span>
              </div>
              {menuItem.price && (
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-blue-200">
                  <span className="text-sm text-blue-700">Profit margin</span>
                  <span className="font-bold text-green-600">
                    ₹{(parseFloat(menuItem.price) - totalCost).toFixed(2)} (
                    {(
                      ((parseFloat(menuItem.price) - totalCost) /
                        parseFloat(menuItem.price)) *
                      100
                    ).toFixed(0)}
                    %)
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white rounded-xl font-semibold shadow-sm hover:shadow transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Recipe</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Stock Logs Modal
 */
export const LogsModal = ({ isOpen, onClose, ingredient, logs }) => {
  const modalRef = useRef(null);
  const focusTrapRef = useFocusTrap(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!isOpen || !ingredient) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div
        ref={(el) => {
          modalRef.current = el;
          if (typeof focusTrapRef === "object") focusTrapRef.current = el;
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logs-modal-title"
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden transform animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3
                id="logs-modal-title"
                className="text-lg font-bold text-gray-900"
              >
                Stock History
              </h3>
              <p className="text-sm text-gray-500">{ingredient.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto max-h-[calc(90vh-150px)]">
          {logs && logs.length > 0 ? (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-4 rounded-xl border ${
                    log.quantity > 0
                      ? "bg-green-50 border-green-200"
                      : "bg-red-50 border-red-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {log.quantity > 0 ? (
                        <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">
                          {log.changeType.replace("_", " ")}
                        </p>
                        {log.notes && (
                          <p className="text-sm text-gray-500">{log.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`font-bold ${
                          log.quantity > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {log.quantity > 0 ? "+" : ""}
                        {log.quantity} {getUnitLabel(ingredient.unit)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No history available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default StockModal;
