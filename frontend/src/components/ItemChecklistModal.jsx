import React, { useState, useMemo } from "react";
import { X, CheckCircle, AlertTriangle, ClipboardCheck } from "lucide-react";

/**
 * Zomato Missing Item Checklist Modal
 *
 * Shown when marking a Zomato order as ready, if order_tags contain
 * MANDATORY_ITEM_CHECKLIST or SKIPPABLE_ITEM_CHECKLIST.
 *
 * Props:
 *  - order: the order object (with items and deliveryInfo.orderTags)
 *  - onConfirm(itemCheckList: boolean): called when user confirms
 *  - onCancel(): close modal without action
 */
const ItemChecklistModal = ({ order, onConfirm, onCancel }) => {
  const items = order?.items || [];

  // Parse order tags from deliveryInfo
  const orderTags = useMemo(() => {
    try {
      const raw = order?.deliveryInfo?.orderTags;
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [order]);

  const checklistTag = useMemo(() => {
    return orderTags.find(
      (t) =>
        t.tag_type === "MANDATORY_ITEM_CHECKLIST" ||
        t.tag_type === "SKIPPABLE_ITEM_CHECKLIST",
    );
  }, [orderTags]);

  const isMandatory = checklistTag?.tag_type === "MANDATORY_ITEM_CHECKLIST";

  // Track checked state per item index
  const [checkedItems, setCheckedItems] = useState(() => new Set());
  const [submitting, setSubmitting] = useState(false);

  const toggleItem = (idx) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const allChecked = items.length > 0 && checkedItems.size === items.length;

  const handleConfirm = async (checked) => {
    setSubmitting(true);
    try {
      await onConfirm(checked);
    } finally {
      setSubmitting(false);
    }
  };

  // Check if any tags indicate pure veg
  const isPureVeg = orderTags.some((t) => t.tag_type === "PURE_VEG");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div
          className={`px-6 py-4 flex items-center justify-between ${
            isMandatory
              ? "bg-red-50 border-b-2 border-red-200"
              : "bg-yellow-50 border-b-2 border-yellow-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <ClipboardCheck
              className={`w-6 h-6 ${
                isMandatory ? "text-red-600" : "text-yellow-600"
              }`}
            />
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                Item Checklist
              </h3>
              <p className="text-xs text-gray-500">
                {isMandatory
                  ? "All items must be verified before marking ready"
                  : "Please verify items (can be skipped)"}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tags info */}
        <div className="px-6 pt-4 flex flex-wrap gap-2">
          {isMandatory ? (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
              <AlertTriangle className="w-3 h-3" /> Mandatory Checklist
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
              Skippable Checklist
            </span>
          )}
          {isPureVeg && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
              🥬 Pure Veg Order
            </span>
          )}
        </div>

        {/* Order info */}
        <div className="px-6 pt-3">
          <p className="text-sm text-gray-600">
            Order{" "}
            <span className="font-bold text-gray-900">{order?.billNumber}</span>
            {order?.deliveryInfo?.customerName && (
              <> &middot; {order.deliveryInfo.customerName}</>
            )}
          </p>
        </div>

        {/* Items checklist */}
        <div className="px-6 py-4 max-h-64 overflow-y-auto">
          {items.map((item, idx) => (
            <label
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors mb-2 ${
                checkedItems.has(idx)
                  ? "bg-green-50 border border-green-200"
                  : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              <input
                type="checkbox"
                checked={checkedItems.has(idx)}
                onChange={() => toggleItem(idx)}
                className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    checkedItems.has(idx) ? "text-green-800" : "text-gray-800"
                  }`}
                >
                  {item.quantity}x {item.menuItem?.name || item.name}
                </p>
                {item.notes && (
                  <p className="text-xs text-gray-500 truncate">{item.notes}</p>
                )}
              </div>
              {checkedItems.has(idx) && (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
            </label>
          ))}
        </div>

        {/* Progress */}
        <div className="px-6 pb-2">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>
              {checkedItems.size}/{items.length} items checked
            </span>
            {isMandatory && !allChecked && (
              <span className="text-red-500 font-medium">
                Check all to proceed
              </span>
            )}
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allChecked ? "bg-green-500" : "bg-yellow-400"
              }`}
              style={{
                width: `${
                  items.length > 0
                    ? (checkedItems.size / items.length) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
          <button
            onClick={onCancel}
            disabled={submitting}
            className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          {isMandatory ? (
            <button
              onClick={() => handleConfirm(true)}
              disabled={!allChecked || submitting}
              className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Marking Ready..." : "Confirm & Mark Ready"}
            </button>
          ) : (
            <>
              <button
                onClick={() => handleConfirm(false)}
                disabled={submitting}
                className="flex-1 py-2.5 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                {submitting ? "..." : "Skip & Mark Ready"}
              </button>
              <button
                onClick={() => handleConfirm(true)}
                disabled={!allChecked || submitting}
                className="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? "..." : "Confirm All"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemChecklistModal;
