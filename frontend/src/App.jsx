import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Sparkles } from "lucide-react";

import AppLayout from "./components/AppLayout";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Analytics from "./pages/Analytics";
import Conversations from "./pages/Conversations";
import Customers from "./pages/Customers";
import Dashboard from "./pages/Dashboard";
import ForgotPassword from "./pages/ForgotPassword";
import Login from "./pages/Login";
import Orders from "./pages/Orders";
import Products from "./pages/Products";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";

function Splash() {
  return (
    <div className="splash">
      <span className="brand-mark brand-mark--lg">
        <Sparkles size={26} />
      </span>
      <strong>BizAssist AI</strong>
      <span className="splash__bar"><i /></span>
      <p>Preparing your workspace…</p>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}

function OwnerRoute() {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.role !== "owner") return <Navigate to="/dashboard" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/products" element={<Products />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route element={<OwnerRoute />}>
                  <Route path="/settings" element={<Navigate to="/settings/ai" replace />} />
                  <Route path="/settings/ai" element={<Settings />} />
                  <Route path="/settings/whatsapp" element={<Settings />} />
                  <Route path="/settings/team" element={<Settings />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
