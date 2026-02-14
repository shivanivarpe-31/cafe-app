import React, { memo } from "react";
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  History,
  Edit,
  Trash2,
  Package,
  RefreshCw,
} from "lucide-react";

/**
 * Get unit short label
 */
export const getUnitLabel = (unit) => {
  const labels = {
    GRAMS: "g",
    KG: "kg",
    ML: "ml",
    LITERS: "L",
    PIECES: "pcs",
    CUPS: "cups",
    TABLESPOONS: "tbsp",
    TEASPOONS: "tsp",
  };
  return labels[unit] || unit;
};

/**
 * Get stock status color
 */
export const getStockStatusColor = (currentStock, minStock, lowStock) => {
  if (currentStock <= 0) return "text-red-600";
  if (lowStock || currentStock <= minStock) return "text-orange-600";
  return "text-green-600";
};

/**
 * Ingredient Table Row Component
 */
export const IngredientRow = memo(
  ({
    ingredient,
    onAddStock,
    onRecordWastage,
    onViewLogs,
    onEdit,
    onDelete,
    isDeleting,
  }) => {
    const stockColor = getStockStatusColor(
      ingredient.currentStock,
      ingredient.minStock,
      ingredient.lowStock,
    );

    return (
      <tr
        className={`group hover:bg-gray-50/80 transition-colors ${
          ingredient.lowStock ? "bg-orange-50/50" : ""
        }`}
      >
        <td className="px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            {ingredient.lowStock && (
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {ingredient.name}
              </p>
              {ingredient.supplier && (
                <p className="text-xs text-gray-500 truncate">
                  {ingredient.supplier}
                </p>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4 text-center">
          <div className="flex flex-col items-center">
            <span className={`text-lg font-bold ${stockColor}`}>
              {ingredient.currentStock.toLocaleString()}
            </span>
            <span className="text-xs text-gray-500">
              {getUnitLabel(ingredient.unit)}
            </span>
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4 text-center hidden sm:table-cell">
          <span className="text-gray-600">
            {ingredient.minStock} {getUnitLabel(ingredient.unit)}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-4 text-center hidden md:table-cell">
          <span className="text-gray-700 font-medium">
            ₹{parseFloat(ingredient.costPerUnit || 0).toFixed(2)}
          </span>
        </td>
        <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
          <div className="flex flex-wrap gap-1 max-w-[200px]">
            {ingredient.usedIn?.slice(0, 2).map((item, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-100"
              >
                {item}
              </span>
            ))}
            {ingredient.usedIn?.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                +{ingredient.usedIn.length - 2}
              </span>
            )}
            {(!ingredient.usedIn || ingredient.usedIn.length === 0) && (
              <span className="text-xs text-gray-400 italic">Not used</span>
            )}
          </div>
        </td>
        <td className="px-4 sm:px-6 py-4">
          <div className="flex items-center justify-center gap-0.5">
            <button
              onClick={() => onAddStock(ingredient)}
              className="p-1.5 sm:p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Add Stock"
            >
              <TrendingUp className="w-4 h-4" />
            </button>
            <button
              onClick={() => onRecordWastage(ingredient)}
              className="p-1.5 sm:p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="Record Wastage"
            >
              <TrendingDown className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewLogs(ingredient)}
              className="p-1.5 sm:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors hidden sm:block"
              title="View History"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(ingredient)}
              className="p-1.5 sm:p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDelete(ingredient.id, ingredient.name)}
              disabled={isDeleting}
              className="p-1.5 sm:p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
              title="Delete"
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

IngredientRow.displayName = "IngredientRow";

/**
 * Skeleton loader for ingredients table
 */
export const IngredientTableSkeleton = ({ rows = 5 }) => {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 px-6 py-4 animate-pulse"
        >
          <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-3 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="h-6 bg-gray-200 rounded w-16"></div>
          <div className="h-4 bg-gray-200 rounded w-12 hidden sm:block"></div>
          <div className="h-4 bg-gray-200 rounded w-16 hidden md:block"></div>
          <div className="flex gap-1">
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
            <div className="h-8 w-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Stats Card Component - Compact version
 */
export const StatsCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  color = "gray",
  trend,
}) => {
  const colorClasses = {
    red: "bg-red-50 text-red-600 border-red-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
    green: "bg-green-50 text-green-600 border-green-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
  };

  const iconBgClasses = {
    red: "bg-red-100",
    orange: "bg-orange-100",
    green: "bg-green-100",
    blue: "bg-blue-100",
    purple: "bg-purple-100",
    gray: "bg-gray-100",
  };

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${colorClasses[color]}`}>
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-md ${iconBgClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold leading-none">{value}</p>
            {trend && (
              <span
                className={`text-[10px] font-medium ${
                  trend > 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {trend > 0 ? "+" : ""}
                {trend}%
              </span>
            )}
          </div>
          <p className="text-xs opacity-75 truncate">{label}</p>
          {subValue && (
            <p className="text-[10px] opacity-60 truncate">{subValue}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Skeleton for stats cards - Compact version
 */
export const StatsCardSkeleton = () => {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 animate-pulse">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-gray-200 rounded-md"></div>
        <div className="flex-1 space-y-1.5">
          <div className="h-5 bg-gray-200 rounded w-12"></div>
          <div className="h-3 bg-gray-200 rounded w-20"></div>
        </div>
      </div>
    </div>
  );
};

export default IngredientRow;
