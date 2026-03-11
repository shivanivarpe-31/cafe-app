/**
 * RecipeCostingTab
 * ─────────────────────────────────────────────────────────────────
 * Self-contained tab panel rendered inside InventoryPage under the
 * "Costing" tab.  All state + data fetching lives here so that the
 * parent page is not polluted.
 *
 * Props
 *   onEditRecipe  (item: { id, name }) => void
 *     Callback that opens InventoryPage's RecipeModal for the given
 *     dish so the user can set / update the ingredient recipe without
 *     leaving the page.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import axios from "axios";
import {
  TrendingUp,
  TrendingDown,
  // DollarSign,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  Search,
  ArrowUpDown,
  Flame,
  Package,
  X,
  ChefHat,
  Pencil,
} from "lucide-react";
import { showError } from "../../utils/toast";

/* ─── helpers ─────────────────────────────────────────────────── */
const fmt = (n, decimals = 2) =>
  typeof n === "number" ? `₹${n.toFixed(decimals)}` : "—";

/* ─── MarginBadge ─────────────────────────────────────────────── */
const MarginBadge = ({ band, pct }) => {
  if (band === "NO_RECIPE")
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
        <Info className="w-3 h-3" /> No Recipe
      </span>
    );
  const styles = {
    LOW: "bg-red-100 text-red-700",
    MEDIUM: "bg-yellow-100 text-yellow-700",
    HIGH: "bg-green-100 text-green-700",
  };
  const icons = {
    LOW: <TrendingDown className="w-3 h-3" />,
    MEDIUM: <ArrowUpDown className="w-3 h-3" />,
    HIGH: <TrendingUp className="w-3 h-3" />,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[band]}`}
    >
      {icons[band]} {pct !== null ? `${pct.toFixed(1)}%` : "—"}
    </span>
  );
};

/* ─── MarginBar ───────────────────────────────────────────────── */
const MarginBar = ({ pct }) => {
  if (pct === null) return null;
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    pct < 0
      ? "bg-red-500"
      : pct < 30
      ? "bg-red-400"
      : pct < 60
      ? "bg-yellow-400"
      : "bg-green-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
      <div
        className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};

/* ─── SummaryCard ─────────────────────────────────────────────── */
const SummaryCard = ({
  label,
  value,
  sub,
  icon: Icon,
  borderColor,
  bgColor,
}) => (
  <div className={`bg-white rounded-2xl p-4 border-2 ${borderColor} shadow-sm`}>
    <div className="flex items-start justify-between">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-2xl font-bold text-gray-900 mt-1 truncate">
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
      <div className={`p-2.5 rounded-xl shrink-0 ${bgColor}`}>
        <Icon className="w-5 h-5 text-gray-600" />
      </div>
    </div>
  </div>
);

/* ─── CostingItemCard ─────────────────────────────────────────── */
const CostingItemCard = ({ item, onEditRecipe }) => {
  const [expanded, setExpanded] = useState(false);

  const borderColor =
    item.marginBand === "LOW"
      ? "border-red-300"
      : item.marginBand === "MEDIUM"
      ? "border-yellow-300"
      : item.marginBand === "HIGH"
      ? "border-green-300"
      : "border-gray-200";

  const headerBg =
    item.marginBand === "LOW"
      ? "bg-red-50"
      : item.marginBand === "MEDIUM"
      ? "bg-yellow-50"
      : item.marginBand === "HIGH"
      ? "bg-green-50"
      : "bg-gray-50";

  return (
    <div
      className={`bg-white rounded-2xl border-2 ${borderColor} shadow-sm overflow-hidden transition-shadow hover:shadow-md`}
    >
      {/* Header */}
      <div className={`${headerBg} px-4 py-3`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 text-sm leading-tight truncate">
              {item.name}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">{item.category}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <MarginBadge band={item.marginBand} pct={item.marginPct} />
          </div>
        </div>
        {item.marginPct !== null && <MarginBar pct={item.marginPct} />}
      </div>

      {/* Price / cost breakdown */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Selling Price</span>
          <span className="font-semibold text-gray-900">
            {fmt(item.sellingPrice)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Ingredient Cost</span>
          <span
            className={`font-semibold ${
              item.hasRecipe ? "text-red-600" : "text-gray-400"
            }`}
          >
            {item.hasRecipe ? fmt(item.ingredientCost) : "Not set"}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between text-sm">
          <span className="text-gray-600 font-medium">Profit / dish</span>
          <span
            className={`font-bold ${
              !item.hasRecipe
                ? "text-gray-400"
                : item.profit >= 0
                ? "text-green-600"
                : "text-red-600"
            }`}
          >
            {item.hasRecipe ? fmt(item.profit) : "—"}
          </span>
        </div>
      </div>

      {/* Ingredient breakdown — expandable */}
      {item.hasRecipe ? (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="w-full px-4 py-2 border-t border-gray-100 text-xs font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50 flex items-center justify-between transition-colors"
          >
            <span>
              {item.ingredients.length} ingredient
              {item.ingredients.length !== 1 ? "s" : ""}
            </span>
            {expanded ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
          </button>

          {expanded && (
            <div className="px-4 pb-3 space-y-1.5">
              {item.ingredients.map((ing) => (
                <div
                  key={ing.ingredientId}
                  className="flex justify-between items-center text-xs bg-gray-50 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-800">
                      {ing.name}
                    </span>
                    <span className="text-gray-400 ml-1.5">
                      {ing.qtyUsed} {ing.unit.toLowerCase()} × ₹
                      {ing.costPerUnit}/{ing.unit.toLowerCase()}
                    </span>
                  </div>
                  <span className="font-semibold text-gray-700 shrink-0 ml-2">
                    ₹{ing.lineCost.toFixed(3)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between text-xs font-bold text-gray-700 pt-1 border-t border-gray-200">
                <span>Total cost</span>
                <span>₹{item.ingredientCost.toFixed(3)}</span>
              </div>
            </div>
          )}

          {/* Edit recipe shortcut */}
          {onEditRecipe && (
            <div className="border-t border-gray-100 px-4 py-2">
              <button
                onClick={() => onEditRecipe({ id: item.id, name: item.name })}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg py-1.5 transition-colors"
              >
                <Pencil className="w-3 h-3" />
                Edit Recipe
              </button>
            </div>
          )}
        </>
      ) : (
        /* No recipe: prompt to add one */
        onEditRecipe && (
          <div className="border-t border-gray-100 px-4 py-3">
            <button
              onClick={() => onEditRecipe({ id: item.id, name: item.name })}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg py-1.5 transition-colors border border-dashed border-red-300"
            >
              <ChefHat className="w-3.5 h-3.5" />
              Add Recipe to see margin
            </button>
          </div>
        )
      )}
    </div>
  );
};

/* ─── Main exported component ─────────────────────────────────── */
const RecipeCostingTab = ({ onEditRecipe }) => {
  const [data, setData] = useState(null);
  const [tabLoading, setTabLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("marginPct");
  const [sortDir, setSortDir] = useState("asc");
  const [filterBand, setFilterBand] = useState("ALL");
  const abortRef = useRef(null);

  const fetchData = useCallback(async (silent = false) => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    if (!silent) setTabLoading(true);
    else setRefreshing(true);
    try {
      const res = await axios.get("/api/menu/recipe-costing", {
        signal: abortRef.current.signal,
      });
      setData(res.data);
    } catch (err) {
      if (err.name === "CanceledError" || err.name === "AbortError") return;
      showError("Failed to load recipe costing data");
    } finally {
      setTabLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  /* Re-fetch after the parent closes RecipeModal (recipe may have changed) */
  useEffect(() => {
    const handler = () => fetchData(true);
    window.addEventListener("recipe-saved", handler);
    return () => window.removeEventListener("recipe-saved", handler);
  }, [fetchData]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  /* Filter + sort */
  const displayed = useMemo(() => {
    if (!data) return [];
    let list = [...data.items];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
    }

    if (filterBand !== "ALL") {
      list = list.filter((i) => i.marginBand === filterBand);
    }

    list.sort((a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (av === null) av = sortDir === "asc" ? Infinity : -Infinity;
      if (bv === null) bv = sortDir === "asc" ? Infinity : -Infinity;
      if (typeof av === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [data, search, filterBand, sortKey, sortDir]);

  /* ── small reusable buttons ── */
  const SortBtn = ({ label, sKey }) => (
    <button
      onClick={() => toggleSort(sKey)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
        sortKey === sKey
          ? "bg-red-500 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
      {sortKey === sKey ? (
        sortDir === "asc" ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-40" />
      )}
    </button>
  );

  const FilterBtn = ({ label, band }) => (
    <button
      onClick={() => setFilterBand(band)}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        filterBand === band
          ? "bg-gray-800 text-white"
          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {label}
    </button>
  );

  /* ── Loading skeleton ── */
  if (tabLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm animate-pulse"
            >
              <div className="h-3 bg-gray-200 rounded w-20 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-16 mb-1" />
              <div className="h-2 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm animate-pulse h-44"
            />
          ))}
        </div>
      </div>
    );
  }

  const { summary } = data || {};

  return (
    <div className="space-y-5">
      {/* ── Sub-header ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm text-gray-500">
            Live profit margin per dish, calculated from ingredient costs.
            {summary && summary.itemsWithRecipe > 0 && (
              <span className="ml-1 text-gray-600 font-medium">
                {summary.itemsWithRecipe}/{summary.totalItems} dishes have full
                recipes.
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm disabled:opacity-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* ── Summary cards ──────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SummaryCard
            label="Avg Margin"
            value={
              summary.avgMarginPct !== null ? `${summary.avgMarginPct}%` : "—"
            }
            sub={`across ${summary.itemsWithRecipe} priced dishes`}
            icon={TrendingUp}
            borderColor="border-blue-200"
            bgColor="bg-blue-50"
          />
          <SummaryCard
            label="Lowest Margin"
            value={
              summary.lowestMarginItem
                ? `${summary.lowestMarginItem.marginPct?.toFixed(1)}%`
                : "—"
            }
            sub={summary.lowestMarginItem?.name || "No data"}
            icon={TrendingDown}
            borderColor="border-red-200"
            bgColor="bg-red-50"
          />
          <SummaryCard
            label="Below Cost"
            value={summary.negativeMarginCount}
            sub="dishes sold below cost"
            icon={AlertTriangle}
            borderColor={
              summary.negativeMarginCount > 0
                ? "border-red-400"
                : "border-green-200"
            }
            bgColor={
              summary.negativeMarginCount > 0 ? "bg-red-50" : "bg-green-50"
            }
          />
          <SummaryCard
            label="No Recipe"
            value={summary.itemsNoRecipe}
            sub="margins unknown"
            icon={Package}
            borderColor="border-gray-200"
            bgColor="bg-gray-50"
          />
        </div>
      )}

      {/* ── Alert: items below cost ─────────────────────────────── */}
      {summary?.negativeMarginCount > 0 && (
        <div className="bg-red-50 border-2 border-red-300 rounded-2xl px-5 py-4 flex items-start gap-3">
          <Flame className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-red-700 text-sm">
              {summary.negativeMarginCount} dish
              {summary.negativeMarginCount > 1 ? "es are" : " is"} selling BELOW
              cost!
            </p>
            <p className="text-red-600 text-xs mt-0.5">
              Filter by "🔴 Low" below, then use "Edit Recipe" on any card to
              fix ingredient quantities or adjust the price in Menu Management.
            </p>
          </div>
        </div>
      )}

      {/* ── Controls: search + filter + sort ───────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search dish or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-300"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Filter:
          </span>
          <FilterBtn label="All" band="ALL" />
          <FilterBtn label="🔴 Low (<30%)" band="LOW" />
          <FilterBtn label="🟡 Medium" band="MEDIUM" />
          <FilterBtn label="🟢 High (>60%)" band="HIGH" />
          <FilterBtn label="No Recipe" band="NO_RECIPE" />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
            Sort:
          </span>
          <SortBtn label="Margin" sKey="marginPct" />
          <SortBtn label="Profit" sKey="profit" />
          <SortBtn label="Price" sKey="sellingPrice" />
          <SortBtn label="Name" sKey="name" />
        </div>
      </div>

      {/* ── Count ──────────────────────────────────────────────── */}
      <p className="text-sm text-gray-500">
        Showing{" "}
        <span className="font-semibold text-gray-800">{displayed.length}</span>{" "}
        {displayed.length === 1 ? "dish" : "dishes"}
        {search && ` matching "${search}"`}
      </p>

      {/* ── Cards grid ─────────────────────────────────────────── */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">
            No dishes match your filters
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {displayed.map((item) => (
            <CostingItemCard
              key={item.id}
              item={item}
              onEditRecipe={onEditRecipe}
            />
          ))}
        </div>
      )}

      {/* ── Legend ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4 flex flex-wrap gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
          <span>
            <b className="text-gray-700">Low</b> — below 30% (reprice or reduce
            ingredient qty)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" />
          <span>
            <b className="text-gray-700">Medium</b> — 30–60%
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span>
            <b className="text-gray-700">High</b> — above 60% (promote these!)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5" />
          <span>
            Click <b className="text-gray-700">Edit Recipe</b> on any card to
            link ingredients and see its margin.
          </span>
        </div>
      </div>
    </div>
  );
};

export default RecipeCostingTab;
