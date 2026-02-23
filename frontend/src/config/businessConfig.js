/**
 * Centralized Business Configuration — Frontend
 *
 * All business-specific constants live here so they can be changed in one place.
 * Values can be overridden with REACT_APP_ environment variables at build time.
 */

const businessConfig = {
    // ── Restaurant identity ──────────────────────────────────────
    restaurant: {
        name: process.env.REACT_APP_RESTAURANT_NAME || "Cafe POS",
        address:
            process.env.REACT_APP_RESTAURANT_ADDRESS ||
            "123 Restaurant Street, City",
        phone: process.env.REACT_APP_RESTAURANT_PHONE || "+91 98765 43210",
        gstin: process.env.REACT_APP_RESTAURANT_GSTIN || "",
    },

    // ── Tax ──────────────────────────────────────────────────────
    tax: {
        /** GST rate as a decimal (0.05 = 5%) */
        rate: parseFloat(process.env.REACT_APP_TAX_RATE || "0.05"),
        /** Label shown on bills / UI */
        get label() {
            return (
                process.env.REACT_APP_TAX_LABEL ||
                `GST (${(this.rate * 100).toFixed(0)}%)`
            );
        },
    },

    // ── Currency ─────────────────────────────────────────────────
    currency: {
        code: process.env.REACT_APP_CURRENCY_CODE || "INR",
        symbol: process.env.REACT_APP_CURRENCY_SYMBOL || "₹",
        locale: process.env.REACT_APP_CURRENCY_LOCALE || "en-IN",
    },

    // ── Inventory ────────────────────────────────────────────────
    inventory: {
        /** Default minimum-stock threshold for new ingredients */
        defaultMinStock: parseInt(
            process.env.REACT_APP_DEFAULT_MIN_STOCK || "10",
            10,
        ),
    },
};

export default businessConfig;
