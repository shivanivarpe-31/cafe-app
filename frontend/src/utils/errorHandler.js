// Utility functions for handling and displaying API errors

/**
 * Format error response from API into user-friendly message
 * @param {Error} err - Axios error object
 * @param {string} fallbackMessage - Default message if error parsing fails
 * @returns {object} - Formatted error object with message and details
 */
export function formatApiError(err, fallbackMessage = 'An error occurred') {
  // If no error object
  if (!err) {
    return {
      message: fallbackMessage,
      details: null,
      code: 'UNKNOWN_ERROR',
    };
  }

  // Extract error data from Axios response
  const errorData = err.response?.data;

  if (!errorData) {
    // Network error or no response
    if (err.message === 'Network Error') {
      return {
        message: 'Unable to connect to server. Please check your connection.',
        details: null,
        code: 'NETWORK_ERROR',
      };
    }
    return {
      message: err.message || fallbackMessage,
      details: null,
      code: 'UNKNOWN_ERROR',
    };
  }

  // Return structured error with details
  return {
    message: errorData.error || fallbackMessage,
    details: errorData.details || null,
    code: errorData.code || 'UNKNOWN_ERROR',
  };
}

/**
 * Format ingredient shortage details for display
 * @param {Array} details - Array of ingredient shortage objects
 * @returns {string} - Formatted HTML string
 */
export function formatIngredientShortage(details) {
  if (!details || !Array.isArray(details)) return null;

  return details.map((item) => ({
    menuItem: item.menuItem,
    ingredient: item.ingredient,
    message: `${item.ingredient} (${item.menuItem}): need ${item.required}${item.unit}, have ${item.available}${item.unit}, short ${item.shortage}${item.unit}`,
    shortage: item.shortage,
    unit: item.unit,
    required: item.required,
    available: item.available,
  }));
}

/**
 * Get user-friendly error message based on error code
 * @param {string} code - Error code from API
 * @param {object} details - Error details
 * @returns {string} - User-friendly message
 */
export function getUserFriendlyMessage(code, details) {
  switch (code) {
    case 'INVENTORY_INSUFFICIENT_STOCK':
      if (details && Array.isArray(details)) {
        const formatted = formatIngredientShortage(details);
        if (formatted && formatted.length > 0) {
          return {
            title: 'Insufficient Stock',
            items: formatted,
          };
        }
      }
      return { title: 'Insufficient Stock', items: [] };

    case 'INVENTORY_LOW_STOCK':
      return { title: 'Low Stock Warning', items: [] };

    case 'ORDER_NOT_FOUND':
      return { title: 'Order Not Found', items: [] };

    case 'PAYMENT_ALREADY_PAID':
      return { title: 'Payment Already Completed', items: [] };

    case 'PAYMENT_INVALID_AMOUNT':
      if (details) {
        return {
          title: 'Invalid Payment Amount',
          items: [
            {
              message: `Order total: ₹${details.orderTotal}, Payment amount: ₹${details.paymentAmount}`,
            },
          ],
        };
      }
      return { title: 'Invalid Payment Amount', items: [] };

    case 'PAYMENT_EXCEEDS_BALANCE':
      if (details) {
        return {
          title: 'Amount Exceeds Balance',
          items: [
            {
              message: `Attempted: ₹${details.attemptedAmount}, Remaining: ₹${details.remainingBalance}`,
            },
          ],
        };
      }
      return { title: 'Amount Exceeds Balance', items: [] };

    case 'AUTH_INVALID_CREDENTIALS':
      return { title: 'Invalid Credentials', items: [] };

    case 'AUTH_TOKEN_EXPIRED':
      return { title: 'Session Expired', items: [] };

    case 'VALIDATION_INVALID_VALUE':
      return { title: 'Validation Error', items: [] };

    default:
      return { title: 'Error', items: [] };
  }
}

/**
 * Display error in console with details (for debugging)
 * @param {string} context - Where the error occurred
 * @param {Error} err - Error object
 */
export function logError(context, err) {
  const formatted = formatApiError(err);
  console.error(`[${context}]`, {
    message: formatted.message,
    code: formatted.code,
    details: formatted.details,
    originalError: err,
  });
}
