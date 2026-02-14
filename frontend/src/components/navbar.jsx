import React, { useState, useRef, useEffect } from "react";
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
  ChevronDown,
  User,
  Keyboard,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import KeyboardShortcutsHelp from "./KeyboardShortcutsHelp";
import {
  useNavigationShortcuts,
  useKeyboardShortcuts,
} from "../hooks/useKeyboardShortcuts";

const Navbar = () => {
  const {
    user,
    logout,
    isAdmin,
    isManager,
    isChef,
    isAdminOrManager,
  } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  // Enable global navigation shortcuts
  useNavigationShortcuts();

  // Navbar-specific shortcuts
  useKeyboardShortcuts({
    "?": () => setShowShortcutsHelp(true),
    escape: () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      else if (showUserMenu) setShowUserMenu(false);
    },
  });

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (path) => location.pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  // Get user role display
  const getUserRole = () => {
    if (isAdmin()) return { label: "Admin", color: "bg-red-100 text-red-700" };
    if (isManager())
      return { label: "Manager", color: "bg-blue-100 text-blue-700" };
    if (isChef())
      return { label: "Chef", color: "bg-orange-100 text-orange-700" };
    return { label: "Staff", color: "bg-gray-100 text-gray-700" };
  };

  const userRole = getUserRole();

  // Navigation items for desktop
  const NavLink = ({ to, icon: Icon, label }) => (
    <Link
      to={to}
      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-2 ${
        isActive(to)
          ? "bg-red-50 text-red-600 shadow-sm"
          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </Link>
  );

  // Mobile navigation item
  const MobileNavLink = ({ to, icon: Icon, label, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-all flex items-center space-x-3 ${
        isActive(to)
          ? "bg-red-50 text-red-600"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          isActive(to) ? "bg-red-100" : "bg-gray-100"
        }`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span>{label}</span>
    </Link>
  );

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Left: Logo + Brand */}
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard"
                className="flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/30 group-hover:scale-105 transition-all">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-gray-900 leading-tight">
                    EatSy
                  </h1>
                  <p className="text-[10px] text-gray-400 font-medium tracking-wide uppercase">
                    POS System
                  </p>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-1">
              {/* Chef View - Only Kitchen Display */}
              {isChef() && !isAdminOrManager() && (
                <NavLink to="/kitchen" icon={ChefHat} label="Kitchen" />
              )}

              {/* Admin and Manager View */}
              {isAdminOrManager() && (
                <>
                  <NavLink to="/dashboard" icon={Home} label="Dashboard" />
                  <NavLink to="/menu" icon={Menu} label="Menu" />
                  <NavLink to="/inventory" icon={Beaker} label="Inventory" />
                  <NavLink to="/orders" icon={Package} label="Orders" />
                  <NavLink to="/kitchen" icon={ChefHat} label="Kitchen" />
                  <NavLink to="/delivery" icon={Truck} label="Delivery" />
                  <NavLink to="/reports" icon={BarChart3} label="Reports" />
                  {isAdmin() && (
                    <NavLink
                      to="/profit-analysis"
                      icon={DollarSign}
                      label="Profits"
                    />
                  )}
                  <NavLink to="/users" icon={Users} label="Users" />
                </>
              )}
            </nav>

            {/* Right: Actions + User */}
            <div className="flex items-center space-x-2">
              {/* New Order Button - Desktop */}
              {isAdminOrManager() && (
                <Link
                  to="/billing"
                  className="hidden lg:flex px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-red-500/20 hover:shadow-lg hover:shadow-red-500/30 transition-all items-center space-x-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>New Order</span>
                </Link>
              )}

              {/* Keyboard Shortcuts Hint
              <button
                onClick={() => setShowShortcutsHelp(true)}
                className="hidden md:flex p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                title="Keyboard shortcuts (?)"
              >
                <Keyboard className="w-5 h-5" />
              </button> */}

              {/* User Menu - Desktop */}
              <div className="hidden lg:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-all"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                  <div className="text-left hidden xl:block">
                    <p className="text-sm font-medium text-gray-900 leading-tight truncate max-w-[120px]">
                      {user?.name || user?.email?.split("@")[0] || "User"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {userRole.label}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform ${
                      showUserMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* User Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center">
                          <User className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user?.name || "User"}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-md ${userRole.color}`}
                      >
                        {userRole.label}
                      </span>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowShortcutsHelp(true);
                        }}
                        className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                      >
                        <Keyboard className="w-4 h-4 text-gray-400" />
                        <span>Keyboard Shortcuts</span>
                        <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          ?
                        </span>
                      </button>
                    </div>

                    {/* Logout */}
                    <div className="pt-1 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile: New Order + Hamburger */}
              <div className="flex lg:hidden items-center space-x-2">
                {isAdminOrManager() && (
                  <Link
                    to="/billing"
                    onClick={closeMobileMenu}
                    className="px-3 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-semibold rounded-lg shadow-md flex items-center space-x-1.5"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="hidden sm:inline">Order</span>
                  </Link>
                )}

                <button
                  onClick={toggleMobileMenu}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                >
                  {isMobileMenuOpen ? (
                    <X className="w-6 h-6" />
                  ) : (
                    <Menu className="w-6 h-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-4 space-y-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
              {/* User Info - Mobile */}
              <div className="mb-4 p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-100 to-red-200 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user?.name || user?.email?.split("@")[0] || "User"}
                    </p>
                    <span
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-md ${userRole.color}`}
                    >
                      {userRole.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              {isChef() && !isAdminOrManager() && (
                <MobileNavLink
                  to="/kitchen"
                  icon={ChefHat}
                  label="Kitchen Display"
                  onClick={closeMobileMenu}
                />
              )}

              {isAdminOrManager() && (
                <>
                  <MobileNavLink
                    to="/dashboard"
                    icon={Home}
                    label="Dashboard"
                    onClick={closeMobileMenu}
                  />

                  <div className="pt-2 pb-1">
                    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Operations
                    </p>
                  </div>
                  <MobileNavLink
                    to="/menu"
                    icon={Menu}
                    label="Menu Management"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/inventory"
                    icon={Beaker}
                    label="Inventory"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/orders"
                    icon={Package}
                    label="Orders"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/kitchen"
                    icon={ChefHat}
                    label="Kitchen Display"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/delivery"
                    icon={Truck}
                    label="Delivery"
                    onClick={closeMobileMenu}
                  />

                  <div className="pt-3 pb-1">
                    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Analytics
                    </p>
                  </div>
                  <MobileNavLink
                    to="/reports"
                    icon={BarChart3}
                    label="Reports"
                    onClick={closeMobileMenu}
                  />
                  {isAdmin() && (
                    <MobileNavLink
                      to="/profit-analysis"
                      icon={DollarSign}
                      label="Profit Analysis"
                      onClick={closeMobileMenu}
                    />
                  )}

                  <div className="pt-3 pb-1">
                    <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Administration
                    </p>
                  </div>
                  <MobileNavLink
                    to="/users"
                    icon={Users}
                    label="User Management"
                    onClick={closeMobileMenu}
                  />
                </>
              )}

              {/* Actions */}
              <div className="pt-4 mt-2 border-t border-gray-200 space-y-1">
                <button
                  onClick={() => {
                    closeMobileMenu();
                    setShowShortcutsHelp(true);
                  }}
                  className="w-full px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center space-x-3"
                >
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Keyboard className="w-4 h-4 text-gray-500" />
                  </div>
                  <span>Keyboard Shortcuts</span>
                </button>

                <button
                  onClick={() => {
                    logout();
                    closeMobileMenu();
                  }}
                  className="w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center space-x-3"
                >
                  <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </div>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Keyboard Shortcuts Help Modal */}
      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
};

export default Navbar;
