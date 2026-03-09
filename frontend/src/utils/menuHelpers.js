import { STOCK_COLORS, STOCK_THRESHOLDS } from "./menuConstants";

/**
 * Get stock status color based on quantity
 */
export const getStockColor = (quantity, lowStock) => {
  if (quantity === STOCK_THRESHOLDS.OUT_OF_STOCK) {
    return STOCK_COLORS.OUT_OF_STOCK;
  }
  if (lowStock || quantity < STOCK_THRESHOLDS.LOW_STOCK_WARNING) {
    return STOCK_COLORS.LOW_STOCK;
  }
  return STOCK_COLORS.IN_STOCK;
};

/**
 * Format price with currency symbol
 */
export const formatPrice = (price) => {
  return `₹${parseFloat(price).toFixed(2)}`;
};

/**
 * Validate form data before submission
 */
export const validateMenuForm = (form) => {
  const errors = [];

  if (!form.name || form.name.trim().length === 0) {
    errors.push("Item name is required");
  }

  if (!form.price || parseFloat(form.price) <= 0) {
    errors.push("Price must be greater than 0");
  }

  if (!form.categoryId) {
    errors.push("Category is required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Filter menu items by search term and category
 */
export const filterMenuItems = (items, searchTerm, selectedCategory) => {
  return items.filter((item) => {
    const matchesSearch = item.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      selectedCategory === "All" || item.category?.name === selectedCategory;
    return matchesSearch && matchesCategory;
  });
};

/**
 * Separate active and inactive items
 */
export const separateActiveItems = (items) => {
  const activeItems = items.filter((item) => item.isActive !== false);
  const inactiveItems = items.filter((item) => item.isActive === false);
  return { activeItems, inactiveItems };
};

/**
 * Get all unique categories from menu items
 */
export const getAllCategories = (categories) => {
  return ["All", ...categories.map((c) => c.name)];
};

/**
 * Returns the list of ingredients that are at or below their minimum stock
 * for a given menu item.
 */
export const getLowStockIngredients = (item) => {
  if (!item.ingredients?.length) return [];
  return item.ingredients
    .filter(
      (mi) =>
        mi.ingredient &&
        mi.ingredient.currentStock <= mi.ingredient.minStock,
    )
    .map((mi) => mi.ingredient);
};

/**
 * Returns true if any ingredient linked to this menu item is low stock.
 */
export const hasIngredientLowStock = (item) => {
  return getLowStockIngredients(item).length > 0;
};

/**
 * Check if item has low stock (ingredient-aware)
 */
export const hasLowStock = (item) => {
  // Ingredient-linked items: check ingredient stock
  if (item.ingredients?.length) return hasIngredientLowStock(item);
  // Plain inventory items: check inventory quantity
  return (
    item.inventory?.lowStock ||
    (item.inventory?.quantity > 0 &&
      item.inventory?.quantity < STOCK_THRESHOLDS.LOW_STOCK_WARNING)
  );
};

/**
 * Check if item is out of stock
 */
export const isOutOfStock = (item) => {
  if (item.ingredients?.length) return false; // prep items are never "out of stock" via inventory
  return item.inventory?.quantity === STOCK_THRESHOLDS.OUT_OF_STOCK;
};

/**
 * Get stock status text (ingredient-aware)
 */
export const getStockStatusText = (item) => {
  if (item.ingredients?.length) {
    const low = getLowStockIngredients(item);
    if (low.length === 0) return "Ingredients OK";
    return `Low: ${low.map((i) => i.name).join(", ")}`;
  }
  if (isOutOfStock(item)) return "Out of Stock";
  if (hasLowStock(item)) return "Low Stock";
  return "In Stock";
};
