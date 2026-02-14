import React, { memo } from "react";
import { ChefHat, AlertTriangle, DollarSign } from "lucide-react";
import { getUnitLabel } from "./IngredientComponents";

/**
 * Recipe Card for menu item recipes
 */
export const RecipeCard = memo(({ item, onEditRecipe }) => {
  const hasRecipe = item.ingredients && item.ingredients.length > 0;

  // Calculate total ingredient cost
  const totalCost = hasRecipe
    ? item.ingredients.reduce((sum, ing) => {
        const cost =
          (ing.ingredient?.costPerUnit || 0) * parseFloat(ing.quantity || 0);
        return sum + cost;
      }, 0)
    : 0;

  const profit = hasRecipe ? parseFloat(item.price) - totalCost : 0;
  const profitMargin = hasRecipe
    ? ((profit / parseFloat(item.price)) * 100).toFixed(0)
    : 0;

  return (
    <div className="group bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-gray-300 transition-all duration-200">
      {/* Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 truncate">{item.name}</h3>
            <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-medium rounded-full mt-1">
              {item.category?.name}
            </span>
          </div>
          <span className="text-lg font-bold text-red-600 flex-shrink-0 ml-2">
            ₹{parseFloat(item.price).toFixed(0)}
          </span>
        </div>

        {/* Recipe info */}
        {hasRecipe ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 font-medium uppercase tracking-wide">
                Recipe ({item.ingredients.length} ingredients)
              </span>
              {profitMargin > 0 && (
                <span
                  className={`flex items-center gap-1 font-semibold ${
                    profitMargin >= 50
                      ? "text-green-600"
                      : profitMargin >= 30
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  <DollarSign className="w-3 h-3" />
                  {profitMargin}% margin
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              {item.ingredients.slice(0, 3).map((ing, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-gray-600 truncate flex-1">
                    {ing.ingredient?.name}
                  </span>
                  <span className="text-gray-500 text-xs ml-2">
                    {ing.quantity} {getUnitLabel(ing.ingredient?.unit)}
                  </span>
                </div>
              ))}
              {item.ingredients.length > 3 && (
                <p className="text-xs text-gray-400 italic">
                  +{item.ingredients.length - 3} more ingredients
                </p>
              )}
            </div>

            {/* Cost breakdown */}
            <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-xs">
              <span className="text-gray-500">Ingredient cost</span>
              <span className="font-medium text-gray-700">
                ₹{totalCost.toFixed(2)}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-3 text-orange-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">No recipe defined</span>
          </div>
        )}
      </div>

      {/* Action */}
      <div className="px-5 py-4 bg-gray-50/50 border-t border-gray-100">
        <button
          onClick={() => onEditRecipe(item)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <ChefHat className="w-4 h-4" />
          <span>{hasRecipe ? "Edit Recipe" : "Add Recipe"}</span>
        </button>
      </div>
    </div>
  );
});

RecipeCard.displayName = "RecipeCard";

/**
 * Skeleton for recipe cards
 */
export const RecipeCardSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-5 space-y-3">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-5 bg-gray-200 rounded w-32"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="h-6 bg-gray-200 rounded w-12"></div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </div>
      <div className="px-5 py-4 bg-gray-50 border-t border-gray-100">
        <div className="h-10 bg-gray-200 rounded-xl"></div>
      </div>
    </div>
  );
};

export default RecipeCard;
