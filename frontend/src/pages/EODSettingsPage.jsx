import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Mail,
  Clock,
  Save,
  Send,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  X,
  Loader2,
  Wifi,
  Smartphone,
  Zap,
  ChevronRight,
  TrendingUp,
  ShoppingCart,
  Package,
  AlertCircle,
} from "lucide-react";
import Navbar from "../components/navbar";
import { showSuccess, showError, showWarning } from "../utils/toast";

/* ================================================================ */

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 ${
      checked ? "bg-red-500" : "bg-gray-200"
    } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
  >
    <span
      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform duration-200 ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

const Pill = ({ children, onRemove }) => (
  <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 bg-red-50 text-red-700 text-sm rounded-lg font-medium border border-red-100">
    {children}
    <button
      onClick={onRemove}
      className="hover:bg-red-100 rounded-md p-0.5 transition-colors"
    >
      <X className="w-3 h-3" />
    </button>
  </span>
);

const TagInput = ({ values, onAdd, onRemove, placeholder, type = "email" }) => {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      showWarning("Enter a valid email address");
      return;
    }
    if (type === "tel" && !/^\+\d{8,15}$/.test(v)) {
      showWarning("Use international format, e.g. +919876543210");
      return;
    }
    onAdd(v);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <Pill key={v} onRemove={() => onRemove(v)}>
              {v}
            </Pill>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type={type === "email" ? "email" : "tel"}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (["Enter", ",", " "].includes(e.key)) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Backspace" && draft === "" && values.length > 0)
              onRemove(values[values.length - 1]);
          }}
          onBlur={commit}
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all"
        />
        <button
          type="button"
          onClick={commit}
          className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-xl transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm">
    <div
      className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">
        {label}
      </p>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
    </div>
  </div>
);

