import React, { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  LogOut,
  BarChart3,
  ShoppingCart,
  Menu,
  Home,
  Package,
  Beaker,
  DollarSign,
  Truck,
  X,
  Users,
  ChefHat,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import { useNavigationShortcuts, useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";

const Navbar = () => {
  const { user, logout, isAdmin, isManager, isChef, isAdminOrManager } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Enable global navigation shortcuts
  useNavigationShortcuts();

  // Navbar-specific shortcuts
  useKeyboardShortcuts({
    '?': () => setShowShortcutsHelp(true),
    'escape': () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    },
  });

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo + Page Title */}
          <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4">
            <Link to="/dashboard">
              <div className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 bg-gradient-to-br from-red-500 to-red-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-md hover:scale-105 transition-transform cursor-pointer">
                <ShoppingCart className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-white" />
              </div>
            </Link>
            <div>
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">EatSy</h1>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">{user.email}</p>
            </div>
          </div>

          {/* Desktop Navigation - Hidden on mobile */}
          <div className="hidden lg:flex items-center space-x-2 xl:space-x-3">
            {/* Chef View - Only Kitchen Display */}
            {isChef() && (
              <>
                <Link
                  to="/kitchen"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/kitchen")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <ChefHat className="w-4 h-4" />
                  <span className="hidden md:inline">Kitchen</span>
                </Link>
              </>
            )}

            {/* Admin and Manager View */}
            {isAdminOrManager() && (
              <>
                <Link
                  to="/dashboard"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/dashboard")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden md:inline">Dashboard</span>
                </Link>

                <Link
                  to="/menu"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/menu")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Menu className="w-4 h-4" />
                  <span className="hidden md:inline">Menu</span>
                </Link>

                <Link
                  to="/inventory"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/inventory")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Beaker className="w-4 h-4" />
                  <span className="hidden md:inline">Inventory</span>
                </Link>

                <Link
                  to="/delivery"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/delivery")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Truck className="w-4 h-4" />
                  <span className="hidden md:inline">Delivery</span>
                </Link>

                <Link
                  to="/reports"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/reports")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span className="hidden md:inline">Reports</span>
                </Link>

                {/* Profit Analysis - Admin only */}
                {isAdmin() && (
                  <Link
                    to="/profit-analysis"
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                      isActive("/profit-analysis")
                        ? "bg-red-50 text-red-600"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span className="hidden md:inline">Profits</span>
                  </Link>
                )}

                <Link
                  to="/orders"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/orders")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span className="hidden md:inline">Orders</span>
                </Link>

                {/* Kitchen Display - Accessible to Admin and Manager */}
                <Link
                  to="/kitchen"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/kitchen")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <ChefHat className="w-4 h-4" />
                  <span className="hidden md:inline">Kitchen</span>
                </Link>

                {/* User Management - Admin and Manager */}
                <Link
                  to="/users"
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
                    isActive("/users")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span className="hidden md:inline">Users</span>
                </Link>

                <Link
                  to="/billing"
                  className="px-4 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>New Order</span>
                </Link>
              </>
            )}

            <button
              onClick={logout}
              className="p-2.5 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile: New Order + Hamburger Menu */}
          <div className="flex lg:hidden items-center space-x-2">
            {/* Only show New Order button for Admin and Manager */}
            {isAdminOrManager() && (
              <Link
                to="/billing"
                onClick={closeMobileMenu}
                className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl shadow-md hover:shadow-lg transition-all flex items-center space-x-1.5 sm:space-x-2 active:scale-95"
              >
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span>Order</span>
              </Link>
            )}

            <button
              onClick={toggleMobileMenu}
              className="p-2 sm:p-2.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-all active:scale-95"
              title={isMobileMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-2 border-t border-gray-200 pt-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
            {/* Chef View - Only Kitchen Display */}
            {isChef() && (
              <Link
                to="/kitchen"
                onClick={closeMobileMenu}
                className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                  isActive("/kitchen")
                    ? "bg-red-50 text-red-600"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                <ChefHat className="w-5 h-5" />
                <span>Kitchen Display</span>
              </Link>
            )}

            {/* Admin and Manager View */}
            {isAdminOrManager() && (
              <>
                <Link
                  to="/dashboard"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/dashboard")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Home className="w-5 h-5" />
                  <span>Dashboard</span>
                </Link>

                <Link
                  to="/menu"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/menu")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Menu className="w-5 h-5" />
                  <span>Menu</span>
                </Link>

                <Link
                  to="/inventory"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/inventory")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Beaker className="w-5 h-5" />
                  <span>Inventory</span>
                </Link>

                <Link
                  to="/delivery"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/delivery")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Truck className="w-5 h-5" />
                  <span>Delivery</span>
                </Link>

                <Link
                  to="/reports"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/reports")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  <span>Reports</span>
                </Link>

                {/* Profit Analysis - Admin only */}
                {isAdmin() && (
                  <Link
                    to="/profit-analysis"
                    onClick={closeMobileMenu}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                      isActive("/profit-analysis")
                        ? "bg-red-50 text-red-600"
                        : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                    }`}
                  >
                    <DollarSign className="w-5 h-5" />
                    <span>Profit Analysis</span>
                  </Link>
                )}

                <Link
                  to="/orders"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/orders")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Package className="w-5 h-5" />
                  <span>Orders</span>
                </Link>

                <Link
                  to="/kitchen"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/kitchen")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <ChefHat className="w-5 h-5" />
                  <span>Kitchen Display</span>
                </Link>

                {/* User Management - Admin and Manager */}
                <Link
                  to="/users"
                  onClick={closeMobileMenu}
                  className={`w-full px-4 py-3 text-sm font-medium rounded-lg transition-all flex items-center space-x-3 active:scale-95 ${
                    isActive("/users")
                      ? "bg-red-50 text-red-600"
                      : "text-gray-700 hover:text-gray-900 hover:bg-gray-100"
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span>User Management</span>
                </Link>
              </>
            )}

            <button
              onClick={() => {
                logout();
                closeMobileMenu();
              }}
              className="w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center space-x-3 active:scale-95"
            >
              <LogOut className="w-5 h-5" />
              <span>Logout</span>
            </button>
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </header>
  );
};

export default Navbar;
