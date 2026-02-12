import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import {
  BarChart3,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  Download,
  Calendar,
  Package,
  TrendingDown,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  Clock,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import Navbar from "../components/navbar";
import { showError } from "../utils/toast";

const ReportsPage = () => {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayOrders: 0,
    totalItemsSold: 0,
    lowStockCount: 0,
    topSellingItems: [],
    lowStockItems: [],
    salesByCategory: [],
    recentOrders: [],
    salesGrowth: 0,
    ordersGrowth: 0,
    itemsGrowth: 0,
    avgOrderValue: 0,
    paymentBreakdown: { cash: 0, card: 0, upi: 0 },
    peakHours: [],
    tableUtilization: 0,
  });

  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const [loading, setLoading] = useState(false);
  const [salesTrend, setSalesTrend] = useState([]);
  const [exporting, setExporting] = useState(false);

  // Memoize api instance
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: "http://localhost:5001/api",
    });

    instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/stats");
      setStats(res.data);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  }, [api]);

  const fetchSalesTrend = useCallback(async () => {
    try {
      const res = await api.get(
        `/reports/sales?from=${dateRange.from}&to=${dateRange.to}`,
      );
      if (res.data && Array.isArray(res.data)) {
        setSalesTrend(res.data);
      }
    } catch (err) {
      console.error("Failed to fetch sales trend:", err);
    }
  }, [api, dateRange.from, dateRange.to]);

  useEffect(() => {
    fetchStats();
    fetchSalesTrend();
  }, [fetchStats, fetchSalesTrend]);

  const handleRefresh = () => {
    fetchStats();
    fetchSalesTrend();
  };

  const downloadPDFReport = () => {
    try {
      setExporting(true);

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let yPosition = 15;
      const margin = 15;

      // Colors
      const primaryColor = [239, 68, 68];
      const textColor = [0, 0, 0];
      const lightGray = [200, 200, 200];

      // HEADER BAR
      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(0, 0, pageWidth, 30, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(20);
      pdf.setFont("helvetica", "bold");
      pdf.text("Business Reports & Analytics", margin, 15);

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text("Generated on: " + new Date().toLocaleString(), margin, 22);

      // DATE RANGE
      yPosition = 40;
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text(
        "Date Range: " + dateRange.from + " to " + dateRange.to,
        margin,
        yPosition,
      );
      yPosition += 8;

      pdf.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 8;

      // KEY METRICS
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text("KEY METRICS", margin, yPosition);
      yPosition += 8;

      const metrics = [
        {
          label: "Today's Sales",
          value: "₹" + Number(stats.todaySales || 0).toFixed(0),
          note: `${stats.salesGrowth >= 0 ? "+" : ""}${
            stats.salesGrowth
          }% vs yesterday`,
        },
        {
          label: "Orders Today",
          value: String(stats.todayOrders || 0),
          note: `${stats.ordersGrowth >= 0 ? "+" : ""}${
            stats.ordersGrowth
          }% vs yesterday`,
        },
        {
          label: "Items Sold",
          value: String(stats.totalItemsSold || 0),
          note: `${stats.itemsGrowth >= 0 ? "+" : ""}${
            stats.itemsGrowth
          }% vs yesterday`,
        },
        {
          label: "Avg Order Value",
          value: "₹" + Number(stats.avgOrderValue || 0).toFixed(0),
          note: "Per order average",
        },
      ];

      const metricsPerRow = 2;
      const metricWidth = (pageWidth - 2 * margin - 10) / metricsPerRow;

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");

      metrics.forEach((metric, index) => {
        const row = Math.floor(index / metricsPerRow);
        const col = index % metricsPerRow;
        const xPos = margin + col * (metricWidth + 10);
        const yPos = yPosition + row * 20;

        pdf.setFillColor(245, 245, 245);
        pdf.rect(xPos, yPos, metricWidth, 16, "F");
        pdf.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
        pdf.rect(xPos, yPos, metricWidth, 16);

        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(8);
        pdf.text(metric.label, xPos + 3, yPos + 5);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.text(metric.value, xPos + 3, yPos + 11);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        pdf.setTextColor(34, 197, 94);
        pdf.text(metric.note, xPos + 3, yPos + 15);
      });

      yPosition += 45;

      // TOP SELLING ITEMS
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 15;
      }

      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("TOP SELLING ITEMS", margin, yPosition);
      yPosition += 8;

      const headers = ["#", "Item Name", "Units Sold", "Revenue (₹)"];
      const colWidths = [10, 70, 25, 35];
      let x = margin;

      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 7, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");

      headers.forEach((h, i) => {
        pdf.text(h, x + 2, yPosition);
        x += colWidths[i];
      });

      yPosition += 6;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(8);

      if (stats.topSellingItems && stats.topSellingItems.length > 0) {
        stats.topSellingItems.slice(0, 5).forEach((item, idx) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          x = margin;
          pdf.text(String(idx + 1), x + 2, yPosition);
          x += colWidths[0];
          pdf.text(String(item.name || "").slice(0, 30), x + 2, yPosition);
          x += colWidths[1];
          pdf.text(String(item.totalSold || 0), x + 2, yPosition);
          x += colWidths[2];
          pdf.text(String(Math.round(item.revenue || 0)), x + 2, yPosition);
          yPosition += 5;
        });
      } else {
        pdf.text("No sales data available.", margin, yPosition);
        yPosition += 5;
      }

      yPosition += 8;

      // LOW STOCK ALERTS
      if (yPosition > pageHeight - 60) {
        pdf.addPage();
        yPosition = 15;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.text("LOW STOCK ALERTS", margin, yPosition);
      yPosition += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      if (stats.lowStockItems && stats.lowStockItems.length > 0) {
        stats.lowStockItems.forEach((item) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          pdf.setDrawColor(250, 204, 21);
          pdf.setFillColor(255, 251, 235);
          pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 9, "FD");

          pdf.setTextColor(180, 83, 9);
          pdf.setFont("helvetica", "bold");
          pdf.text(String(item.name || ""), margin + 3, yPosition);

          pdf.setTextColor(120, 53, 15);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7);
          pdf.text(
            "Only " + String(item.quantity || 0) + " units left.",
            margin + 3,
            yPosition + 4,
          );

          yPosition += 11;
        });
      } else {
        pdf.setTextColor(22, 163, 74);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("All items are well stocked.", margin, yPosition);
        yPosition += 6;
      }

      // FOOTER
      pdf.setFontSize(7);
      pdf.setTextColor(148, 163, 184);
      pdf.text(
        "Auto-generated report from Cafe POS Pro. For detailed analytics, use the dashboard.",
        margin,
        pageHeight - 10,
      );

      pdf.save("sales-report-" + Date.now() + ".pdf");
    } catch (e) {
      console.error(e);
      showError("Error generating PDF");
    } finally {
      setExporting(false);
    }
  };

  // Colors for pie chart
  const COLORS = [
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
  ];

  // // Payment breakdown data for pie chart
  // const paymentData = useMemo(
  //   () =>
  //     [
  //       { name: "Cash", value: stats.paymentBreakdown?.cash || 0 },
  //       { name: "Card", value: stats.paymentBreakdown?.card || 0 },
  //       { name: "UPI", value: stats.paymentBreakdown?.upi || 0 },
  //     ].filter((item) => item.value > 0),
  //   [stats.paymentBreakdown],
  // );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <BarChart3 className="w-7 h-7 mr-3 text-red-500" />
                Business Reports & Analytics
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-time performance tracking and insights
              </p>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                <Calendar className="w-4 h-4 text-gray-500" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, from: e.target.value })
                  }
                  className="text-sm bg-transparent focus:outline-none text-gray-700"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange({ ...dateRange, to: e.target.value })
                  }
                  className="text-sm bg-transparent focus:outline-none text-gray-700"
                />
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
                />
                <span>Refresh</span>
              </button>
              <button
                onClick={downloadPDFReport}
                disabled={exporting}
                className="px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                <span>{exporting ? "Exporting..." : "Export PDF"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-500">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Today's Sales */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Today's Sales
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      ₹{Number(stats.todaySales || 0).toLocaleString()}
                    </p>
                    <div className="flex items-center space-x-1 text-xs">
                      {stats.salesGrowth >= 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3 text-green-600" />
                          <span className="text-green-600 font-medium">
                            +{stats.salesGrowth}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-600" />
                          <span className="text-red-600 font-medium">
                            {stats.salesGrowth}%
                          </span>
                        </>
                      )}
                      <span className="text-gray-500">vs yesterday</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-7 h-7 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Orders Today */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Orders Today
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      {stats.todayOrders || 0}
                    </p>
                    <div className="flex items-center space-x-1 text-xs">
                      {stats.ordersGrowth >= 0 ? (
                        <>
                          <TrendingUp className="w-3 h-3 text-green-600" />
                          <span className="text-green-600 font-medium">
                            +{stats.ordersGrowth}%
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="w-3 h-3 text-red-600" />
                          <span className="text-red-600 font-medium">
                            {stats.ordersGrowth}%
                          </span>
                        </>
                      )}
                      <span className="text-gray-500">vs yesterday</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center">
                    <ShoppingCart className="w-7 h-7 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Average Order Value */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Avg Order Value
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mb-1">
                      ₹{Number(stats.avgOrderValue || 0).toFixed(0)}
                    </p>
                    <div className="flex items-center space-x-1 text-xs">
                      <span className="text-gray-500">
                        {stats.todayPaidOrders || 0} paid orders
                      </span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center">
                    <Package className="w-7 h-7 text-purple-600" />
                  </div>
                </div>
              </div>

              {/* Low Stock */}
              <div
                className={`rounded-2xl shadow-sm border p-6 hover:shadow-lg transition-shadow ${
                  (stats.lowStockCount || 0) > 0
                    ? "bg-gradient-to-br from-orange-500 to-red-500 text-white border-orange-300"
                    : "bg-white border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium mb-1 ${
                        (stats.lowStockCount || 0) > 0
                          ? "text-white/90"
                          : "text-gray-600"
                      }`}
                    >
                      Low Stock Alerts
                    </p>
                    <p
                      className={`text-3xl font-bold mb-1 ${
                        (stats.lowStockCount || 0) > 0
                          ? "text-white"
                          : "text-gray-900"
                      }`}
                    >
                      {stats.lowStockCount || 0}
                    </p>
                    <p
                      className={`text-xs ${
                        (stats.lowStockCount || 0) > 0
                          ? "text-white/80"
                          : "text-gray-500"
                      }`}
                    >
                      {(stats.lowStockCount || 0) > 0
                        ? "Action required"
                        : "All good!"}
                    </p>
                  </div>
                  <div
                    className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                      (stats.lowStockCount || 0) > 0
                        ? "bg-white/20"
                        : "bg-green-100"
                    }`}
                  >
                    <AlertTriangle
                      className={`w-7 h-7 ${
                        (stats.lowStockCount || 0) > 0
                          ? "text-white"
                          : "text-green-600"
                      }`}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Table Utilization */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Table Utilization
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.tableUtilization || 0}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {stats.occupiedTables || 0} of {stats.totalTables || 0}{" "}
                      tables occupied
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              {/* Items Sold Today */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      Items Sold Today
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalItemsSold || 0}
                    </p>
                    <div className="flex items-center space-x-1 text-xs mt-1">
                      {stats.itemsGrowth >= 0 ? (
                        <span className="text-green-600 font-medium">
                          +{stats.itemsGrowth}%
                        </span>
                      ) : (
                        <span className="text-red-600 font-medium">
                          {stats.itemsGrowth}%
                        </span>
                      )}
                      <span className="text-gray-500">vs yesterday</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Package className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <p className="text-sm font-medium text-gray-600 mb-3">
                  Payment Methods (Today)
                </p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Banknote className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-medium">
                        {stats.paymentBreakdown?.cash || 0}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">
                        {stats.paymentBreakdown?.card || 0}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Smartphone className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-medium">
                        {stats.paymentBreakdown?.upi || 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sales Trend */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-red-500" />
                  Sales Trend
                </h2>
                {salesTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="fullDate"
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                      />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                        }}
                        formatter={(value) => [`₹${value}`, "Sales"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="sales"
                        stroke="#ef4444"
                        strokeWidth={3}
                        dot={{ fill: "#ef4444", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No sales data for selected period
                  </div>
                )}
              </div>

              {/* Orders Trend */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <BarChart3 className="w-5 h-5 mr-2 text-blue-500" />
                  Order Volume
                </h2>
                {salesTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={salesTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="fullDate"
                        tick={{ fontSize: 11 }}
                        stroke="#9ca3af"
                      />
                      <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#fff",
                          border: "1px solid #e5e7eb",
                          borderRadius: "12px",
                        }}
                      />
                      <Bar
                        dataKey="orders"
                        fill="#3b82f6"
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No order data for selected period
                  </div>
                )}
              </div>
            </div>

            {/* Category Sales & Peak Hours */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Sales by Category */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6">
                  Sales by Category
                </h2>
                {stats.salesByCategory && stats.salesByCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={stats.salesByCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {stats.salesByCategory.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `₹${Math.round(value)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No category data available
                  </div>
                )}
              </div>

              {/* Peak Hours */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-orange-500" />
                  Peak Hours (Today)
                </h2>
                {stats.peakHours && stats.peakHours.length > 0 ? (
                  <div className="space-y-4">
                    {stats.peakHours.map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center space-x-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                              index === 0
                                ? "bg-red-100 text-red-600"
                                : index === 1
                                ? "bg-orange-100 text-orange-600"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            <span className="text-sm font-bold">
                              #{index + 1}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">
                            {item.hour.toString().padStart(2, "0")}:00 -{" "}
                            {(item.hour + 1).toString().padStart(2, "0")}:00
                          </span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {item.orders} orders
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    No order data for today
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Selling Items */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6">
                  Top Selling Items (Last 7 Days)
                </h2>
                {stats.topSellingItems && stats.topSellingItems.length > 0 ? (
                  <div className="space-y-4">
                    {stats.topSellingItems.slice(0, 5).map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200"
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                            <span className="text-lg font-bold text-red-600">
                              #{index + 1}
                            </span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {item.totalSold} sold • {item.category}
                            </p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-red-600">
                          ₹{Math.round(item.revenue || 0).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No sales data available</p>
                  </div>
                )}
              </div>

              {/* Low Stock Items */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-orange-500" />
                  Low Stock Alerts
                </h2>
                {stats.lowStockItems && stats.lowStockItems.length > 0 ? (
                  <div className="space-y-3">
                    {stats.lowStockItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-4 bg-orange-50 border border-orange-200 rounded-xl"
                      >
                        <div>
                          <h3 className="font-semibold text-orange-900">
                            {item.name}
                          </h3>
                          <p className="text-sm text-orange-600 mt-1">
                            Only {item.quantity || 0} left •{" "}
                            {item.category || "Uncategorized"}
                          </p>
                        </div>
                        <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">
                          Restock
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="w-16 h-16 text-green-200 mx-auto mb-3" />
                    <p className="text-green-600 font-semibold">
                      All items well stocked!
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      No action needed
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