/* ================================================================ */
const EODSettingsPage = () => {
  const [cfg, setCfg] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpOk, setSmtpOk] = useState(null);
  const [testingTwilio, setTestingTwilio] = useState(false);
  const [twilioOk, setTwilioOk] = useState(null);
  const [previewTab, setPreviewTab] = useState("whatsapp");

  /* Load config */
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get("/api/eod/settings");
        setCfg(res.data);
      } catch {
        showError("Failed to load EOD settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* Load preview */
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await axios.get("/api/eod/preview");
      const d = res.data;
      setPreview({
        data: d.data,
        whatsapp: d.whatsapp || d.message?.text || "",
        emailHtml: d.emailHtml || d.message?.html || "",
      });
    } catch {
      showError("Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  /* Save */
  const saveSettings = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await axios.put("/api/eod/settings", {
        sendTime: cfg.sendTime,
        enabled: cfg.enabled,
        emailEnabled: cfg.emailEnabled,
        emailTo: cfg.emailTo,
        whatsappEnabled: cfg.whatsappEnabled,
        whatsappTo: cfg.whatsappTo,
      });
      setCfg(res.data);
      showSuccess("Settings saved!");
    } catch (err) {
      showError(err.response?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  /* Send now */
  const sendNow = async () => {
    if (!cfg) return;
    const hasEmail = cfg.emailEnabled && cfg.emailTo?.length > 0;
    const hasWa = cfg.whatsappEnabled && cfg.whatsappTo?.length > 0;
    if (!hasEmail && !hasWa) {
      showWarning("Enable at least one channel with recipients first.");
      return;
    }
    setSending(true);
    try {
      const res = await axios.post("/api/eod/send");
      const { results } = res.data;
      const ok = [];
      if (results.email) ok.push("Email sent");
      if (results.whatsapp) ok.push("WhatsApp sent");
      results.errors?.forEach((e) => showError(`${e.channel}: ${e.error}`));
      if (ok.length) showSuccess(ok.join(" · "));
    } catch (err) {
      showError(err.response?.data?.error || "Send failed");
    } finally {
      setSending(false);
    }
  };

  /* Test SMTP */
  const testSmtp = async () => {
    setTestingSmtp(true);
    setSmtpOk(null);
    try {
      await axios.post("/api/eod/test-smtp");
      setSmtpOk(true);
      showSuccess("SMTP verified!");
    } catch (err) {
      setSmtpOk(false);
      showError(err.response?.data?.error || "SMTP test failed");
    } finally {
      setTestingSmtp(false);
    }
  };

  /* Test Twilio WhatsApp */
  const testTwilio = async () => {
    setTestingTwilio(true);
    setTwilioOk(null);
    try {
      await axios.post("/api/eod/test-whatsapp");
      setTwilioOk(true);
      showSuccess("Twilio WhatsApp verified!");
    } catch (err) {
      setTwilioOk(false);
      showError(err.response?.data?.error || "Twilio test failed");
    } finally {
      setTestingTwilio(false);
    }
  };

  const patch = (p) => setCfg((prev) => ({ ...prev, ...p }));
  const canSend =
    (cfg?.emailEnabled && cfg?.emailTo?.length > 0) ||
    (cfg?.whatsappEnabled && cfg?.whatsappTo?.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center py-32">
          <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                boxShadow: "0 3px 10px rgba(220,38,38,.28)",
              }}
            >
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                End-of-Day Report
              </h1>
              <p className="text-sm text-gray-500">
                Daily summary sent automatically to your email &amp; WhatsApp.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadPreview}
              disabled={previewLoading}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 shadow-sm transition-all disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${
                  previewLoading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </button>
            <button
              onClick={sendNow}
              disabled={sending || !canSend}
              className="inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 hover:-translate-y-px"
              style={{
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                boxShadow: "0 3px 10px rgba(220,38,38,.25)",
              }}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? "Sending…" : "Send Now"}
            </button>
          </div>
        </div>

        {/* Stat cards */}
        {preview?.data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={TrendingUp}
              label="Revenue"
              value={`${preview.data.currency || "₹"}${Number(
                preview.data.totalRevenue,
              ).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={ShoppingCart}
              label="Paid Orders"
              value={preview.data.paidOrders}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Package}
              label="Items Sold"
              value={preview.data.totalItemsSold}
              color="bg-purple-50 text-purple-600"
            />
            <StatCard
              icon={AlertCircle}
              label="Low Stock"
              value={preview.data.lowStockIngredients?.length ?? 0}
              color={
                preview.data.lowStockIngredients?.length > 0
                  ? "bg-orange-50 text-orange-600"
                  : "bg-gray-50 text-gray-400"
              }
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT — Settings */}
          <div className="lg:col-span-5 space-y-4">
            {/* Schedule */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Clock className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Auto-Send Schedule
                    </p>
                    <p className="text-xs text-gray-400">
                      Report fires daily at this time
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={cfg?.enabled ?? false}
                  onChange={(v) => patch({ enabled: v })}
                />
              </div>
              {cfg?.enabled && (
                <div className="px-5 pb-4 pt-1 border-t border-gray-50">
                  <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Send Time (24h)
                  </label>
                  <input
                    type="time"
                    value={cfg?.sendTime ?? "22:00"}
                    onChange={(e) => patch({ sendTime: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all"
                  />
                </div>
              )}
              <div
                className={`px-5 py-3 flex items-center gap-2 text-xs font-medium ${
                  cfg?.enabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-gray-50 text-gray-400"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    cfg?.enabled
                      ? "bg-emerald-400 animate-pulse"
                      : "bg-gray-300"
                  }`}
                />
                {cfg?.enabled
                  ? `Active — sends daily at ${cfg.sendTime}`
                  : "Scheduler is off"}
              </div>
            </section>

            {/* Email */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <Mail className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Email</p>
                    <p className="text-xs text-gray-400">
                      {cfg?.smtpConfigured
                        ? "SMTP connected"
                        : "SMTP not configured — add to .env"}
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={cfg?.emailEnabled ?? false}
                  onChange={(v) => patch({ emailEnabled: v })}
                />
              </div>
              {cfg?.emailEnabled && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-50 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Recipients
                    </label>
                    <TagInput
                      values={cfg?.emailTo ?? []}
                      onAdd={(v) =>
                        patch({ emailTo: [...(cfg?.emailTo ?? []), v] })
                      }
                      onRemove={(v) =>
                        patch({
                          emailTo: (cfg?.emailTo ?? []).filter((e) => e !== v),
                        })
                      }
                      placeholder="owner@gmail.com"
                      type="email"
                    />
                  </div>
                  {cfg?.smtpConfigured && (
                    <button
                      onClick={testSmtp}
                      disabled={testingSmtp}
                      className="inline-flex items-center gap-2 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors disabled:opacity-50"
                    >
                      {testingSmtp ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : smtpOk === true ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      ) : smtpOk === false ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      {testingSmtp
                        ? "Verifying…"
                        : smtpOk === true
                        ? "SMTP verified"
                        : smtpOk === false
                        ? "Test failed — retry?"
                        : "Test SMTP connection"}
                    </button>
                  )}
                  {!cfg?.smtpConfigured && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
                      <strong>Setup:</strong> Add these to your backend{" "}
                      <code className="bg-amber-100 px-1 rounded font-mono">
                        .env
                      </code>{" "}
                      file:
                      <pre className="mt-2 bg-gray-900 text-green-300 rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed">
                        {`EOD_SMTP_HOST=smtp.gmail.com
EOD_SMTP_PORT=587
EOD_SMTP_USER=your@gmail.com
EOD_SMTP_PASS=xxxx-xxxx-xxxx-xxxx
EOD_SMTP_FROM="Cafe POS <your@gmail.com>"`}
                      </pre>
                      <p className="mt-1.5 text-amber-600">
                        Gmail tip: Enable 2FA → App Passwords → generate one for
                        "Mail".
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* WhatsApp */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      WhatsApp
                    </p>
                    <p className="text-xs text-gray-400">
                      {cfg?.twilioConfigured
                        ? "Twilio connected"
                        : "Twilio not configured — add to .env"}
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={cfg?.whatsappEnabled ?? false}
                  onChange={(v) => patch({ whatsappEnabled: v })}
                />
              </div>
              {cfg?.whatsappEnabled && (
                <div className="px-5 pb-5 pt-1 border-t border-gray-50 space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Phone Numbers
                    </label>
                    <TagInput
                      values={cfg?.whatsappTo ?? []}
                      onAdd={(v) =>
                        patch({ whatsappTo: [...(cfg?.whatsappTo ?? []), v] })
                      }
                      onRemove={(v) =>
                        patch({
                          whatsappTo: (cfg?.whatsappTo ?? []).filter(
                            (n) => n !== v,
                          ),
                        })
                      }
                      placeholder="+919876543210"
                      type="tel"
                    />
                  </div>
                  {cfg?.twilioConfigured && (
                    <button
                      onClick={testTwilio}
                      disabled={testingTwilio}
                      className="inline-flex items-center gap-2 text-xs font-medium text-green-600 hover:text-green-700 transition-colors disabled:opacity-50"
                    >
                      {testingTwilio ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : twilioOk === true ? (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                      ) : twilioOk === false ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      {testingTwilio
                        ? "Verifying…"
                        : twilioOk === true
                        ? "Twilio verified"
                        : twilioOk === false
                        ? "Test failed — retry?"
                        : "Test Twilio connection"}
                    </button>
                  )}
                  {!cfg?.twilioConfigured && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700 leading-relaxed">
                      <strong>Setup:</strong> Add Twilio credentials to{" "}
                      <code className="bg-amber-100 px-1 rounded font-mono">
                        .env
                      </code>
                      :
                      <pre className="mt-2 bg-gray-900 text-green-300 rounded-lg p-2.5 overflow-x-auto text-[11px] leading-relaxed">
                        {`EOD_TWILIO_ACCOUNT_SID=ACxxxxxxxx
EOD_TWILIO_AUTH_TOKEN=your_token
EOD_TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`}
                      </pre>
                      <p className="mt-1.5 text-amber-600">
                        Free sandbox:{" "}
                        <a
                          href="https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn"
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          Twilio Console → WhatsApp Sandbox
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Save */}
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full py-3 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all hover:-translate-y-px disabled:opacity-60"
              style={{
                background: "linear-gradient(135deg,#ef4444,#dc2626)",
                boxShadow: "0 3px 12px rgba(220,38,38,.28)",
              }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>

          {/* RIGHT — Preview */}
          <div className="lg:col-span-7 space-y-4">
            {/* Preview panel */}
            <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-gray-400" />
                  Today's Report Preview
                </p>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  {[
                    {
                      id: "whatsapp",
                      icon: Smartphone,
                      label: "WhatsApp",
                      ac: "text-green-700",
                    },
                    {
                      id: "email",
                      icon: Mail,
                      label: "Email",
                      ac: "text-blue-700",
                    },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setPreviewTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        previewTab === tab.id
                          ? `bg-white ${tab.ac} shadow-sm`
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      <tab.icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5">
                {previewLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                  </div>
                ) : previewTab === "whatsapp" ? (
                  <div className="bg-[#ece5dd] rounded-2xl p-4 max-h-[500px] overflow-y-auto">
                    <div className="bg-white rounded-xl p-4 shadow-sm font-mono text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                      {preview?.whatsapp || (
                        <span className="text-gray-400 italic">
                          Preview appears here once data loads.
                        </span>
                      )}
                    </div>
                  </div>
                ) : preview?.emailHtml ? (
                  <iframe
                    title="Email Preview"
                    className="w-full rounded-xl border border-gray-200"
                    style={{ height: 500 }}
                    sandbox="allow-same-origin"
                    srcDoc={preview.emailHtml}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
                    Email preview will appear here
                  </div>
                )}
              </div>
            </section>

            {/* Low stock */}
            {preview?.data?.lowStockIngredients?.length > 0 && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
                <p className="text-xs font-bold text-orange-700 flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Low Stock Alert ({
                    preview.data.lowStockIngredients.length
                  }{" "}
                  items)
                </p>
                <div className="flex flex-wrap gap-2">
                  {preview.data.lowStockIngredients.map((s) => (
                    <span
                      key={s.name}
                      className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs rounded-lg font-medium"
                    >
                      {s.name}: {Number(s.currentStock).toFixed(1)} {s.unit}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Active channels summary */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Active Channels
              </p>
              <div className="space-y-2">
                {cfg?.emailEnabled && cfg?.emailTo?.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-700 font-medium">Email</span>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    <span className="text-gray-500 truncate">
                      {cfg.emailTo.join(", ")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Mail className="w-4 h-4" />
                    <span>Email — not active</span>
                  </div>
                )}
                {cfg?.whatsappEnabled && cfg?.whatsappTo?.length > 0 ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Smartphone className="w-4 h-4 text-green-500" />
                    <span className="text-gray-700 font-medium">WhatsApp</span>
                    <ChevronRight className="w-3 h-3 text-gray-300" />
                    <span className="text-gray-500 truncate">
                      {cfg.whatsappTo.join(", ")}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <Smartphone className="w-4 h-4" />
                    <span>WhatsApp — not active</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EODSettingsPage;
