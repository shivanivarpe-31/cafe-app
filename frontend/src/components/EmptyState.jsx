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
      className={`flex flex-col items-center justify-center py-16 px-4 ${className}`}
    >
      <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-10 h-10 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-sm text-gray-600 text-center max-w-md mb-6">
        {message}
      </p>
      {action && <div>{action}</div>}
    </div>
  );
};

/**
 * Empty cart state
 */
export const EmptyCart = ({ onBrowseMenu }) => {
  return (
    <EmptyState
      icon={ShoppingCart}
      title="Your cart is empty"
      message="Add items from the menu to get started with your order."
      action={
        onBrowseMenu && (
          <button
            onClick={onBrowseMenu}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Browse Menu
          </button>
        )
      }
    />
  );
};

/**
 * Empty orders state
 */
export const EmptyOrders = ({ onCreateOrder }) => {
  return (
    <EmptyState
      icon={FileText}
      title="No orders yet"
      message="Orders will appear here once customers start placing them. Get started by creating your first order."
      action={
        onCreateOrder && (
          <button
            onClick={onCreateOrder}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Create Order
          </button>
        )
      }
    />
  );
};

/**
 * Empty inventory state
 */
export const EmptyInventory = ({ onAddIngredient }) => {
  return (
    <EmptyState
      icon={Package}
      title="No ingredients in inventory"
      message="Start by adding ingredients to track your stock levels and manage your inventory."
      action={
        onAddIngredient && (
          <button
            onClick={onAddIngredient}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Add Ingredient
          </button>
        )
      }
    />
  );
};

/**
 * Empty menu items state
 */
export const EmptyMenu = ({ onAddItem }) => {
  return (
    <EmptyState
      icon={UtensilsCrossed}
      title="No menu items"
      message="Your menu is empty. Add items to start taking orders from customers."
      action={
        onAddItem && (
          <button
            onClick={onAddItem}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Add Menu Item
          </button>
        )
      }
    />
  );
};

/**
 * Empty search results
 */
export const EmptySearchResults = ({ searchTerm, onClearSearch }) => {
  return (
    <EmptyState
      icon={Search}
      title="No results found"
      message={
        searchTerm
          ? `No results found for "${searchTerm}". Try a different search term.`
          : "No results found. Try adjusting your search criteria."
      }
      action={
        onClearSearch && (
          <button
            onClick={onClearSearch}
            className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
          >
            Clear Search
          </button>
        )
      }
    />
  );
};

/**
 * Empty tables state
 */
export const EmptyTables = ({ onAddTable }) => {
  return (
    <EmptyState
      icon={Users}
      title="No tables configured"
      message="Set up your restaurant tables to start managing dine-in orders."
      action={
        onAddTable && (
          <button
            onClick={onAddTable}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Add Table
          </button>
        )
      }
    />
  );
};

/**
 * Empty pending payments state
 */
export const EmptyPendingPayments = () => {
  return (
    <EmptyState
      icon={CreditCard}
      title="No pending payments"
      message="All payments have been collected. Orders with pending payments will appear here."
      className="bg-green-50 border-2 border-green-200 rounded-2xl"
    />
  );
};

/**
 * Empty active orders state
 */
export const EmptyActiveOrders = () => {
  return (
    <EmptyState
      icon={Clock}
      title="No active orders"
      message="All orders have been completed. New orders will appear here when customers place them."
    />
  );
};

/**
 * Error state (for failed API calls)
 */
export const ErrorState = ({
  title = "Something went wrong",
  message,
  onRetry,
}) => {
  return (
    <EmptyState
      icon={AlertCircle}
      title={title}
      message={
        message || "An error occurred while loading data. Please try again."
      }
      action={
        onRetry && (
          <button
            onClick={onRetry}
            className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors"
          >
            Try Again
          </button>
        )
      }
      className="bg-red-50 border-2 border-red-200 rounded-2xl"
    />
  );
};

export default {
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
