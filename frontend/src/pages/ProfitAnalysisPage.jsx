import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  Calendar,
  ChevronDown,
  ChevronUp,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import Navbar from "../components/navbar";

// Quick date presets
const DATE_PRESETS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "This Year", days: "year" },
];

const ProfitAnalysisPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePreset, setActivePreset] = useState("Last 30 Days");
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });
  const [expandedItem, setExpandedItem] = useState(null);
  const [sortBy, setSortBy] = useState("profitMargin"); // profitMargin, totalProfit, unitsSold
  const [sortOrder, setSortOrder] = useState("desc");

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: "/api",
    });
    instance.interceptors.request.use((config) => {
      const token = localStorage.getItem("token");
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });
    return instance;
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(
        `/reports/profit-analysis?from=${dateRange.from}&to=${dateRange.to}`,
      );
      setData(res.data);
    } catch (err) {
      console.error("Failed to fetch profit analysis:", err);
    } finally {
      setLoading(false);
    }
  }, [api, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedItems = useMemo(() => {
    if (!data?.allItems) return [];
    return [...data.allItems].sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
    });
  }, [data, sortBy, sortOrder]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getProfitColor = (margin) => {
    if (margin >= 60) return "text-green-600 bg-green-100";
    if (margin >= 40) return "text-blue-600 bg-blue-100";
    if (margin >= 20) return "text-yellow-600 bg-yellow-100";
    return "text-red-600 bg-red-100";
  };

  const getBarColor = (margin) => {
    if (margin >= 60) return "#22c55e";
    if (margin >= 40) return "#3b82f6";
    if (margin >= 20) return "#eab308";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="bg-white border-b border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-6">
            <div className="animate-pulse">
              <div className="h-8 w-48 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 w-64 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
                    <div className="h-8 w-32 bg-gray-200 rounded"></div>
                  </div>
                  <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse"
              >
                <div className="h-6 w-40 bg-gray-200 rounded mb-6"></div>
                <div className="h-64 bg-gray-100 rounded-xl"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <DollarSign className="w-7 h-7 mr-3 text-green-500" />
                Profit Analysis
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Analyze profit margins and costs for all menu items
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Quick Presets */}
              <div className="flex rounded-xl border border-gray-200 overflow-hidden">
                {DATE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setActivePreset(preset.label);
                      const today = new Date();
                      const to = today.toISOString().split("T")[0];
                      let from;
                      if (preset.days === "year") {
                        from = new Date(today.getFullYear(), 0, 1)
                          .toISOString()
                          .split("T")[0];
                      } else {
                        from = new Date(
                          Date.now() - preset.days * 24 * 60 * 60 * 1000,
                        )
                          .toISOString()
                          .split("T")[0];
                      }
                      setDateRange({ from, to });
                    }}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${
                      activePreset === preset.label
                        ? "bg-green-500 text-white"
                        : "bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, from: e.target.value });
                    setActivePreset(null);
                  }}
                  className="text-sm bg-transparent focus:outline-none"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => {
                    setDateRange({ ...dateRange, to: e.target.value });
                    setActivePreset(null);
                  }}
                  className="text-sm bg-transparent focus:outline-none"
                />
              </div>
              <button
                onClick={fetchData}
                className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Summary Cards */}
        {data?.summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900">
                    ₹{data.summary.totalRevenue.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Cost</p>
                  <p className="text-2xl font-bold text-red-600">
                    ₹{data.summary.totalCost.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Profit</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₹{data.summary.totalProfit.toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl shadow-sm p-6 text-white hover:shadow-lg transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-100">Avg Profit Margin</p>
                  <p className="text-3xl font-bold">
                    {data.summary.avgProfitMargin}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warnings */}
        {data?.noRecipe?.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <p className="text-orange-800">
                <span className="font-semibold">
                  {data.noRecipe.length} items
                </span>{" "}
                have no recipe defined. Add recipes to calculate accurate profit
                margins.
              </p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.noRecipe.slice(0, 5).map((item) => (
                <span
                  key={item.id}
                  className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full"
                >
                  {item.name}
                </span>
              ))}
              {data.noRecipe.length > 5 && (
                <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                  +{data.noRecipe.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Profit Margin Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Best Performers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-500" />
              Best Profit Margins
            </h2>
            {data?.bestPerformers && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.bestPerformers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Profit Margin"]}
                    contentStyle={{ borderRadius: "12px" }}
                  />
                  <Bar dataKey="profitMargin" radius={[0, 8, 8, 0]}>
                    {data.bestPerformers.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(entry.profitMargin)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Worst Performers */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <TrendingDown className="w-5 h-5 mr-2 text-red-500" />
              Needs Attention (Lowest Margins)
            </h2>
            {data?.worstPerformers && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.worstPerformers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value) => [`${value}%`, "Profit Margin"]}
                    contentStyle={{ borderRadius: "12px" }}
                  />
                  <Bar dataKey="profitMargin" radius={[0, 8, 8, 0]}>
                    {data.worstPerformers.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={getBarColor(entry.profitMargin)}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* All Items Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">All Menu Items</h2>
            <p className="text-sm text-gray-500">
              Click on an item to see ingredient breakdown
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase">
                    Item
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">
                    Price
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">
                    Cost
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase">
                    Profit
                  </th>
                  <th
                    className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("profitMargin")}
                  >
                    <span className="flex items-center justify-end space-x-1">
                      <span>Margin</span>
                      {sortBy === "profitMargin" &&
                        (sortOrder === "desc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("unitsSold")}
                  >
                    <span className="flex items-center justify-end space-x-1">
                      <span>Sold</span>
                      {sortBy === "unitsSold" &&
                        (sortOrder === "desc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </span>
                  </th>
                  <th
                    className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("totalProfit")}
                  >
                    <span className="flex items-center justify-end space-x-1">
                      <span>Total Profit</span>
                      {sortBy === "totalProfit" &&
                        (sortOrder === "desc" ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        ))}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sortedItems.map((item) => (
                  <React.Fragment key={item.id}>
                    <tr
                      className="hover:bg-green-50 cursor-pointer transition-colors"
                      onClick={() =>
                        setExpandedItem(
                          expandedItem === item.id ? null : item.id,
                        )
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          {item.ingredientCount === 0 && (
                            <AlertTriangle
                              className="w-4 h-4 text-orange-500"
                              title="No recipe defined"
                            />
                          )}
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        ₹{item.sellingPrice}
                      </td>
                      <td className="px-6 py-4 text-right text-red-600">
                        ₹{item.ingredientCost}
                      </td>
                      <td className="px-6 py-4 text-right text-green-600 font-medium">
                        ₹{item.profit}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${getProfitColor(
                            item.profitMargin,
                          )}`}
                        >
                          {item.profitMargin}%
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {item.unitsSold}
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-green-600">
                        ₹{item.totalProfit.toLocaleString()}
                      </td>
                    </tr>

                    {/* Expanded ingredient breakdown */}
                    {expandedItem === item.id && item.ingredients.length > 0 && (
                      <tr>
                        <td colSpan="7" className="px-6 py-4 bg-gray-50">
                          <div className="pl-8">
                            <p className="text-sm font-semibold text-gray-700 mb-3">
                              Ingredient Breakdown:
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              {item.ingredients.map((ing, idx) => (
                                <div
                                  key={idx}
                                  className="bg-white p-3 rounded-lg border border-gray-200"
                                >
                                  <p className="font-medium text-gray-900">
                                    {ing.name}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {ing.quantity} {ing.unit.toLowerCase()}
                                  </p>
                                  <p className="text-sm text-red-600">
                                    Cost: ₹{ing.totalCost}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
          <div className="flex items-center space-x-2 mb-4">
            <Info className="w-5 h-5 text-gray-500" />
            <h3 className="font-semibold text-gray-900">Profit Margin Guide</h3>
          </div>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-50 rounded-lg">
              <span className="w-4 h-4 rounded bg-green-500"></span>
              <span className="text-sm font-medium text-green-700">
                Excellent (60%+)
              </span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
              <span className="w-4 h-4 rounded bg-blue-500"></span>
              <span className="text-sm font-medium text-blue-700">
                Good (40-60%)
              </span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-yellow-50 rounded-lg">
              <span className="w-4 h-4 rounded bg-yellow-500"></span>
              <span className="text-sm font-medium text-yellow-700">
                Fair (20-40%)
              </span>
            </div>
            <div className="flex items-center space-x-2 px-3 py-2 bg-red-50 rounded-lg">
              <span className="w-4 h-4 rounded bg-red-500"></span>
              <span className="text-sm font-medium text-red-700">
                Low (&lt;20%)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfitAnalysisPage;
