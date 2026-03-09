import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  ShoppingCart,
  Plus,
  Minus,
  X,
  Trash2,
  ChefHat,
  CheckCircle,
  Search,
  ArrowLeft,
  Loader2,
  UtensilsCrossed,
  Phone,
  MapPin,
  ChevronRight,
  Star,
} from "lucide-react";
import { useParams } from "react-router-dom";

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n) =>
  typeof n === "number"
    ? n.toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : "₹0";

const api = axios.create({ baseURL: "/api/guest" });

/* ─── Screen states ───────────────────────────────────────────── */
const SCREEN = { MENU: "menu", CART: "cart", CONFIRM: "confirm" };

/* ─── Item Card ───────────────────────────────────────────────── */
const ItemCard = ({ item, qty, onAdd, onRemove }) => (
  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
    <div className="bg-gradient-to-br from-orange-50 to-amber-50 h-28 flex items-center justify-center">
      <UtensilsCrossed className="w-12 h-12 text-orange-200" />
    </div>
    <div className="p-3 flex flex-col flex-1">
      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
        {item.name}
      </p>
      {item.description && (
        <p className="text-xs text-gray-400 mt-1 line-clamp-2 flex-1">
          {item.description}
        </p>
      )}
      <div className="flex items-center justify-between mt-3">
        <span className="font-bold text-orange-600 text-base">
          {fmt(item.price)}
        </span>
        {qty === 0 ? (
          <button
            onClick={() => onAdd(item)}
            className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center shadow-sm active:scale-95 transition-transform"
          >
            <Plus className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onRemove(item.id)}
              className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center active:scale-95 transition-transform"
            >
              <Minus className="w-3.5 h-3.5 text-gray-700" />
            </button>
            <span className="text-sm font-bold text-gray-900 w-4 text-center">
              {qty}
            </span>
            <button
              onClick={() => onAdd(item)}
              className="w-7 h-7 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center active:scale-95 transition-transform"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  </div>
);

/* ─── Cart row ─────────────────────────────────────────────────── */
const CartRow = ({ entry, onAdd, onRemove, currency }) => (
  <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-gray-900 text-sm truncate">
        {entry.item.name}
      </p>
      <p className="text-xs text-orange-600 font-medium mt-0.5">
        {fmt(entry.item.price)} each
      </p>
    </div>
    <div className="flex items-center gap-2 shrink-0">
      <button
        onClick={() => onRemove(entry.item.id)}
        className="w-7 h-7 rounded-full bg-gray-100 active:scale-95 transition-transform flex items-center justify-center"
      >
        {entry.qty === 1 ? (
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        ) : (
          <Minus className="w-3.5 h-3.5 text-gray-600" />
        )}
      </button>
      <span className="text-sm font-bold text-gray-900 w-4 text-center">
        {entry.qty}
      </span>
      <button
        onClick={() => onAdd(entry.item)}
        className="w-7 h-7 rounded-full bg-orange-500 active:scale-95 transition-transform flex items-center justify-center"
      >
        <Plus className="w-3.5 h-3.5 text-white" />
      </button>
    </div>
    <span className="text-sm font-semibold text-gray-700 w-14 text-right shrink-0">
      {fmt(entry.item.price * entry.qty)}
    </span>
  </div>
);

/* ─── Main Page ────────────────────────────────────────────────── */
const CustomerMenuPage = () => {
  const { tableId } = useParams();

  const [restaurant, setRestaurant] = useState(null);
  const [table, setTable] = useState(null);
  const [categories, setCategories] = useState([]);
  const [screen, setScreen] = useState(SCREEN.MENU);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Menu
  const [activeCat, setActiveCat] = useState("All");
  const [search, setSearch] = useState("");
  const catBarRef = useRef(null);

  // Cart: { [itemId]: { item, qty } }
  const [cart, setCart] = useState({});

  // Order state
  const [guestName, setGuestName] = useState("");
  const [guestNotes, setGuestNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  /* ── Load data ── */
  useEffect(() => {
    const load = async () => {
      try {
        const [restRes, tableRes, menuRes] = await Promise.all([
          api.get("/restaurant"),
          api.get(`/table/${tableId}`),
          api.get("/menu"),
        ]);
        setRestaurant(restRes.data);
        setTable(tableRes.data);
        setCategories(menuRes.data.categories);
      } catch (err) {
        setError(
          err.response?.data?.error || "Failed to load menu. Please try again.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tableId]);

  /* ── Cart helpers ── */
  const cartEntries = Object.values(cart);
  const totalItems = cartEntries.reduce((s, e) => s + e.qty, 0);
  const subtotal = cartEntries.reduce((s, e) => s + e.item.price * e.qty, 0);
  const taxRate = restaurant?.taxRate ?? 0.05;
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  const addItem = useCallback((item) => {
    setCart((prev) => ({
      ...prev,
      [item.id]: prev[item.id]
        ? { ...prev[item.id], qty: prev[item.id].qty + 1 }
        : { item, qty: 1 },
    }));
  }, []);

  const removeItem = useCallback((itemId) => {
    setCart((prev) => {
      const entry = prev[itemId];
      if (!entry) return prev;
      if (entry.qty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...entry, qty: entry.qty - 1 } };
    });
  }, []);

  const clearCart = () => setCart({});

  /* ── Filtered items ── */
  const allItems = categories.flatMap((c) =>
    c.items.map((i) => ({ ...i, categoryName: c.name })),
  );
  const displayed = allItems.filter((item) => {
    const matchCat = activeCat === "All" || item.categoryName === activeCat;
    const matchQ =
      !search.trim() || item.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchQ;
  });

  /* ── Place order ── */
  const placeOrder = async () => {
    setSubmitting(true);
    try {
      const res = await api.post("/order", {
        tableId: parseInt(tableId, 10),
        guestName: guestName.trim() || undefined,
        items: cartEntries.map((e) => ({
          menuItemId: e.item.id,
          quantity: e.qty,
          notes: guestNotes.trim() || undefined,
        })),
      });
      setOrderResult(res.data);
      setScreen(SCREEN.CONFIRM);
      clearCart();
    } catch (err) {
      alert(
        err.response?.data?.error || "Failed to place order. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Error screen ── */
  if (error) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6 text-center">
        <UtensilsCrossed className="w-16 h-16 text-orange-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-800 mb-2">Oops!</h2>
        <p className="text-gray-500 text-sm max-w-xs">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-6 px-6 py-2.5 bg-orange-500 text-white font-semibold rounded-xl"
        >
          Try Again
        </button>
      </div>
    );
  }

  /* ── Loading screen ── */
  if (loading) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-lg">
          <ChefHat className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center gap-2 text-orange-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="font-medium">Loading menu…</span>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: CONFIRM  (order placed)
  ══════════════════════════════════════════════════════════════ */
  if (screen === SCREEN.CONFIRM && orderResult) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-1">
            Order Placed!
          </h2>
          <p className="text-gray-500 text-sm mb-6">{orderResult.message}</p>

          {/* Order details */}
          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Table</span>
              <span className="font-bold text-gray-900">
                Table {table?.number ?? tableId}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Bill No.</span>
              <span className="font-mono font-bold text-gray-900">
                {orderResult.billNumber}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{fmt(orderResult.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {restaurant?.taxLabel ?? "Tax"}
              </span>
              <span className="font-medium">{fmt(orderResult.tax)}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-gray-200 pt-3">
              <span className="font-bold text-gray-900">Total</span>
              <span className="font-bold text-orange-600 text-lg">
                {fmt(orderResult.total)}
              </span>
            </div>
          </div>

          {/* Items ordered */}
          <div className="text-left mb-6">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Items ordered
            </p>
            <div className="space-y-1">
              {orderResult.items?.map((it, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="text-gray-500">
                    {fmt(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-700 mb-6">
            <ChefHat className="w-4 h-4 shrink-0" />
            <span>Your order is being prepared. Sit back and relax!</span>
          </div>

          <button
            onClick={() => {
              setOrderResult(null);
              setScreen(SCREEN.MENU);
              setGuestName("");
              setGuestNotes("");
            }}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
          >
            Order More
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: CART
  ══════════════════════════════════════════════════════════════ */
  if (screen === SCREEN.CART) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setScreen(SCREEN.MENU)}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="flex-1">
            <h2 className="font-bold text-gray-900">Your Order</h2>
            <p className="text-xs text-gray-400">
              Table {table?.number ?? tableId}
            </p>
          </div>
          <button
            onClick={clearCart}
            className="text-xs text-red-500 font-medium hover:text-red-700"
          >
            Clear all
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Items */}
          <div className="bg-white rounded-2xl px-4 shadow-sm border border-gray-100">
            {cartEntries.map((entry) => (
              <CartRow
                key={entry.item.id}
                entry={entry}
                onAdd={addItem}
                onRemove={removeItem}
              />
            ))}
          </div>

          {/* Guest name */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Your details (optional)
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Your name
              </label>
              <input
                type="text"
                placeholder="e.g. Rahul"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Special instructions
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Less spicy, no onions…"
                value={guestNotes}
                onChange={(e) => setGuestNotes(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
              />
            </div>
          </div>

          {/* Bill summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Bill Summary
            </p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                Subtotal ({totalItems} items)
              </span>
              <span className="font-medium">{fmt(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">
                {restaurant?.taxLabel ?? "Tax"}
              </span>
              <span className="font-medium">{fmt(tax)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2 mt-1">
              <span className="text-gray-900">Total</span>
              <span className="text-orange-600 text-lg">{fmt(total)}</span>
            </div>
          </div>

          <p className="text-xs text-center text-gray-400 pb-2">
            Payment will be collected at the table after your meal.
          </p>
        </div>

        {/* Place order CTA */}
        <div className="px-4 py-4 bg-white border-t border-gray-100 safe-area-bottom">
          <button
            onClick={placeOrder}
            disabled={submitting || cartEntries.length === 0}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold text-lg rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-lg shadow-orange-200 active:scale-[0.98]"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" /> Placing order…
              </>
            ) : (
              <>
                <ChefHat className="w-5 h-5" /> Place Order · {fmt(total)}
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════════════════════════════════
     SCREEN: MENU  (main)
  ══════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* ── Hero header ── */}
      <div
        className="relative px-4 pt-10 pb-6 text-white"
        style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-white/10 -translate-y-16 translate-x-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-12 -translate-x-8" />

        <div className="relative">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
              <ChefHat className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">
                {restaurant?.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5 text-white/80 text-xs">
                <MapPin className="w-3 h-3" />
                <span className="truncate max-w-[200px]">
                  {restaurant?.address}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="bg-white/20 backdrop-blur rounded-xl px-3 py-2">
              <p className="text-white/70 text-xs">You're at</p>
              <p className="text-white font-bold text-lg leading-tight">
                Table {table?.number ?? tableId}
              </p>
            </div>
            {restaurant?.phone && (
              <a
                href={`tel:${restaurant.phone}`}
                className="bg-white/20 backdrop-blur rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs text-white"
              >
                <Phone className="w-3.5 h-3.5" />
                {restaurant.phone}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="px-4 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search dishes…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setActiveCat("All");
            }}
            className="w-full pl-10 pr-8 py-3 bg-white border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 shadow-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* ── Category pills ── */}
      {!search && (
        <div
          ref={catBarRef}
          className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto scrollbar-none"
          style={{ scrollbarWidth: "none" }}
        >
          {["All", ...categories.map((c) => c.name)].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCat === cat
                  ? "bg-orange-500 text-white shadow-md shadow-orange-200"
                  : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ── Items grid ── */}
      <div className="flex-1 px-4 pt-3 pb-32 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="text-center py-16">
            <UtensilsCrossed className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No items found</p>
          </div>
        ) : (
          <>
            {/* When search is active, show as single flat grid with section labels */}
            {search ? (
              <div className="grid grid-cols-2 gap-3">
                {displayed.map((item) => (
                  <ItemCard
                    key={item.id}
                    item={item}
                    qty={cart[item.id]?.qty ?? 0}
                    onAdd={addItem}
                    onRemove={removeItem}
                  />
                ))}
              </div>
            ) : (
              /* Group by category when browsing */
              categories
                .filter((c) => activeCat === "All" || c.name === activeCat)
                .map((cat) => {
                  const catItems = cat.items;
                  if (catItems.length === 0) return null;
                  return (
                    <div key={cat.id} className="mb-6">
                      <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <span className="w-1 h-5 bg-orange-500 rounded-full inline-block" />
                        {cat.name}
                        <span className="text-xs text-gray-400 font-normal">
                          ({catItems.length})
                        </span>
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        {catItems.map((item) => (
                          <ItemCard
                            key={item.id}
                            item={item}
                            qty={cart[item.id]?.qty ?? 0}
                            onAdd={addItem}
                            onRemove={removeItem}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
            )}
          </>
        )}
      </div>

      {/* ── Floating Cart CTA ── */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md px-4 pb-6 pt-2 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent">
          <button
            onClick={() => setScreen(SCREEN.CART)}
            className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl flex items-center justify-between px-5 shadow-xl shadow-orange-200 active:scale-[0.98] transition-all"
          >
            <span className="bg-orange-400 rounded-xl px-2.5 py-1 text-sm font-bold">
              {totalItems} item{totalItems > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              View Order
            </span>
            <span className="font-bold">{fmt(subtotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerMenuPage;
