import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import config from "../config/businessConfig";
import {
  LogIn,
  ShoppingCart,
  Mail,
  Lock,
  AlertCircle,
  User,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  // Prefill only when explicitly enabled (dev + opt-in)
  const isDevPrefill =
    process.env.NODE_ENV === "development" &&
    process.env.REACT_APP_PREFILL_DEMO === "true";

  const initialForm = {
    email: isDevPrefill ? process.env.REACT_APP_DEMO_EMAIL || "" : "",
    password: isDevPrefill ? process.env.REACT_APP_DEMO_PASSWORD || "" : "",
  };

  const [form, setForm] = useState(initialForm);
  const [registerForm, setRegisterForm] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Check if this is a fresh install (no users exist)
  useEffect(() => {
    let mounted = true;
    const checkSetup = async () => {
      try {
        const res = await axios.get("/api/auth/setup-status");
        if (mounted) setNeedsSetup(res.data.needsSetup);
      } catch {
        // If check fails, default to login mode
        if (mounted) setNeedsSetup(false);
      } finally {
        if (mounted) setCheckingSetup(false);
      }
    };
    checkSetup();
    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (registerForm.password !== registerForm.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (registerForm.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);
    try {
      await axios.post("/api/auth/register", {
        email: registerForm.email,
        password: registerForm.password,
        name: registerForm.name,
      });
      // Auto-login after successful registration using AuthContext's login()
      // This properly sets user state, stores token, and schedules token refresh
      await login(registerForm.email, registerForm.password);
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Registration failed",
      );
    } finally {
      setLoading(false);
    }
  };

  // Show demo panel only when explicitly enabled
  const showDemoPanel = process.env.REACT_APP_SHOW_DEMO === "true";
  const demoEmail = process.env.REACT_APP_DEMO_EMAIL || "";
  const demoPassword = process.env.REACT_APP_DEMO_PASSWORD || "";

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-6">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <ShoppingCart className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {config.restaurant.name}
          </h1>
          <p className="text-sm text-gray-500">Restaurant Management System</p>
        </div>

        {/* Setup / Register Card (only shown on fresh install) */}
        {needsSetup ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
            <div className="flex items-center space-x-2 mb-2">
              <UserPlus className="w-5 h-5 text-red-600" />
              <h2 className="text-xl font-bold text-gray-900">Initial Setup</h2>
            </div>
            <p className="text-sm text-gray-500 mb-6">
              Create your admin account to get started. This can only be done
              once.
            </p>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm({ ...registerForm, name: e.target.value })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    placeholder="admin@yourrestaurant.com"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        email: e.target.value,
                      })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Min. 8 characters"
                    value={registerForm.password}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        password: e.target.value,
                      })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="password"
                    placeholder="Re-enter password"
                    value={registerForm.confirmPassword}
                    onChange={(e) =>
                      setRegisterForm({
                        ...registerForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                </div>
              )}

              {/* Register Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Create Admin Account</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Login Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Sign In</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Enter E-mail"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      placeholder="Enter Password"
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 text-white py-3 px-4 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-5 h-5" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Demo Credentials (only when explicitly enabled) */}
            {showDemoPanel && (
              <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-semibold text-blue-900 mb-2">
                  Demo Credentials:
                </p>
                <div className="text-xs text-blue-700 space-y-1">
                  <p>
                    <span className="font-medium">Email:</span>{" "}
                    {demoEmail || "<set REACT_APP_DEMO_EMAIL>"}
                  </p>
                  <p>
                    <span className="font-medium">Password:</span>{" "}
                    {demoPassword
                      ? "••••••••"
                      : "<set REACT_APP_DEMO_PASSWORD>"}
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-500 mt-8">
          © 2026 {config.restaurant.name}. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
