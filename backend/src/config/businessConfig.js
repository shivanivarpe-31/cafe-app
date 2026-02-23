/**
 * Centralized Business Configuration
 *
 * All business-specific constants live here so they can be changed in one place.
 * Values fall back to sensible defaults but can be overridden with environment
 * variables for deployment flexibility.
 */

const config = {
    // ── Restaurant identity ──────────────────────────────────────
    restaurant: {
        name: process.env.RESTAURANT_NAME || 'Cafe POS',
        address: process.env.RESTAURANT_ADDRESS || '123 Restaurant Street, City',
        phone: process.env.RESTAURANT_PHONE || '+91 98765 43210',
        gstin: process.env.RESTAURANT_GSTIN || '',
    },

    // ── Tax ──────────────────────────────────────────────────────
    tax: {
        /** GST rate as a decimal (0.05 = 5 %) */
        rate: parseFloat(process.env.TAX_RATE || '0.05'),
        /** Label shown on bills / UI (e.g. "GST (5%)") */
        get label() {
            return process.env.TAX_LABEL || `GST (${(this.rate * 100).toFixed(0)}%)`;
        },
    },

    // ── Currency ─────────────────────────────────────────────────
    currency: {
        code: process.env.CURRENCY_CODE || 'INR',
        symbol: process.env.CURRENCY_SYMBOL || '₹',
        locale: process.env.CURRENCY_LOCALE || 'en-IN',
    },

    // ── Inventory ────────────────────────────────────────────────
    inventory: {
        /** Default minimum-stock threshold for new ingredients */
        defaultMinStock: parseInt(process.env.DEFAULT_MIN_STOCK || '10', 10),
        /** Threshold used by the legacy inventory controller */
        lowStockThreshold: parseInt(process.env.LOW_STOCK_THRESHOLD || '10', 10),
    },

    // ── Delivery ─────────────────────────────────────────────────
    delivery: {
        defaultPackagingFee: parseFloat(process.env.DEFAULT_PACKAGING_FEE || '10'),
    },
};

module.exports = config;
