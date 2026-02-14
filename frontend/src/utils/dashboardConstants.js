// Polling intervals for smart polling
export const POLLING_INTERVALS = {
  ACTIVE_POLL: 60000,      // 1 minute when user is active
  IDLE_POLL: 180000,       // 3 minutes when user is idle
  INACTIVE_AFTER: 300000,  // Consider inactive after 5 minutes
};

// Alert durations
export const ALERT_DURATION = 5000; // 5 seconds

// Maximum delivery orders to show on dashboard
export const MAX_DELIVERY_ORDERS_PREVIEW = 6;

// Maximum recent orders to display
export const MAX_RECENT_ORDERS = 5;

// Platform styling configurations
export const PLATFORM_STYLES = {
  ZOMATO: {
    badge: "bg-red-500 text-white",
    border: "border-red-400 bg-red-50",
  },
  SWIGGY: {
    badge: "bg-orange-500 text-white",
    border: "border-orange-400 bg-orange-50",
  },
  DEFAULT: {
    badge: "bg-gray-500 text-white",
    border: "border-blue-400 bg-blue-50",
  },
};

// Delivery status color mapping
export const DELIVERY_STATUS_COLORS = {
  PENDING: "bg-yellow-100 text-yellow-800",
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-orange-100 text-orange-800",
  READY_FOR_PICKUP: "bg-green-100 text-green-800",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-500 text-white",
  CANCELLED: "bg-red-100 text-red-800",
};

// Table status color mapping
export const TABLE_COLORS = {
  OCCUPIED: "bg-red-50 border-red-200",
  RESERVED: "bg-yellow-50 border-yellow-300",
  AVAILABLE: "bg-white border-gray-200",
};

// Table status badge colors
export const TABLE_BADGE_COLORS = {
  OCCUPIED: "bg-red-500",
  RESERVED: "bg-yellow-500",
  AVAILABLE: "bg-gray-400",
};

// Dashboard sections
export const DASHBOARD_SECTIONS = ["All Tables", "Available", "Occupied", "Reserved"];

// Sound notification frequencies
export const NOTIFICATION_SOUNDS = {
  FIRST_DING: 800,
  SECOND_DING: 1000,
  DELAY_MS: 200,
};

// Voice notification settings
export const VOICE_SETTINGS = {
  TEXT: "New online order received!",
  RATE: 1.1,
  PITCH: 1,
  VOLUME: 1,
};
