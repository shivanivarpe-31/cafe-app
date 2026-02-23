// Structured error handling system with error codes and detailed messages
const config = require('../config/businessConfig');

class AppError extends Error {
  constructor(code, message, details = null, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// Error codes enum
const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',

  // Validation
  VALIDATION_REQUIRED_FIELD: 'VALIDATION_REQUIRED_FIELD',
  VALIDATION_INVALID_VALUE: 'VALIDATION_INVALID_VALUE',
  VALIDATION_OUT_OF_RANGE: 'VALIDATION_OUT_OF_RANGE',

  // Inventory
  INVENTORY_INSUFFICIENT_STOCK: 'INVENTORY_INSUFFICIENT_STOCK',
  INVENTORY_NOT_FOUND: 'INVENTORY_NOT_FOUND',
  INVENTORY_LOW_STOCK: 'INVENTORY_LOW_STOCK',

  // Orders
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  ORDER_INVALID_STATUS: 'ORDER_INVALID_STATUS',
  ORDER_CANNOT_MODIFY: 'ORDER_CANNOT_MODIFY',
  ORDER_CREATION_FAILED: 'ORDER_CREATION_FAILED',
  ORDER_ITEMS_REQUIRED: 'ORDER_ITEMS_REQUIRED',

  // Payment
  PAYMENT_ALREADY_PAID: 'PAYMENT_ALREADY_PAID',
  PAYMENT_INVALID_AMOUNT: 'PAYMENT_INVALID_AMOUNT',
  PAYMENT_VERIFICATION_FAILED: 'PAYMENT_VERIFICATION_FAILED',
  PAYMENT_SPLIT_INVALID: 'PAYMENT_SPLIT_INVALID',
  PAYMENT_EXCEEDS_BALANCE: 'PAYMENT_EXCEEDS_BALANCE',

  // Menu
  MENU_ITEM_NOT_FOUND: 'MENU_ITEM_NOT_FOUND',
  MENU_ITEM_UNAVAILABLE: 'MENU_ITEM_UNAVAILABLE',

  // Tables
  TABLE_NOT_FOUND: 'TABLE_NOT_FOUND',
  TABLE_OCCUPIED: 'TABLE_OCCUPIED',

  // Generic
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// Helper functions to create specific errors

/**
 * Create an insufficient stock error with detailed breakdown
 * @param {Array} missingIngredients - Array of missing ingredient objects
 * @returns {AppError}
 */
function createInsufficientStockError(missingIngredients) {
  const details = missingIngredients.map((item) => ({
    menuItem: item.menuItem,
    ingredient: item.ingredient,
    required: parseFloat(item.required.toFixed(2)),
    available: parseFloat(item.available.toFixed(2)),
    shortage: parseFloat((item.required - item.available).toFixed(2)),
    unit: item.unit,
  }));

  const readableMessage = missingIngredients
    .map(
      (m) =>
        `${m.ingredient} (${m.menuItem}): need ${m.required.toFixed(1)}${m.unit}, have ${m.available.toFixed(1)}${m.unit}, short ${(m.required - m.available).toFixed(1)}${m.unit}`
    )
    .join('; ');

  return new AppError(
    ERROR_CODES.INVENTORY_INSUFFICIENT_STOCK,
    `Insufficient stock: ${readableMessage}`,
    details,
    400
  );
}

/**
 * Create a validation error
 * @param {string} field - Field name
 * @param {string} message - Error message
 * @returns {AppError}
 */
function createValidationError(field, message) {
  return new AppError(
    ERROR_CODES.VALIDATION_INVALID_VALUE,
    message,
    { field },
    400
  );
}

/**
 * Create a payment amount error
 * @param {number} amount - Attempted amount
 * @param {number} remaining - Remaining balance
 * @returns {AppError}
 */
function createPaymentAmountError(amount, remaining) {
  return new AppError(
    ERROR_CODES.PAYMENT_EXCEEDS_BALANCE,
    `Payment amount ${config.currency.symbol}${amount.toFixed(2)} exceeds remaining balance ${config.currency.symbol}${remaining.toFixed(2)}`,
    {
      attemptedAmount: parseFloat(amount.toFixed(2)),
      remainingBalance: parseFloat(remaining.toFixed(2)),
      excess: parseFloat((amount - remaining).toFixed(2)),
    },
    400
  );
}

/**
 * Create a not found error
 * @param {string} resource - Resource type (e.g., "Order", "Table")
 * @param {string|number} id - Resource ID
 * @returns {AppError}
 */
function createNotFoundError(resource, id) {
  return new AppError(
    ERROR_CODES.RESOURCE_NOT_FOUND,
    `${resource} not found`,
    { resource, id },
    404
  );
}

/**
 * Create an order status error
 * @param {string} currentStatus - Current order status
 * @param {string} attemptedStatus - Attempted status change
 * @param {string} reason - Reason why it's invalid
 * @returns {AppError}
 */
function createOrderStatusError(currentStatus, attemptedStatus, reason) {
  return new AppError(
    ERROR_CODES.ORDER_INVALID_STATUS,
    `Cannot change order status from ${currentStatus} to ${attemptedStatus}: ${reason}`,
    {
      currentStatus,
      attemptedStatus,
      reason,
      allowedStatuses: ['PENDING', 'PREPARING', 'SERVED', 'PAID', 'CANCELLED'],
    },
    400
  );
}

/**
 * Create a split payment validation error
 * @param {string} reason - Why validation failed
 * @param {object} details - Payment details
 * @returns {AppError}
 */
function createSplitPaymentError(reason, details) {
  return new AppError(
    ERROR_CODES.PAYMENT_SPLIT_INVALID,
    `Split payment invalid: ${reason}`,
    details,
    400
  );
}

/**
 * Create a low stock warning (not an error, but structured the same way)
 * @param {Array} lowStockItems - Items with low stock
 * @returns {object}
 */
function createLowStockWarning(lowStockItems) {
  return {
    warning: 'LOW_STOCK_WARNING',
    message: 'Some ingredients are running low',
    items: lowStockItems.map((item) => ({
      ingredient: item.name,
      current: parseFloat(item.quantity.toFixed(2)),
      threshold: parseFloat(item.reorderLevel.toFixed(2)),
      unit: item.unit,
      status: item.quantity <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    })),
  };
}

module.exports = {
  AppError,
  ERROR_CODES,
  createInsufficientStockError,
  createValidationError,
  createPaymentAmountError,
  createNotFoundError,
  createOrderStatusError,
  createSplitPaymentError,
  createLowStockWarning,
};
