import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import axios from "axios";
import Navbar from "../components/navbar";
import { showError, showSuccess } from "../utils/toast";
import {
  Users,
  Search,
  X,
  Phone,
  Mail,
  ShoppingBag,
  TrendingUp,
  Calendar,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Package,
  IndianRupee,
  UserCheck,
  Loader2,
  Radio,
  ArrowUpDown,
  Eye,
  Zap,
  Filter,
  SkipForward,
} from "lucide-react";

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n) =>
  Number(n).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const fmtDateShort = (d) =>
  new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const statusColor = (status) => {
  const map = {
    PENDING: "bg-yellow-100 text-yellow-700",
    CONFIRMED: "bg-blue-100 text-blue-700",
    PREPARING: "bg-orange-100 text-orange-700",
    READY: "bg-purple-100 text-purple-700",
    DELIVERED: "bg-green-100 text-green-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    PAID: "bg-emerald-100 text-emerald-700",
    PARTIALLY_PAID: "bg-amber-100 text-amber-700",
  };
  return map[status] || "bg-gray-100 text-gray-600";
};

const statusIcon = (status) => {
  if (["COMPLETED", "DELIVERED", "PAID"].includes(status))
    return <CheckCircle className="w-3 h-3" />;
  if (status === "CANCELLED") return <XCircle className="w-3 h-3" />;
  if (["PREPARING", "CONFIRMED"].includes(status))
    return <RefreshCw className="w-3 h-3 animate-spin" />;
  return <Clock className="w-3 h-3" />;
};

