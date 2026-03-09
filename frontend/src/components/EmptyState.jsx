import React from "react";
import {
  ShoppingCart,
  Package,
  Users,
  FileText,
  Search,
  Inbox,
  AlertCircle,
  CreditCard,
  UtensilsCrossed,
  Clock,
} from "lucide-react";

/**
 * Generic empty state component
 */
export const EmptyState = ({
  icon: Icon = Inbox,
  title,
  message,
  action,
  className = "",
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-up ${className}`}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5 shadow-card"
        style={{
          background: "linear-gradient(135deg,#fff1f1 0%,#ffe0e0 100%)",
          border: "1px solid rgba(229,20,20,.12)",
        }}
      >
        <Icon className="w-7 h-7 text-brand-500" />
      </div>
      <h3 className="text-base font-bold text-gray-900 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-6">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};

/**
 * Empty cart state
 */
const ActionBtn = ({ onClick, children, variant = "primary" }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 hover:-translate-y-px ${
      variant === "primary"
        ? "text-white shadow-brand hover:shadow-brand-lg"
        : "bg-surface-100 text-ink-700 hover:bg-surface-200 border border-black/[.08]"
    }`}
    style={
      variant === "primary"
        ? {
            background: "linear-gradient(135deg,#ef4444,#dc2626)",
            boxShadow: "0 3px 10px rgba(220,38,38,.25)",
          }
        : undefined
    }
  >
    {children}
  </button>
);

export const EmptyCart = ({ onBrowseMenu }) => {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Your cart is empty"
      message="Add items from the menu to get started with your order."
      action={
        onBrowseMenu && (
          <ActionBtn onClick={onBrowseMenu}>Browse Menu</ActionBtn>
        )
      }
    />
  );
};

export const EmptyOrders = ({ onCreateOrder }) => (
  <EmptyState
    icon={FileText}
    title="No orders yet"
    message="Orders will appear here once customers start placing them."
    action={
      onCreateOrder && (
        <ActionBtn onClick={onCreateOrder}>Create Order</ActionBtn>
      )
    }
  />
);

export const EmptyInventory = ({ onAddIngredient }) => (
  <EmptyState
    icon={Package}
    title="No ingredients in inventory"
    message="Start by adding ingredients to track your stock levels."
    action={
      onAddIngredient && (
        <ActionBtn onClick={onAddIngredient}>Add Ingredient</ActionBtn>
      )
    }
  />
);

export const EmptyMenu = ({ onAddItem }) => (
  <EmptyState
    icon={UtensilsCrossed}
    title="No menu items"
    message="Your menu is empty. Add items to start taking orders from customers."
    action={
      onAddItem && <ActionBtn onClick={onAddItem}>Add Menu Item</ActionBtn>
    }
  />
);

export const EmptySearchResults = ({ searchTerm, onClearSearch }) => (
  <EmptyState
    icon={Search}
    title="No results found"
    message={
      searchTerm
        ? `No results match "${searchTerm}". Try a different search term.`
        : "No results found. Try adjusting your search criteria."
    }
    action={
      onClearSearch && (
        <ActionBtn onClick={onClearSearch} variant="secondary">
          Clear Search
        </ActionBtn>
      )
    }
  />
);

export const EmptyTables = ({ onAddTable }) => (
  <EmptyState
    icon={Users}
    title="No tables configured"
    message="Set up your restaurant tables to start managing dine-in orders."
    action={onAddTable && <ActionBtn onClick={onAddTable}>Add Table</ActionBtn>}
  />
);

export const EmptyPendingPayments = () => (
  <EmptyState
    icon={CreditCard}
    title="All caught up!"
    message="No pending payments. All orders have been settled."
    className="bg-emerald-50/60 border border-emerald-200 rounded-2xl"
  />
);

export const EmptyActiveOrders = () => (
  <EmptyState
    icon={Clock}
    title="No active orders"
    message="All orders have been completed. New orders will appear here automatically."
  />
);

export const ErrorState = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => (
  <EmptyState
    icon={AlertCircle}
    title={title}
    message={
      message || "An error occurred while loading data. Please try again."
    }
    action={onRetry && <ActionBtn onClick={onRetry}>Try Again</ActionBtn>}
    className="bg-red-50/60 border border-red-200 rounded-2xl"
  />
);

const EmptyStateExports = {
  EmptyState,
  EmptyCart,
  EmptyOrders,
  EmptyInventory,
  EmptyMenu,
  EmptySearchResults,
  EmptyTables,
  EmptyPendingPayments,
  EmptyActiveOrders,
  ErrorState,
};

export default EmptyStateExports;
