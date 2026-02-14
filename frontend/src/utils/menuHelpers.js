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
 * Check if item has low stock
 */
export const hasLowStock = (item) => {
  return item.inventory?.lowStock ||
    (item.inventory?.quantity > 0 && item.inventory?.quantity < STOCK_THRESHOLDS.LOW_STOCK_WARNING);
};

/**
 * Check if item is out of stock
 */
export const isOutOfStock = (item) => {
  return item.inventory?.quantity === STOCK_THRESHOLDS.OUT_OF_STOCK;
};

/**
 * Get stock status text
 */
export const getStockStatusText = (item) => {
  if (isOutOfStock(item)) return "Out of Stock";
  if (hasLowStock(item)) return "Low Stock";
  return "In Stock";
};
