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
  Keyboard,
  UserCircle,
  QrCode,
  Zap,
  Settings,
  PieChart,
  Plug,
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
  const [openDropdown, setOpenDropdown] = useState(null); // 'manage' | 'analytics' | 'admin'

  const userMenuRef = useRef(null);
  const manageRef = useRef(null);
  const analyticsRef = useRef(null);
  const adminRef = useRef(null);

  useNavigationShortcuts();

  useKeyboardShortcuts({
    "?": () => setShowShortcutsHelp(true),
    escape: () => {
      if (showShortcutsHelp) setShowShortcutsHelp(false);
      else if (isMobileMenuOpen) setIsMobileMenuOpen(false);
      else if (showUserMenu) setShowUserMenu(false);
      else if (openDropdown) setOpenDropdown(null);
    },
  });

  useEffect(() => {
    const handle = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target))
        setShowUserMenu(false);
      if (
        (!manageRef.current || !manageRef.current.contains(e.target)) &&
        (!analyticsRef.current || !analyticsRef.current.contains(e.target)) &&
        (!adminRef.current || !adminRef.current.contains(e.target))
      )
        setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const isActive = (path) => location.pathname === path;
  const isGroupActive = (paths) => paths.some((p) => location.pathname === p);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const getUserRole = () => {
    if (isAdmin())
      return { label: "Admin", color: "bg-brand-50 text-brand-700" };
    if (isManager())
      return { label: "Manager", color: "bg-blue-50 text-blue-700" };
    if (isChef()) return { label: "Chef", color: "bg-amber-50 text-amber-700" };
    return { label: "Staff", color: "bg-surface-100 text-ink-500" };
  };

  const getUserInitials = () => {
    const name = user?.name || user?.email?.split("@")[0] || "U";
    return name
      .split(" ")
      .map((p) => p[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const userRole = getUserRole();

  const NavLink = ({ to, icon: Icon, label }) => (
    <Link
      to={to}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 border ${
        isActive(to)
          ? "bg-red-50 text-red-500 border-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]"
          : "border-transparent text-ink-500 hover:text-ink-900 hover:bg-surface-100"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );

  const DropdownTrigger = ({ id, icon: Icon, label, paths }) => {
    const active = isGroupActive(paths);
    const open = openDropdown === id;
    return (
      <button
        onClick={() => setOpenDropdown(open ? null : id)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
          active || open
            ? "bg-brand-50 text-brand-600"
            : "text-ink-500 hover:text-ink-900 hover:bg-surface-100"
        }`}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span>{label}</span>
        <ChevronDown
          className={`w-3 h-3 ml-0.5 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
    );
  };

  const DropdownMenu = ({ id, items }) =>
    openDropdown !== id ? null : (
      <div
        className="absolute top-full mt-1.5 left-0 w-52 bg-white rounded-xl border border-black/[.07] py-1.5 z-50 animate-fade-up"
        style={{
          boxShadow: "0 8px 24px rgba(0,0,0,.10),0 1px 0 rgba(0,0,0,.04)",
        }}
      >
        {items.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setOpenDropdown(null)}
            className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              isActive(to)
                ? "text-brand-600 bg-brand-50/60"
                : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Icon
              className={`w-4 h-4 ${
                isActive(to) ? "text-brand-500" : "text-gray-400"
              }`}
            />
            {label}
          </Link>
        ))}
      </div>
    );

  const MobileNavLink = ({ to, icon: Icon, label, onClick }) => (
    <Link
      to={to}
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-sm font-medium rounded-xl transition-all flex items-center gap-3 ${
        isActive(to)
          ? "bg-brand-50 text-brand-700"
          : "text-ink-700 hover:bg-surface-100"
      }`}
    >
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isActive(to) ? "bg-brand-100" : "bg-surface-100"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${
            isActive(to) ? "text-brand-600" : "text-ink-400"
          }`}
        />
      </div>
      <span>{label}</span>
    </Link>
  );

  // Dropdown data
  const managePaths = ["/menu", "/inventory", "/delivery", "/integration"];
  const manageItems = [
    { to: "/menu", icon: Menu, label: "Menu Manager" },
    { to: "/inventory", icon: Beaker, label: "Inventory" },
    { to: "/delivery", icon: Truck, label: "Delivery" },
    { to: "/integration", icon: Plug, label: "Integrations" },
  ];

  const analyticsPaths = ["/reports", "/profit-analysis", "/eod-settings"];
  const analyticsItems = [
    { to: "/reports", icon: BarChart3, label: "Reports" },
    ...(isAdmin()
      ? [{ to: "/profit-analysis", icon: DollarSign, label: "Profit Analysis" }]
      : []),
    { to: "/eod-settings", icon: Zap, label: "EOD Report" },
  ];

  const adminPaths = ["/customers", "/users", "/qr-codes"];
  const adminItems = [
    { to: "/customers", icon: UserCircle, label: "Customers" },
    { to: "/users", icon: Users, label: "User Management" },
    { to: "/qr-codes", icon: QrCode, label: "QR Menu Codes" },
  ];

  return (
    <>
      <header
        className="bg-white/95 backdrop-blur-md border-b border-black/[.06] sticky top-0 z-50"
        style={{ boxShadow: "0 1px 0 rgba(0,0,0,.06)" }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div
            className="flex items-center justify-between"
            style={{ height: "60px" }}
          >
            {/* Logo */}
            <Link
              to="/dashboard"
              className="flex items-center gap-3 group shrink-0"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-all duration-200"
                style={{
                  background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  boxShadow: "0 2px 8px rgba(220,38,38,.28)",
                }}
              >
                <ShoppingCart className="w-[17px] h-[17px] text-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[15px] font-bold text-gray-900 leading-none tracking-tight">
                  EatSy
                </p>
                <p className="text-[10px] text-gray-400 font-medium tracking-widest uppercase mt-0.5">
                  POS System
                </p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {isChef() && !isAdminOrManager() && (
                <NavLink to="/kitchen" icon={ChefHat} label="Kitchen" />
              )}
              {isAdminOrManager() && (
                <>
                  <NavLink to="/dashboard" icon={Home} label="Dashboard" />
                  <NavLink to="/orders" icon={Package} label="Orders" />
                  <NavLink to="/kitchen" icon={ChefHat} label="Kitchen" />

                  {/* Manage dropdown */}
                  <div className="relative" ref={manageRef}>
                    <DropdownTrigger
                      id="manage"
                      icon={Settings}
                      label="Manage"
                      paths={managePaths}
                    />
                    <DropdownMenu id="manage" items={manageItems} />
                  </div>

                  {/* Analytics dropdown */}
                  <div className="relative" ref={analyticsRef}>
                    <DropdownTrigger
                      id="analytics"
                      icon={PieChart}
                      label="Analytics"
                      paths={analyticsPaths}
                    />
                    <DropdownMenu id="analytics" items={analyticsItems} />
                  </div>

                  {/* Admin dropdown */}
                  <div className="relative" ref={adminRef}>
                    <DropdownTrigger
                      id="admin"
                      icon={Users}
                      label="Admin"
                      paths={adminPaths}
                    />
                    <DropdownMenu id="admin" items={adminItems} />
                  </div>
                </>
              )}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-2">
              {isAdminOrManager() && (
                <Link
                  to="/billing"
                  className="hidden lg:inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-px"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 3px 10px rgba(220,38,38,.30)",
                    color: "#ffffff",
                  }}
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                  <span className="text-white">New Order</span>
                </Link>
              )}

              {/* User menu */}
              <div className="hidden lg:block relative" ref={userMenuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-gray-50 transition-all duration-150"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      boxShadow: "0 1px 4px rgba(220,38,38,.25)",
                    }}
                  >
                    <span className="text-white text-xs font-bold leading-none">
                      {getUserInitials()}
                    </span>
                  </div>
                  <div className="text-left hidden xl:block">
                    <p className="text-sm font-semibold text-gray-900 leading-none truncate max-w-[120px]">
                      {user?.name || user?.email?.split("@")[0] || "User"}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {userRole.label}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${
                      showUserMenu ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {showUserMenu && (
                  <div
                    className="absolute right-0 mt-2 w-60 bg-white rounded-2xl border border-black/[.07] py-1.5 animate-fade-up"
                    style={{
                      boxShadow:
                        "0 8px 32px rgba(0,0,0,.10),0 1px 0 rgba(0,0,0,.04)",
                    }}
                  >
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg,#ef4444,#dc2626)",
                          }}
                        >
                          <span className="text-white text-sm font-bold">
                            {getUserInitials()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {user?.name || "User"}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`inline-block mt-2.5 px-2 py-0.5 text-[11px] font-semibold rounded-md ${userRole.color}`}
                      >
                        {userRole.label}
                      </span>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowShortcutsHelp(true);
                        }}
                        className="w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                      >
                        <Keyboard className="w-4 h-4 text-gray-400" />
                        <span>Keyboard Shortcuts</span>
                        <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">
                          ?
                        </span>
                      </button>
                    </div>
                    <div className="pt-1 border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          logout();
                        }}
                        className="w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile */}
              <div className="flex lg:hidden items-center gap-2">
                {isAdminOrManager() && (
                  <Link
                    to="/billing"
                    onClick={closeMobileMenu}
                    className="flex items-center gap-1.5 px-3 py-2 text-white text-sm font-semibold rounded-lg"
                    style={{
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      boxShadow: "0 2px 6px rgba(220,38,38,.30)",
                    }}
                  >
                    <ShoppingCart className="w-4 h-4" />
                    <span className="hidden sm:inline">Order</span>
                  </Link>
                )}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-all"
                >
                  {isMobileMenuOpen ? (
                    <X className="w-5 h-5" />
                  ) : (
                    <Menu className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white">
            <div className="px-3 py-3 space-y-0.5 max-h-[calc(100vh-60px)] overflow-y-auto">
              <div className="mb-3 p-3 bg-gray-50 rounded-xl flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                  }}
                >
                  <span className="text-white text-sm font-bold">
                    {getUserInitials()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {user?.name || user?.email?.split("@")[0] || "User"}
                  </p>
                  <span
                    className={`inline-block px-2 py-0.5 text-[11px] font-semibold rounded-md ${userRole.color}`}
                  >
                    {userRole.label}
                  </span>
                </div>
              </div>

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

                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Manage
                  </p>
                  <MobileNavLink
                    to="/menu"
                    icon={Menu}
                    label="Menu Manager"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/inventory"
                    icon={Beaker}
                    label="Inventory"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/delivery"
                    icon={Truck}
                    label="Delivery"
                    onClick={closeMobileMenu}
                  />

                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Analytics
                  </p>
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
                  <MobileNavLink
                    to="/eod-settings"
                    icon={Zap}
                    label="EOD Report"
                    onClick={closeMobileMenu}
                  />

                  <p className="px-3 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                    Administration
                  </p>
                  <MobileNavLink
                    to="/customers"
                    icon={UserCircle}
                    label="Customers"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/users"
                    icon={Users}
                    label="User Management"
                    onClick={closeMobileMenu}
                  />
                  <MobileNavLink
                    to="/qr-codes"
                    icon={QrCode}
                    label="QR Menu Codes"
                    onClick={closeMobileMenu}
                  />
                </>
              )}

              <div className="pt-3 mt-2 border-t border-gray-100 space-y-0.5">
                <button
                  onClick={() => {
                    closeMobileMenu();
                    setShowShortcutsHelp(true);
                  }}
                  className="w-full px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Keyboard className="w-4 h-4 text-gray-400" />
                  </div>
                  <span>Keyboard Shortcuts</span>
                </button>
                <button
                  onClick={() => {
                    logout();
                    closeMobileMenu();
                  }}
                  className="w-full px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
                    <LogOut className="w-4 h-4 text-red-500" />
                  </div>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      <KeyboardShortcutsHelp
        isOpen={showShortcutsHelp}
        onClose={() => setShowShortcutsHelp(false)}
      />
    </>
  );
};

export default Navbar;