/* open WhatsApp directly — improved validation */
const openDirectWA = (customer, msg) => {
  if (!customer?.phone) {
    showError("Customer phone number missing");
    return;
  }

  let phone = customer.phone.replace(/\D/g, "");

  // Auto-prefix India country code if needed
  if (phone.length === 10) {
    phone = `91${phone}`;
  }

  if (phone.length !== 12) {
    showError("Invalid phone number");
    return;
  }

  const text =
    msg ||
    `Hi ${customer.name}! 🎉 We have an exciting offer just for you at our cafe. Visit us and enjoy a special discount on your next order! We look forward to seeing you soon. 😊`;

  window.open(
    `https://wa.me/${phone}?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer",
  );
};

/* ─── WhatsApp message modal ─────────────────────────────────── */
const WhatsAppModal = ({ customer, onClose }) => {
  const [message, setMessage] = useState(
    `Hi ${customer.name}! 🎉 We have an exciting offer just for you at our cafe. Visit us and enjoy a special discount on your next order! We look forward to seeing you soon. 😊`,
  );
  const [template, setTemplate] = useState("offer");

  const templates = {
    offer: `Hi ${customer.name}! 🎉 We have an exciting offer just for you at our cafe. Visit us and enjoy a special discount on your next order! We look forward to seeing you soon. 😊`,
    loyalty: `Hi ${customer.name}! 🌟 Thank you for being a loyal customer! You've visited us ${customer.visitCount} times and you're truly valued. Come visit us again and enjoy a complimentary treat! ☕`,
    feedback: `Hi ${customer.name}! 😊 Thank you for dining with us! We'd love to hear about your experience. Your feedback helps us serve you better. Hope to see you again soon! 🙏`,
    event: `Hi ${customer.name}! 🎊 We're hosting a special event at our cafe! Join us for an amazing experience with great food, drinks & fun. Details inside — don't miss out! See you there! 🥳`,
    custom: message,
  };

  const handleTemplateChange = (key) => {
    setTemplate(key);
    if (key !== "custom") setMessage(templates[key]);
  };

  const handleSend = () => {
    if (!message.trim()) {
      showError("Message cannot be empty");
      return;
    }

    openDirectWA(customer, message);

    showSuccess(`Opening WhatsApp for ${customer.name}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-up">
        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Send WhatsApp Message
              </h3>
              <p className="text-xs text-gray-400">
                To: {customer.name} ({customer.phone})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* template selector */}
        <div className="p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Quick Templates
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "offer", label: "🎉 Offer" },
                { key: "loyalty", label: "🌟 Loyalty" },
                { key: "feedback", label: "😊 Feedback" },
                { key: "event", label: "🎊 Event" },
                { key: "custom", label: "✏️ Custom" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => handleTemplateChange(key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    template === key
                      ? "bg-green-600 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Message
            </p>
            <textarea
              rows={6}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                setTemplate("custom");
              }}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-700 leading-relaxed"
              placeholder="Type your message here..."
            />
            <p className="text-right text-xs text-gray-400 mt-1">
              {message.length} chars
            </p>
          </div>

          <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
            <MessageCircle className="w-4 h-4 text-green-600 shrink-0" />
            <p className="text-xs text-green-700">
              This will open WhatsApp Web / App with the message pre-filled.
              You'll need to press Send there.
            </p>
          </div>
        </div>

        {/* footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
          >
            <Send className="w-4 h-4" />
            Open WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Bulk WhatsApp broadcast modal ─────────────────────────── */
const SEGMENTS = [
  { key: "all", label: "All", icon: "👥" },
  { key: "frequent", label: "Frequent (5+ orders)", icon: "🔥" },
  { key: "highspend", label: "High Spenders", icon: "💎" },
  { key: "new", label: "New (≤1 order)", icon: "🌱" },
  { key: "inactive", label: "No Orders", icon: "💤" },
];

const SORT_OPTIONS = [
  { key: "name", label: "Name" },
  { key: "orders", label: "Orders" },
  { key: "spend", label: "Spend" },
];

const TEMPLATES = {
  offer: `Hi {name}! 🎉 We have an exciting offer just for you at our cafe. Visit us and enjoy a special discount on your next order! We look forward to seeing you soon. 😊`,
  loyalty: `Hi {name}! 🌟 Thank you for being a loyal customer with {orders} visits! You are truly valued at our cafe. Come visit us again and enjoy a complimentary treat! ☕`,
  feedback: `Hi {name}! 😊 Thank you for dining with us! We'd love to hear about your experience. Your feedback helps us serve you better. Hope to see you again soon! 🙏`,
  event: `Hi {name}! 🎊 We're hosting a special event at our cafe! Join us for an amazing experience with great food, drinks & fun. See you there! 🥳`,
  custom: "",
};

const STATUS_STYLES = {
  sent: "text-green-600 bg-green-50",
  skipped: "text-gray-400 bg-gray-50",
  current: "text-blue-700 bg-blue-50 ring-1 ring-blue-200",
  pending: "text-gray-500 bg-white",
};

const BulkWhatsAppModal = ({ onClose }) => {
  const [step, setStep] = useState("compose"); // 'compose' | 'select' | 'send'
  const [templateKey, setTemplateKey] = useState("offer");
  const [message, setMessage] = useState(TEMPLATES.offer);
  const [previewCustomer, setPreviewCustomer] = useState(null);
  const [allCustomers, setAllCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [recipientSearch, setRecipientSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sendIndex, setSendIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [statusMap, setStatusMap] = useState({}); // id → 'sent'|'skipped'|'pending'
  const [done, setDone] = useState(false);
  const queueRef = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingCustomers(true);
      try {
        const res = await axios.get("/api/customers", {
          params: { page: 1, limit: 1000 },
        });
        const data = res.data.data || [];
        setAllCustomers(data);
        setSelectedIds(new Set(data.map((c) => c.id)));
        if (data.length > 0) setPreviewCustomer(data[0]);
      } catch {
        showError("Failed to load customers");
      } finally {
        setLoadingCustomers(false);
      }
    };
    fetchAll();
  }, []);

  /* ── segment helpers ── */
  const spendThreshold = useMemo(() => {
    if (!allCustomers.length) return 0;
    const sorted = [...allCustomers].sort(
      (a, b) => Number(b.totalSpent || 0) - Number(a.totalSpent || 0),
    );
    const top20 = sorted[Math.floor(sorted.length * 0.2)] || sorted[0];
    return Number(top20.totalSpent || 0);
  }, [allCustomers]);

  const segmentFilter = (c) => {
    const orders = c.orders?.length || 0;
    if (segment === "frequent") return orders >= 5;
    if (segment === "highspend")
      return Number(c.totalSpent || 0) >= spendThreshold;
    if (segment === "new") return orders <= 1;
    if (segment === "inactive") return orders === 0;
    return true;
  };

  const segmentCount = (key) => {
    const fn =
      key === "all"
        ? () => true
        : key === "frequent"
        ? (c) => (c.orders?.length || 0) >= 5
        : key === "highspend"
        ? (c) => Number(c.totalSpent || 0) >= spendThreshold
        : key === "new"
        ? (c) => (c.orders?.length || 0) <= 1
        : (c) => (c.orders?.length || 0) === 0;
    return allCustomers.filter(fn).length;
  };

  /* ── filtered + sorted list ── */
  const filteredCustomers = useMemo(() => {
    let list = allCustomers.filter(
      (c) =>
        segmentFilter(c) &&
        (c.name.toLowerCase().includes(recipientSearch.toLowerCase()) ||
          c.phone.includes(recipientSearch)),
    );
    list = [...list].sort((a, b) => {
      if (sortBy === "orders")
        return (b.orders?.length || 0) - (a.orders?.length || 0);
      if (sortBy === "spend")
        return Number(b.totalSpent || 0) - Number(a.totalSpent || 0);
      return a.name.localeCompare(b.name);
    });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allCustomers, recipientSearch, segment, sortBy, spendThreshold]);

  const toggleCustomer = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCustomers.forEach((c) => next.add(c.id));
      return next;
    });
  const deselectAll = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCustomers.forEach((c) => next.delete(c.id));
      return next;
    });

  const selectedCustomers = useMemo(
    () => allCustomers.filter((c) => selectedIds.has(c.id)),
    [allCustomers, selectedIds],
  );

  const currentCustomer = selectedCustomers[sendIndex];

  const buildMessage = (customer) =>
    message
      .replace(/\{name\}/gi, customer.name)
      .replace(/\{orders\}/gi, String(customer.orders?.length || 0))
      .replace(/\{totalSpent\}/gi, `₹${fmt(customer.totalSpent || 0)}`);

  const openWA = (c) => openDirectWA(c, buildMessage(c));

  /* ── keyboard shortcut in send step ── */
  useEffect(() => {
    if (step !== "send" || done) return;
    const handler = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleNext();
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, done, sendIndex, selectedCustomers]);

  /* ── scroll queue item into view ── */
  useEffect(() => {
    if (step !== "send") return;
    const el = queueRef.current?.querySelector(`[data-idx="${sendIndex}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [sendIndex, step]);

  const markAndAdvance = (status) => {
    const id = currentCustomer?.id;
    setStatusMap((prev) => ({ ...prev, [id]: status }));
    if (status === "sent") setSentCount((n) => n + 1);
    else setSkippedCount((n) => n + 1);

    const nextIndex = sendIndex + 1;
    if (nextIndex >= selectedCustomers.length) {
      setDone(true);
    } else {
      setSendIndex(nextIndex);
      openWA(selectedCustomers[nextIndex]);
    }
  };

  const handleNext = () => markAndAdvance("sent");
  const handleSkip = () => markAndAdvance("skipped");

  const startSending = () => {
    if (!message.trim()) {
      showError("Message cannot be empty");
      return;
    }
    if (selectedCustomers.length === 0) {
      showError("Please select at least one customer");
      return;
    }
    const initialStatus = {};
    selectedCustomers.forEach((c) => (initialStatus[c.id] = "pending"));
    setStatusMap(initialStatus);
    setSendIndex(0);
    setSentCount(0);
    setSkippedCount(0);
    setDone(false);
    setStep("send");
    openWA(selectedCustomers[0]);
  };

  const handleTemplateChange = (key) => {
    setTemplateKey(key);
    if (key !== "custom") setMessage(TEMPLATES[key]);
  };

  const allFilteredSelected =
    filteredCustomers.length > 0 &&
    filteredCustomers.every((c) => selectedIds.has(c.id));

  /* ── progress pct ── */
  const pct = selectedCustomers.length
    ? Math.round((sendIndex / selectedCustomers.length) * 100)
    : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col animate-fade-up">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <Radio className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">
                Broadcast WhatsApp
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                {step === "compose" && "Step 1 — Write your message"}
                {step === "select" &&
                  `Step 2 — Recipients · ${selectedIds.size} selected`}
                {step === "send" &&
                  `Step 3 — Sending · ${sentCount + skippedCount} of ${
                    selectedCustomers.length
                  } done`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* ── Step indicator + progress ── */}
        <div className="px-5 py-3 border-b border-gray-50 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            {["compose", "select", "send"].map((s, i) => (
              <React.Fragment key={s}>
                <div
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-all ${
                    step === s
                      ? "bg-green-600 text-white"
                      : (step === "select" && s === "compose") ||
                        step === "send"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {((step === "select" && s === "compose") ||
                    step === "send") &&
                  s !== step ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 text-center leading-none">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline capitalize">{s}</span>
                </div>
                {i < 2 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            ))}
          </div>
          {step === "send" && !done && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                {pct}%
              </span>
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* ── STEP 1: Compose ── */}
          {step === "compose" && (
            <div className="p-5 grid sm:grid-cols-2 gap-4">
              {/* left: compose */}
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Templates
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries({
                      offer: "🎉 Offer",
                      loyalty: "🌟 Loyalty",
                      feedback: "😊 Feedback",
                      event: "🎊 Event",
                      custom: "✏️ Custom",
                    }).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => handleTemplateChange(key)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                          templateKey === key
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Message
                    </p>
                    <span className="text-[10px] text-gray-400">
                      {message.length} chars
                    </span>
                  </div>
                  <textarea
                    rows={8}
                    value={message}
                    onChange={(e) => {
                      setMessage(e.target.value);
                      setTemplateKey("custom");
                    }}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-700 leading-relaxed"
                    placeholder="Type your message… Use {name}, {orders}, {totalSpent}"
                  />
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 space-y-1">
                  <p className="text-[11px] font-semibold text-blue-700">
                    Available placeholders
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {["{name}", "{orders}", "{totalSpent}"].map((p) => (
                      <code
                        key={p}
                        className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono"
                      >
                        {p}
                      </code>
                    ))}
                  </div>
                </div>
              </div>

              {/* right: live preview */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Eye className="w-3 h-3" /> Live Preview
                  </p>
                  {allCustomers.length > 0 && (
                    <select
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500"
                      value={previewCustomer?.id || ""}
                      onChange={(e) =>
                        setPreviewCustomer(
                          allCustomers.find(
                            (c) => c.id === Number(e.target.value),
                          ),
                        )
                      }
                    >
                      {allCustomers.slice(0, 20).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {previewCustomer ? (
                  <div className="space-y-3">
                    {/* WhatsApp bubble */}
                    <div className="bg-[#ECE5DD] rounded-2xl p-3 min-h-[180px] relative">
                      <div className="absolute top-2 right-3 text-[9px] text-gray-400 font-medium">
                        WhatsApp Preview
                      </div>
                      <div className="bg-white rounded-xl rounded-tl-none px-3 py-2.5 shadow-sm inline-block max-w-full mt-4">
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                          {buildMessage(previewCustomer)}
                        </p>
                        <p className="text-[10px] text-gray-400 text-right mt-1.5">
                          {new Date().toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>

                    {/* preview customer info */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl text-xs text-gray-500">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                        style={{
                          background: "linear-gradient(135deg,#ef4444,#dc2626)",
                        }}
                      >
                        {previewCustomer.name?.[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-700 truncate">
                        {previewCustomer.name}
                      </span>
                      <span className="ml-auto shrink-0">
                        {previewCustomer.orders?.length || 0} orders · ₹
                        {fmt(previewCustomer.totalSpent || 0)}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-2xl h-48 flex items-center justify-center text-gray-400 text-sm">
                    No customers loaded yet
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── STEP 2: Select recipients ── */}
          {step === "select" && (
            <div className="p-5 space-y-3">
              {/* Segment filters */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <Filter className="w-3 h-3" /> Smart Segments
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SEGMENTS.map((seg) => {
                    const count = loadingCustomers
                      ? "…"
                      : segmentCount(seg.key);
                    return (
                      <button
                        key={seg.key}
                        onClick={() => setSegment(seg.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          segment === seg.key
                            ? "bg-green-600 text-white shadow-sm"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <span>{seg.icon}</span>
                        <span>{seg.label}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                            segment === seg.key
                              ? "bg-green-700 text-white"
                              : "bg-white text-gray-500"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Search + sort */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    type="text"
                    value={recipientSearch}
                    onChange={(e) => setRecipientSearch(e.target.value)}
                    placeholder="Search customers…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center gap-1 border border-gray-200 rounded-xl px-2 py-1.5 text-xs text-gray-500">
                  <ArrowUpDown className="w-3 h-3" />
                  <select
                    className="bg-transparent text-xs text-gray-600 focus:outline-none cursor-pointer"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    {SORT_OPTIONS.map((o) => (
                      <option key={o.key} value={o.key}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* select/deselect bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    Select All ({filteredCustomers.length})
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    Deselect
                  </button>
                </div>
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    selectedIds.size > 0
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {selectedIds.size} selected
                </span>
              </div>

              {/* list */}
              {loadingCustomers ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading customers…</span>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {/* select-all row */}
                  {filteredCustomers.length > 0 && (
                    <div
                      onClick={allFilteredSelected ? deselectAll : selectAll}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors select-none"
                    >
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all ${
                          allFilteredSelected
                            ? "bg-green-600 border-green-600"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {allFilteredSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-gray-500">
                        {allFilteredSelected
                          ? "Deselect all visible"
                          : "Select all visible"}
                      </span>
                      <span className="ml-auto text-xs text-gray-400">
                        {filteredCustomers.length} shown
                      </span>
                    </div>
                  )}
                  {filteredCustomers.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">
                      No customers match this filter
                    </div>
                  ) : (
                    filteredCustomers.map((c) => {
                      const selected = selectedIds.has(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => toggleCustomer(c.id)}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors select-none ${
                            selected ? "bg-green-50" : "hover:bg-gray-50"
                          }`}
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border-2 transition-all ${
                              selected
                                ? "bg-green-600 border-green-600"
                                : "border-gray-300 bg-white"
                            }`}
                          >
                            {selected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                            style={{
                              background:
                                "linear-gradient(135deg,#ef4444,#dc2626)",
                            }}
                          >
                            {c.name?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {c.name}
                            </p>
                            <p className="text-xs text-gray-400">{c.phone}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold text-gray-600">
                              {c.orders?.length || 0} orders
                            </p>
                            <p className="text-[10px] text-gray-400">
                              ₹{fmt(c.totalSpent || 0)}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Send queue ── */}
          {step === "send" && (
            <div className="p-5 space-y-4">
              {done ? (
                <div className="flex flex-col items-center py-8 gap-4">
                  <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <div className="text-center">
                    <h4 className="font-bold text-gray-900 text-lg">
                      Broadcast Complete!
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">
                      Sent to{" "}
                      <strong className="text-green-700">{sentCount}</strong>{" "}
                      customer{sentCount !== 1 ? "s" : ""}.
                      {skippedCount > 0 && (
                        <span> Skipped {skippedCount}.</span>
                      )}
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">
                        {sentCount}
                      </p>
                      <p className="text-[10px] text-green-600 mt-0.5">Sent</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-gray-500">
                        {skippedCount}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        Skipped
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-blue-700">
                        {selectedCustomers.length}
                      </p>
                      <p className="text-[10px] text-blue-600 mt-0.5">Total</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid sm:grid-cols-5 gap-4">
                  {/* Current customer — 3 cols */}
                  <div className="sm:col-span-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-500" /> Now Sending
                      </p>
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                        {sendIndex + 1} / {selectedCustomers.length}
                      </span>
                    </div>

                    <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
                          style={{
                            background:
                              "linear-gradient(135deg,#ef4444,#dc2626)",
                          }}
                        >
                          {currentCustomer?.name?.[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">
                            {currentCustomer?.name}
                          </p>
                          <p className="text-xs text-gray-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {currentCustomer?.phone}
                          </p>
                        </div>
                      </div>

                      {/* WhatsApp bubble */}
                      <div className="bg-[#ECE5DD] rounded-xl p-2.5">
                        <div className="bg-white rounded-xl rounded-tl-none px-3 py-2 shadow-sm">
                          <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
                            {currentCustomer
                              ? buildMessage(currentCustomer)
                              : ""}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-green-50 border border-green-100 rounded-xl px-3 py-2.5">
                      <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
                      <p className="text-xs text-green-700">
                        WhatsApp opened — tap <strong>Send</strong> there, then
                        press{" "}
                        <kbd className="bg-green-200 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-mono">
                          Enter
                        </kbd>{" "}
                        or click <strong>Next →</strong>
                      </p>
                    </div>

                    <div className="text-[11px] text-gray-400 flex items-center gap-3">
                      <span>Keyboard:</span>
                      <span>
                        <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                          Enter
                        </kbd>{" "}
                        = Next
                      </span>
                      <span>
                        <kbd className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
                          S
                        </kbd>{" "}
                        = Skip
                      </span>
                    </div>
                  </div>

                  {/* Queue — 2 cols */}
                  <div className="sm:col-span-2 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Queue · {selectedCustomers.length - sendIndex - 1}{" "}
                      remaining
                    </p>
                    <div
                      ref={queueRef}
                      className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-[280px] overflow-y-auto"
                    >
                      {selectedCustomers.map((c, idx) => {
                        const st =
                          idx < sendIndex
                            ? statusMap[c.id] || "sent"
                            : idx === sendIndex
                            ? "current"
                            : "pending";
                        return (
                          <div
                            key={c.id}
                            data-idx={idx}
                            className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${STATUS_STYLES[st]}`}
                          >
                            <div
                              className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                              style={{
                                background:
                                  "linear-gradient(135deg,#ef4444,#dc2626)",
                                opacity: st === "pending" ? 0.5 : 1,
                              }}
                            >
                              {c.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{c.name}</p>
                            </div>
                            <div className="shrink-0">
                              {st === "sent" && (
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              )}
                              {st === "skipped" && (
                                <SkipForward className="w-3.5 h-3.5 text-gray-400" />
                              )}
                              {st === "current" && (
                                <Zap className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                              )}
                              {st === "pending" && (
                                <Clock className="w-3.5 h-3.5 text-gray-300" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 shrink-0">
          <div>
            {step === "select" && (
              <button
                onClick={() => setStep("compose")}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
            {step === "send" && !done && (
              <button
                onClick={() => setStep("select")}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {done ? (
              <button
                onClick={onClose}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors"
              >
                Done
              </button>
            ) : step === "send" ? (
              <>
                <button
                  onClick={handleSkip}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <SkipForward className="w-4 h-4" /> Skip
                </button>
                <button
                  onClick={handleNext}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm"
                >
                  Next →
                  <span className="bg-green-700 text-xs px-1.5 py-0.5 rounded-md">
                    {sendIndex + 2 <= selectedCustomers.length
                      ? `${sendIndex + 2}/${selectedCustomers.length}`
                      : "Done"}
                  </span>
                </button>
              </>
            ) : step === "select" ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={startSending}
                  disabled={selectedIds.size === 0}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
                >
                  <Radio className="w-4 h-4" />
                  Start Sending ({selectedIds.size})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep("select")}
                  disabled={!message.trim()}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-sm"
                >
                  Select Recipients <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ─── Customer detail panel ──────────────────────────────────── */
const CustomerDetail = ({ customerId, onBack }) => {
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWA, setShowWA] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const fetchCustomer = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/customers/${customerId}`);
        if (mountedRef.current) setCustomer(res.data.customer);
      } catch {
        if (mountedRef.current) showError("Failed to load customer details");
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };
    fetchCustomer();
    return () => {
      mountedRef.current = false;
    };
  }, [customerId]);

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading customer details…</p>
      </div>
    );

  if (!customer)
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <XCircle className="w-12 h-12" />
        <p>Customer not found</p>
      </div>
    );

  const totalOrders = customer.orders?.length || 0;
  const completedOrders = customer.orders?.filter((o) =>
    ["COMPLETED", "PAID", "DELIVERED"].includes(o.status),
  ).length;
  const totalSpent = customer.orders?.reduce(
    (sum, o) => sum + Number(o.total || 0),
    0,
  );

  return (
    <>
      {showWA && (
        <WhatsAppModal customer={customer} onClose={() => setShowWA(false)} />
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* back + actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            Back to Customers
          </button>
          <button
            onClick={() => setShowWA(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            Send WhatsApp
          </button>
        </div>

        {/* profile card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shrink-0"
              style={{ background: "linear-gradient(135deg,#ef4444,#dc2626)" }}
            >
              {customer.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">
                {customer.name}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Phone className="w-3.5 h-3.5" />
                  {customer.phone}
                </span>
                {customer.email && (
                  <span className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Mail className="w-3.5 h-3.5" />
                    {customer.email}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Calendar className="w-3.5 h-3.5" />
                  Customer since {fmtDateShort(customer.createdAt)}
                </span>
              </div>
            </div>
          </div>

          {/* stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
            {[
              {
                label: "Total Orders",
                value: totalOrders,
                icon: ShoppingBag,
                color: "text-blue-600 bg-blue-50",
              },
              {
                label: "Completed",
                value: completedOrders,
                icon: CheckCircle,
                color: "text-green-600 bg-green-50",
              },
              {
                label: "Total Spent",
                value: `₹${fmt(totalSpent)}`,
                icon: IndianRupee,
                color: "text-purple-600 bg-purple-50",
              },
              {
                label: "Visits",
                value: customer.visitCount || totalOrders,
                icon: UserCheck,
                color: "text-orange-600 bg-orange-50",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="text-center">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2 ${color}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-lg font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* order history */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-gray-400" />
              Order History
              <span className="ml-auto text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {totalOrders} orders
              </span>
            </h3>
          </div>

          {totalOrders === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
              <ShoppingBag className="w-10 h-10" />
              <p className="text-sm">No orders yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {customer.orders.map((order) => (
                <div
                  key={order.id}
                  className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* order id + time */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">
                          Order #{order.id}
                        </span>
                        {order.table && (
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            Table {order.table.number}
                          </span>
                        )}
                        <span
                          className={`flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full ${statusColor(
                            order.status,
                          )}`}
                        >
                          {statusIcon(order.status)}
                          {order.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtDate(order.createdAt)}
                      </p>

                      {/* items */}
                      {order.items && order.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {order.items.map((item, i) => (
                            <span
                              key={i}
                              className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md"
                            >
                              {item.quantity}× {item.menuItem?.name || "Item"}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* amount */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-gray-900">
                        ₹{fmt(order.total)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

/* ─── Main customers page ────────────────────────────────────── */
const CustomersPage = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [whatsappTarget, setWhatsappTarget] = useState(null);
  const [showBulkWA, setShowBulkWA] = useState(false);
  const abortRef = useRef(null);
  const mountedRef = useRef(true);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    try {
      setLoading(true);
      const params = { page, limit: 15 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await axios.get("/api/customers", {
        params,
        signal: abortRef.current.signal,
      });
      if (mountedRef.current) {
        const data = res.data;
        setCustomers(data.data || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      if (mountedRef.current) showError("Failed to load customers");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCustomers();
    return () => {
      mountedRef.current = false;
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchCustomers]);

  // If a customer is selected, show detail view
  if (selectedId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <CustomerDetail
          customerId={selectedId}
          onBack={() => setSelectedId(null)}
        />
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Customers",
      value: total,
      icon: Users,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Avg. Orders",
      value: customers.length
        ? (
            customers.reduce((s, c) => s + (c.orders?.length || 0), 0) /
            customers.length
          ).toFixed(1)
        : "—",
      icon: ShoppingBag,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Avg. Spend",
      value: customers.length
        ? `₹${fmt(
            customers.reduce((s, c) => s + Number(c.totalSpent || 0), 0) /
              customers.length,
          )}`
        : "—",
      icon: TrendingUp,
      color: "text-green-600 bg-green-50",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {whatsappTarget && (
        <WhatsAppModal
          customer={whatsappTarget}
          onClose={() => setWhatsappTarget(null)}
        />
      )}
      {showBulkWA && <BulkWhatsAppModal onClose={() => setShowBulkWA(false)} />}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* page header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-brand-600" />
              Customers
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              View all registered customers and their order history
            </p>
          </div>
          <button
            onClick={() => setShowBulkWA(true)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-all shadow-sm hover:-translate-y-px"
          >
            <Radio className="w-4 h-4" />
            Broadcast WhatsApp
          </button>
        </div>

        {/* stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-400">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* search */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or phone…"
              className="w-full pl-10 pr-10 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* customer table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-400">Loading customers…</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-400">
              <Users className="w-12 h-12" />
              <p className="text-sm font-medium">No customers found</p>
              {debouncedSearch && (
                <p className="text-xs">Try a different search term</p>
              )}
            </div>
          ) : (
            <>
              {/* desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="text-center px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Orders
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Total Spent
                      </th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Since
                      </th>
                      <th className="text-right px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {customers.map((c) => (
                      <tr
                        key={c.id}
                        className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        onClick={() => setSelectedId(c.id)}
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold shrink-0"
                              style={{
                                background:
                                  "linear-gradient(135deg,#ef4444,#dc2626)",
                              }}
                            >
                              {c.name?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {c.name}
                              </p>
                              {c.email && (
                                <p className="text-xs text-gray-400 truncate max-w-[180px]">
                                  {c.email}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600">{c.phone}</td>
                        <td className="px-5 py-3.5 text-center">
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-50 text-blue-700 text-xs font-bold">
                            {c.orders?.length || 0}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                          ₹{fmt(c.totalSpent || 0)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">
                          {fmtDateShort(c.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div
                            className="flex items-center justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={() => setWhatsappTarget(c)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                              title="Send WhatsApp message directly"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              WhatsApp
                            </button>
                            <button
                              onClick={() => setSelectedId(c.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              View
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* mobile card list */}
              <div className="sm:hidden divide-y divide-gray-100">
                {customers.map((c) => (
                  <div
                    key={c.id}
                    className="px-4 py-4 flex items-center gap-3 active:bg-gray-50 cursor-pointer"
                    onClick={() => setSelectedId(c.id)}
                  >
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                      style={{
                        background: "linear-gradient(135deg,#ef4444,#dc2626)",
                      }}
                    >
                      {c.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {c.name}
                      </p>
                      <p className="text-xs text-gray-400">{c.phone}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-blue-600 font-medium">
                          {c.orders?.length || 0} orders
                        </span>
                        <span className="text-gray-300">·</span>
                        <span className="text-xs text-gray-500 font-medium">
                          ₹{fmt(c.totalSpent || 0)}
                        </span>
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => setWhatsappTarget(c)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                        title="Send WhatsApp message directly"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>

              {/* pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/50">
                  <p className="text-xs text-gray-400">
                    Showing {customers.length} of {total} customers
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Prev
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const p = i + 1;
                      return (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`w-8 h-8 text-xs font-medium rounded-lg transition-colors ${
                            page === p
                              ? "bg-brand-600 text-white shadow-sm"
                              : "border border-gray-200 text-gray-600 hover:bg-gray-100"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomersPage;
