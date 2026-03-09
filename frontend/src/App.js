import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IntegrationProvider } from './context/IntegrationContext';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { MenuProvider } from './context/MenuContext';
import IntegrationSettings from './pages/IntegrationSettings';
import PlatformOrders from './components/PlatformOrders';
import MenuPage from './pages/MenuPage';
import BillingPage from './pages/BillingPage';
import ReportsPage from './pages/ReportsPage';
import OrdersPage from "./pages/OrdersPage";
import InventoryPage from "./pages/InventoryPage";
import ProfitAnalysisPage from "./pages/ProfitAnalysisPage";
import DeliveryPage from "./pages/DeliveryPage";
import PendingPaymentsPage from "./pages/PendingPaymentsPage";
import KitchenDisplay from "./pages/KitchenDisplay";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import UserManagementPage from "./pages/UserManagementPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerMenuPage from "./pages/CustomerMenuPage";
import TableQRPage from "./pages/TableQRPage";
import EODSettingsPage from "./pages/EODSettingsPage";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-800">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  // If allowedRoles is specified, check if user has one of the allowed roles
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" />;
  }

  return children;
};

function AppContent() {
  const { isChef } = useAuth();

  // Redirect Chef users to kitchen display by default
  const DefaultRedirect = () => {
    if (isChef()) {
      return <Navigate to="/kitchen" />;
    }
    return <Navigate to="/dashboard" />;
  };

  return (
    <Router>
      <IntegrationProvider>
        <MenuProvider>
          <Toaster />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Dashboard - Admin and Manager only */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <Dashboard />
              </ProtectedRoute>
            } />

            {/* Menu Management - Admin and Manager only */}
            <Route path="/menu" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <MenuPage />
              </ProtectedRoute>
            } />

            {/* Billing - Admin and Manager only */}
            <Route path="/billing" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <BillingPage />
              </ProtectedRoute>
            } />

            {/* Orders - Admin and Manager only */}
            <Route path="/orders" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <OrdersPage />
              </ProtectedRoute>
            } />

            {/* Inventory - Admin and Manager only */}
            <Route path="/inventory" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <InventoryPage />
              </ProtectedRoute>
            } />

            {/* Reports - Admin and Manager only */}
            <Route path="/reports" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <ReportsPage />
              </ProtectedRoute>
            } />

            {/* Profit Analysis - Admin only */}
            <Route path="/profit-analysis" element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <ProfitAnalysisPage />
              </ProtectedRoute>
            } />

            {/* Integration Settings - Admin and Manager only */}
            <Route path="/integration" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <IntegrationSettings />
              </ProtectedRoute>
            } />

            {/* Platform Orders - Admin and Manager only */}
            <Route path="/platform-orders" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <PlatformOrders />
              </ProtectedRoute>
            } />

            {/* Delivery - Admin and Manager only */}
            <Route path="/delivery" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <DeliveryPage />
              </ProtectedRoute>
            } />

            {/* Pending Payments - Admin and Manager only */}
            <Route path="/pending-payments" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <PendingPaymentsPage />
              </ProtectedRoute>
            } />

            {/* Customer Management - Admin and Manager only */}
            <Route path="/customers" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <CustomersPage />
              </ProtectedRoute>
            } />

            {/* User Management - Admin and Manager only */}
            <Route path="/users" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <UserManagementPage />
              </ProtectedRoute>
            } />

            {/* Kitchen Display - All roles (Admin, Manager, Chef) */}
            <Route path="/kitchen" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER', 'CHEF']}>
                <KitchenDisplay />
              </ProtectedRoute>
            } />

            {/* Table QR Codes - Admin and Manager */}
            <Route path="/qr-codes" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <TableQRPage />
              </ProtectedRoute>
            } />

            {/* Public digital menu — no auth (customer QR scan) */}
            <Route path="/menu/:tableId" element={<CustomerMenuPage />} />

            {/* End-of-Day Report settings — Admin and Manager */}
            <Route path="/eod-settings" element={
              <ProtectedRoute allowedRoles={['ADMIN', 'MANAGER']}>
                <EODSettingsPage />
              </ProtectedRoute>
            } />

            {/* Default route - redirect based on role */}
            <Route path="/" element={
              <ProtectedRoute>
                <DefaultRedirect />
              </ProtectedRoute>
            } />
          </Routes>
        </MenuProvider>
      </IntegrationProvider>
    </Router>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;



