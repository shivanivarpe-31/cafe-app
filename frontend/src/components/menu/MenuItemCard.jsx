import React, { memo } from "react";
import {
  Edit,
  Trash2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Package,
  PackagePlus,
} from "lucide-react";
import {
  getStockColor,
  formatPrice,
  hasLowStock,
} from "../../utils/menuHelpers";

/**
 * Menu Item Card for Grid View
 * Memoized for performance optimization
 */
export const MenuItemCard = memo(
  ({
    item,
    onEdit,
    onDelete,
    onToggleActive,
    onUpdateStock,
    isDeleting,
    isToggling,
  }) => {
    const stockQty = item.inventory?.quantity ?? 0;
    const isActive = item.isActive !== false;
    const showLowStock = hasLowStock(item);

    return (
      <div
        className={`group bg-white rounded-2xl border border-gray-200 overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-gray-300 ${
          !isActive ? "opacity-60 bg-gray-50/50" : ""
        }`}
      >
        {/* Card Header with Status */}
        <div className="relative p-5 pb-3">
          {/* Status Badge */}
          <div className="absolute top-3 right-3 flex items-center gap-2">
            {showLowStock && (
              <span className="flex items-center gap-1 px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded-full">
                <AlertCircle className="w-3 h-3" />
                Low Stock
              </span>
            )}
            {!isActive && (
              <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                Inactive
              </span>
            )}
          </div>

          {/* Item Info */}
          <div className="pr-20">
            <h3 className="font-semibold text-gray-900 text-lg leading-tight mb-1 line-clamp-1">
              {item.name}
            </h3>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
              {item.category?.name}
            </span>
          </div>

          {item.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2 min-h-[2.5rem]">
              {item.description}
            </p>
          )}
        </div>

        {/* Price & Stock Section */}
        <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <span className="text-2xl font-bold text-red-600">
              {formatPrice(item.price)}
            </span>
            <button
              onClick={() => onUpdateStock(item)}
              className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              title="Update stock"
            >
              <span
                className={`font-semibold text-sm ${getStockColor(
                  stockQty,
                  item.inventory?.lowStock,
                )}`}
              >
                {stockQty} units
              </span>
              <PackagePlus className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleActive(item)}
              disabled={isToggling}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium text-sm transition-all ${
                isActive
                  ? "bg-green-50 text-green-700 hover:bg-green-100"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              } disabled:opacity-50`}
              title={isActive ? "Deactivate item" : "Activate item"}
            >
              {isToggling ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : isActive ? (
                <ToggleRight className="w-5 h-5" />
              ) : (
                <ToggleLeft className="w-5 h-5" />
              )}
              <span>{isActive ? "Active" : "Inactive"}</span>
            </button>

            <button
              onClick={() => onEdit(item)}
              disabled={isDeleting || isToggling}
              className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
              title="Edit item"
            >
              <Edit className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDelete(item.id, item.name)}
              disabled={isDeleting || isToggling}
              className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              title="Delete item"
            >
              {isDeleting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    );
  },
);

MenuItemCard.displayName = "MenuItemCard";

/**
 * Menu Item Row for Table View
 * Memoized for performance optimization
 */
export const MenuItemRow = memo(
  ({
    item,
    onEdit,
    onDelete,
    onToggleActive,
    onUpdateStock,
    isDeleting,
    isToggling,
  }) => {
    const stockQty = item.inventory?.quantity ?? 0;
    const isActive = item.isActive !== false;
    const showLowStock = hasLowStock(item);

    return (
      <tr
        className={`group hover:bg-gray-50/80 transition-colors ${
          !isActive ? "opacity-60 bg-gray-50/50" : ""
        }`}
      >
        <td className="px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-red-500" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {item.name}
              </p>
              {item.description && (
                <p className="text-sm text-gray-500 truncate max-w-xs">
                  {item.description}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
            {item.category?.name}
          </span>
        </td>
        <td className="px-6 py-4 text-right">
          <span className="text-lg font-bold text-gray-900">
            {formatPrice(item.price)}
          </span>
        </td>
        <td className="px-6 py-4">
          <button
            onClick={() => onUpdateStock(item)}
            className="flex items-center justify-center gap-2 mx-auto px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors group/stock"
            title="Click to update stock"
          >
            {showLowStock && (
              <AlertCircle className="w-4 h-4 text-orange-500" />
            )}
            <span
              className={`font-semibold ${getStockColor(
                stockQty,
                item.inventory?.lowStock,
              )}`}
            >
              {stockQty}
            </span>
            <PackagePlus className="w-4 h-4 text-gray-400 opacity-0 group-hover/stock:opacity-100 transition-opacity" />
          </button>
        </td>
        <td className="px-6 py-4">
          <button
            onClick={() => onToggleActive(item)}
            disabled={isToggling}
            className="flex items-center justify-center mx-auto disabled:opacity-50 transition-transform hover:scale-110"
            title={isActive ? "Click to deactivate" : "Click to activate"}
          >
            {isToggling ? (
              <RefreshCw className="w-6 h-6 text-gray-400 animate-spin" />
            ) : isActive ? (
              <ToggleRight className="w-8 h-8 text-green-500" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-gray-400" />
            )}
          </button>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onEdit(item)}
              disabled={isDeleting || isToggling}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50 opacity-60 group-hover:opacity-100"
              title="Edit item"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(item.id, item.name)}
              disabled={isDeleting || isToggling}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 opacity-60 group-hover:opacity-100"
              title="Delete item"
            >
              {isDeleting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </td>
      </tr>
    );
  },
);

MenuItemRow.displayName = "MenuItemRow";

/**
 * Skeleton loader for menu grid
 */
export const MenuGridSkeleton = ({ count = 6 }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse"
        >
          <div className="p-5 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 bg-gray-200 rounded w-2/3"></div>
              <div className="h-5 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="h-4 bg-gray-200 rounded w-20"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
          </div>
          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
            <div className="flex justify-between">
              <div className="h-7 bg-gray-200 rounded w-24"></div>
              <div className="h-7 bg-gray-200 rounded w-20"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-9 bg-gray-200 rounded flex-1"></div>
              <div className="h-9 bg-gray-200 rounded w-9"></div>
              <div className="h-9 bg-gray-200 rounded w-9"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Skeleton loader for menu table
 */
export const MenuTableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="divide-y divide-gray-200">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-6 py-4 animate-pulse"
        >
          <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
          <div className="h-5 bg-gray-200 rounded w-20"></div>
          <div className="h-5 bg-gray-200 rounded w-16"></div>
          <div className="h-5 bg-gray-200 rounded w-12"></div>
          <div className="h-6 bg-gray-200 rounded w-16"></div>
          <div className="flex gap-1">
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MenuItemCard;
