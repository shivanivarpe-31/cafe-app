import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import config from "../config/businessConfig";
import {
  ShoppingCart,
  AlertCircle,
  UserPlus,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const isDevPrefill =
    process.env.NODE_ENV === "development" &&
    process.env.REACT_APP_PREFILL_DEMO === "true";

  const [form, setForm] = useState(() => ({
    email: isDevPrefill ? process.env.REACT_APP_DEMO_EMAIL || "" : "",
    password: isDevPrefill ? process.env.REACT_APP_DEMO_PASSWORD || "" : "",
  }));

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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const checkSetup = async () => {
      try {
        const res = await axios.get("/api/auth/setup-status");
        if (mounted) setNeedsSetup(res.data.needsSetup);
      } catch {
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
      await login(form.email.trim(), form.password);
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
        email: registerForm.email.trim(),
        password: registerForm.password,
        name: registerForm.name.trim(),
      });

      await login(registerForm.email.trim(), registerForm.password);
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

  const showDemoPanel = process.env.REACT_APP_SHOW_DEMO === "true";
  const demoEmail = process.env.REACT_APP_DEMO_EMAIL || "";
  const demoPassword = process.env.REACT_APP_DEMO_PASSWORD || "";

  // Reusable labeled input field
  const Field = ({
    label,
    icon: Icon,
    type = "text",
    value,
    onChange,
    placeholder,
    required,
    minLength,
    rightSlot,
  }) => (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
          <Icon className="w-4 h-4" />
        </span>
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          minLength={minLength}
          className="w-full pl-10 pr-10 py-3 text-sm bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-400 focus:bg-white transition-all duration-150"
        />
        {rightSlot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightSlot}
          </span>
        )}
      </div>
    </div>
  );

  if (checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg,#ef4444,#dc2626)",
              boxShadow: "0 4px 14px rgba(220,38,38,.30)",
            }}
          >
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-red-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between p-10 relative overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, #ef4444 0%, #dc2626 40%, #b91c1c 100%)",
        }}
      >
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-white/[.06] pointer-events-none" />
        <div className="absolute top-1/2 -right-32 w-96 h-96 rounded-full bg-white/[.04] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-black/[.06] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-xl leading-none">EatSy</p>
              <p className="text-red-200 text-xs font-medium tracking-widest uppercase mt-0.5">
                POS System
              </p>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white/80 text-xs font-medium">
              Live dashboard
            </span>
          </div>
          <h2 className="text-white text-4xl font-bold leading-tight mb-4">
            Run your restaurant
            <br />
            with confidence.
          </h2>
          <p className="text-red-100 text-base leading-relaxed max-w-xs">
            Tables, orders, billing, delivery — everything in one beautiful
            dashboard built for speed.
          </p>

          {/* Feature pills */}
          <div className="mt-8 flex flex-wrap gap-2">
            {[
              "Real-time orders",
              "Smart billing",
              "Kitchen display",
              "Analytics",
            ].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white/90 border border-white/20"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-red-200/70 text-xs">
          © 2026 {config.restaurant.name}. All rights reserved.
        </p>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-[400px] animate-fade-up">
          {needsSetup ? (
            /* ── Initial Setup Form ── */
            <div
              className="bg-white rounded-2xl border border-black/[.07] p-8"
              style={{
                boxShadow:
                  "0 4px 24px rgba(0,0,0,.08), 0 1px 0 rgba(0,0,0,.04)",
              }}
            >
              <div className="mb-7">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 3px 10px rgba(220,38,38,.28)",
                  }}
                >
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Initial Setup
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Create your admin account to get started.
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                <Field
                  label="Full Name"
                  icon={User}
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, name: e.target.value })
                  }
                  placeholder="Jane Smith"
                  required
                />
                <Field
                  label="Email"
                  icon={Mail}
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm({ ...registerForm, email: e.target.value })
                  }
                  placeholder="jane@restaurant.com"
                  required
                />
                <Field
                  label="Password"
                  icon={Lock}
                  type={showPassword ? "text" : "password"}
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      password: e.target.value,
                    })
                  }
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                />
                <Field
                  label="Confirm Password"
                  icon={Lock}
                  type={showConfirmPassword ? "text" : "password"}
                  value={registerForm.confirmPassword}
                  onChange={(e) =>
                    setRegisterForm({
                      ...registerForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Repeat password"
                  required
                  minLength={8}
                  rightSlot={
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  }
                />

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl animate-fade-up">
                    <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
                  style={{
                    background: "linear-gradient(135deg,#ef4444,#dc2626)",
                    boxShadow: "0 3px 12px rgba(220,38,38,.30)",
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Creating
                      account…
                    </>
                  ) : (
                    "Create Admin Account"
                  )}
                </button>
              </form>
            </div>
          ) : (
            /* ── Sign In Form ── */
            <>
              <div
                className="bg-white rounded-2xl border border-black/[.07] p-8"
                style={{
                  boxShadow:
                    "0 4px 24px rgba(0,0,0,.08), 0 1px 0 rgba(0,0,0,.04)",
                }}
              >
                {/* Header */}
                <div className="mb-7">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      boxShadow: "0 3px 10px rgba(220,38,38,.28)",
                    }}
                  >
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    Welcome back
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Sign in to your restaurant dashboard.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Field
                    label="Email"
                    icon={Mail}
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    placeholder="you@restaurant.com"
                    required
                  />
                  <Field
                    label="Password"
                    icon={Lock}
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                    placeholder="Your password"
                    required
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    }
                  />

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl animate-fade-up">
                      <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 hover:-translate-y-px disabled:opacity-60 disabled:pointer-events-none mt-2"
                    style={{
                      background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      boxShadow: "0 3px 12px rgba(220,38,38,.30)",
                    }}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Signing in…
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>
              </div>

              {showDemoPanel && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-900 mb-2">
                    Demo Credentials
                  </p>
                  <p className="text-xs text-blue-700">
                    Email: {demoEmail || "<set REACT_APP_DEMO_EMAIL>"}
                  </p>
                  <p className="text-xs text-blue-700">
                    Password:{" "}
                    {demoPassword
                      ? "••••••••"
                      : "<set REACT_APP_DEMO_PASSWORD>"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
