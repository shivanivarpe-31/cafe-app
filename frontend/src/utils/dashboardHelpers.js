import {
  TABLE_COLORS,
  TABLE_BADGE_COLORS,
  PLATFORM_STYLES,
  DELIVERY_STATUS_COLORS,
} from "./dashboardConstants";

/**
 * Normalize status strings to lowercase for consistent comparison
 */
export const getStatus = (status) => String(status || "").toLowerCase();

/**
 * Get table card background and border color based on status
 */
export const getTableColor = (status) => {
  const normalizedStatus = getStatus(status).toUpperCase();
  return TABLE_COLORS[normalizedStatus] || TABLE_COLORS.AVAILABLE;
};

/**
 * Get table status badge color
 */
export const getStatusBadge = (status) => {
  const normalizedStatus = getStatus(status).toUpperCase();
  return TABLE_BADGE_COLORS[normalizedStatus] || TABLE_BADGE_COLORS.AVAILABLE;
};

/**
 * Get platform badge styling (Zomato, Swiggy, etc.)
 */
export const getPlatformStyle = (platform) => {
  if (!platform) return PLATFORM_STYLES.DEFAULT.badge;
  return PLATFORM_STYLES[platform]?.badge || PLATFORM_STYLES.DEFAULT.badge;
};

/**
 * Get platform border styling for order cards
 */
export const getPlatformBorder = (platform) => {
  if (!platform) return PLATFORM_STYLES.DEFAULT.border;
  return PLATFORM_STYLES[platform]?.border || PLATFORM_STYLES.DEFAULT.border;
};

/**
 * Get delivery status badge color
 */
export const getDeliveryStatusColor = (status) => {
  return DELIVERY_STATUS_COLORS[status] || "bg-gray-100 text-gray-800";
};

/**
 * Format time remaining for reservations
 * @returns {string|null} - Formatted time string or "Expired"
 */
export const getTimeRemaining = (reservedUntil) => {
  if (!reservedUntil) return null;

  const now = new Date();
  const until = new Date(reservedUntil);
  const diff = until.getTime() - now.getTime();

  if (diff <= 0) return "Expired";

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m left`;
  }
  return `${minutes}m left`;
};

/**
 * Format time ago from a given date
 * @returns {string} - Human-readable time ago string
 */
export const getTimeAgo = (date) => {
  const now = new Date();
  const orderDate = new Date(date);
  const diff = now.getTime() - orderDate.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return orderDate.toLocaleDateString();
};

/**
 * Calculate table occupancy percentage
 */
export const calculateOccupancyPercentage = (tables) => {
  const totalTables = tables.length || 1;
  const occupiedCount = tables.filter(
    (t) => getStatus(t.status) === "occupied"
  ).length;
  return Math.round((occupiedCount / totalTables) * 100);
};

/**
 * Filter active delivery orders (pending, confirmed, preparing, ready for pickup)
 */
export const getActiveDeliveryOrders = (orders) => {
  return orders.filter(
    (o) =>
      o.deliveryInfo?.deliveryStatus === "PENDING" ||
      o.deliveryInfo?.deliveryStatus === "CONFIRMED" ||
      o.deliveryInfo?.deliveryStatus === "PREPARING" ||
      o.deliveryInfo?.deliveryStatus === "READY_FOR_PICKUP"
  );
};

/**
 * Check if there are new orders compared to previous order IDs
 */
export const detectNewOrders = (currentOrders, previousOrderIds) => {
  return currentOrders.filter((order) => !previousOrderIds.has(order.id));
};

/**
 * Validate reservation form data
 */
export const validateReservationData = (reservationData) => {
  const { tableId, customerName, reservedFrom, reservedUntil } = reservationData;

  if (!tableId || !customerName || !reservedFrom || !reservedUntil) {
    return { valid: false, error: "Please fill all required fields for the reservation." };
  }

  const from = new Date(reservedFrom);
  const to = new Date(reservedUntil);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return { valid: false, error: "Invalid reservation dates." };
  }

  if (from >= to) {
    return { valid: false, error: "Reservation start must be earlier than end." };
  }

  return { valid: true };
};
