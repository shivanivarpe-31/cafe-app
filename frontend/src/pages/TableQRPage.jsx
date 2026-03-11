import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  QrCode,
  RefreshCw,
  Download,
  Copy,
  CheckCheck,
  ExternalLink,
  Printer,
  Search,
  X,
  Table2,
  WifiOff,
  Info,
} from "lucide-react";
import Navbar from "../components/navbar";
import { showSuccess, showError } from "../utils/toast";

/* ─── helpers ─────────────────────────────────────────────────── */
const getMenuUrl = (tableId) => {
  const base = window.location.origin;
  return `${base}/menu/${tableId}`;
};

const getQrImageUrl = (tableId, size = 200) => {
  const data = encodeURIComponent(getMenuUrl(tableId));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}&bgcolor=ffffff&color=1a1a1a&margin=1`;
};

const tableStatusColors = {
  AVAILABLE: "bg-green-100 text-green-700 border-green-200",
  OCCUPIED: "bg-blue-100 text-blue-700 border-blue-200",
  RESERVED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  BLOCKED: "bg-gray-100 text-gray-500 border-gray-200",
};

/* ─── QR Card ─────────────────────────────────────────────────── */
const QRCard = ({ table }) => {
  const [copied, setCopied] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const url = getMenuUrl(table.id);
  const qrSrc = getQrImageUrl(table.id, 220);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showSuccess("Link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showError("Failed to copy link");
    }
  };

  const openMenu = () => window.open(url, "_blank", "noopener,noreferrer");

  const downloadQR = () => {
    const link = document.createElement("a");
    link.href = getQrImageUrl(table.id, 400);
    link.download = `table-${table.number ?? table.id}-qr.png`;
    link.click();
  };

  const statusKey = table.status?.toUpperCase() ?? "AVAILABLE";
  const statusStyle =
    tableStatusColors[statusKey] ?? tableStatusColors.AVAILABLE;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Card header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
            <Table2 className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">
              Table {table.number ?? table.id}
            </p>
            {table.capacity && (
              <p className="text-xs text-gray-400">
                Capacity: {table.capacity}
              </p>
            )}
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusStyle}`}
        >
          {table.status ?? "Available"}
        </span>
      </div>

      {/* QR code */}
      <div className="flex items-center justify-center bg-gray-50 py-5 px-4">
        {imgError ? (
          <div className="w-44 h-44 rounded-xl bg-gray-100 flex flex-col items-center justify-center text-center p-4 text-gray-400">
            <WifiOff className="w-8 h-8 mb-2" />
            <p className="text-xs">QR unavailable offline</p>
          </div>
        ) : (
          <div className="relative w-44 h-44">
            {!imgLoaded && (
              <div className="absolute inset-0 bg-gray-100 rounded-xl animate-pulse" />
            )}
            <img
              src={qrSrc}
              alt={`QR code for Table ${table.number ?? table.id}`}
              className={`w-44 h-44 rounded-xl transition-opacity duration-300 ${
                imgLoaded ? "opacity-100" : "opacity-0"
              }`}
              onLoad={() => setImgLoaded(true)}
              onError={() => {
                setImgError(true);
                setImgLoaded(true);
              }}
            />
          </div>
        )}
      </div>

      {/* URL */}
      <div className="px-4 py-2">
        <p className="text-[10px] text-gray-400 text-center break-all font-mono">
          {url}
        </p>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <button
          onClick={copyLink}
          className="flex flex-col items-center gap-1 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-xs font-medium text-gray-600 transition-colors"
        >
          {copied ? (
            <CheckCheck className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          {copied ? "Copied!" : "Copy"}
        </button>
        <button
          onClick={openMenu}
          className="flex flex-col items-center gap-1 py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-xs font-medium text-orange-600 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Preview
        </button>
        <button
          onClick={downloadQR}
          className="flex flex-col items-center gap-1 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-xs font-medium text-blue-600 transition-colors"
        >
          <Download className="w-4 h-4" />
          Save
        </button>
      </div>
    </div>
  );
};

/* ─── Print sheet ─────────────────────────────────────────────── */
const PrintSheet = ({ tables, restaurantName }) => (
  <div className="hidden print:block">
    <style>{`
      @media print {
        body * { visibility: hidden; }
        #print-sheet, #print-sheet * { visibility: visible; }
        #print-sheet { position: fixed; left: 0; top: 0; width: 100%; }
        .print-qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; padding: 24px; }
        .print-card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; text-align: center; break-inside: avoid; }
        .print-card img { width: 160px; height: 160px; margin: 0 auto 8px; display: block; }
        .print-card h3 { font-weight: 700; font-size: 18px; margin: 0 0 4px; }
        .print-card p { font-size: 11px; color: #6b7280; margin: 0; }
      }
    `}</style>
    <div id="print-sheet">
      <div style={{ textAlign: "center", padding: "16px 24px 8px" }}>
        <h2 style={{ fontWeight: 700, fontSize: 22, margin: 0 }}>
          {restaurantName} — Table QR Codes
        </h2>
        <p style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
          Scan to order from your phone
        </p>
      </div>
      <div className="print-qr-grid">
        {tables.map((t) => (
          <div className="print-card" key={t.id}>
            <img
              src={getQrImageUrl(t.id, 160)}
              alt={`Table ${t.number ?? t.id}`}
            />
            <h3>Table {t.number ?? t.id}</h3>
            <p>Scan to order</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

/* ─── Main Page ─────────────────────────────────────────────────── */
const TableQRPage = () => {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [restaurant, setRestaurant] = useState(null);

  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [tablesRes, restRes] = await Promise.all([
        axios.get("/api/tables"),
        axios.get("/api/guest/restaurant"),
      ]);
      setTables(tablesRes.data);
      setRestaurant(restRes.data);
    } catch (err) {
      showError("Failed to load tables");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filtered = tables.filter((t) =>
    search.trim() ? String(t.number ?? t.id).includes(search.trim()) : true,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      {/* Hidden print content */}
      <PrintSheet
        tables={tables}
        restaurantName={restaurant?.name ?? "Restaurant"}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 shadow-md">
                <QrCode className="w-5 h-5 text-white" />
              </span>
              Table QR Codes
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              Each QR code opens a mobile menu for that table. Customers can
              browse and place orders directly.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => fetchAll(true)}
              disabled={refreshing}
              className="p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 shadow-sm disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print All
            </button>
          </div>
        </div>

        {/* Info banner */}
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-orange-500 mt-0.5 shrink-0" />
          <div className="text-sm text-orange-700">
            <b>How it works:</b> Print or display these QR codes on each table.
            When a customer scans one, they get a mobile-optimised menu page for
            that table — they can browse, add items to cart, and place an order
            directly into the POS. Orders appear instantly in the Kitchen
            Display and Orders page.
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Filter by table number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 h-72 animate-pulse"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 py-20 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No tables found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map((table) => (
              <QRCard key={table.id} table={table} />
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-sm text-gray-400 text-center">
            Showing {filtered.length} table{filtered.length !== 1 ? "s" : ""} •
            QR codes generated via{" "}
            <a
              href="https://goqr.me/api/"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              qrserver.com
            </a>
          </p>
        )}
      </div>
    </div>
  );
};

export default TableQRPage;
