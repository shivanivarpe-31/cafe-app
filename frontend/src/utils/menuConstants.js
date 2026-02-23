// Menu page constants

// Stock status thresholds
export const STOCK_THRESHOLDS = {
  OUT_OF_STOCK: 0,
  LOW_STOCK_WARNING: 10, // Below this triggers low stock warning
};

// Stock status colors
export const STOCK_COLORS = {
  OUT_OF_STOCK: "text-gray-800",
  LOW_STOCK: "text-gray-800",
  IN_STOCK: "text-gray-800",
};

// Category badge colors (can be expanded for specific categories)
export const CATEGORY_BADGE_COLOR = "bg-purple-100 text-gray-800";

// Form validation
export const VALIDATION = {
  MIN_PRICE: 0,
  MAX_PRICE: 999999,
  MIN_NAME_LENGTH: 1,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
};

// Stock adjustment presets (for quick +/- buttons)
export const STOCK_ADJUSTMENTS = {
  SMALL: 1,
  MEDIUM: 5,
  LARGE: 10,
};

// Default form state
export const DEFAULT_FORM_STATE = {
  name: "",
  description: "",
  price: "",
  categoryId: 1,
};
