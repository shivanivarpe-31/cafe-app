import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import axios from "axios";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import config from "../config/businessConfig";
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
  Printer,
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
import { Link } from "react-router-dom";
import Navbar from "../components/navbar";
import { showError, showSuccess } from "../utils/toast";

// Date range presets
const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "Yesterday", days: 1 },
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "This Month", days: "month" },
];

// Helper to calculate date range from preset
const getDateRangeFromPreset = (preset) => {
  const today = new Date();
  const to = today.toISOString().split("T")[0];

  if (preset.days === 0) {
    return { from: to, to };
  }

  if (preset.days === 1) {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    return { from: yesterdayStr, to: yesterdayStr };
  }

  if (preset.days === "month") {
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: firstOfMonth.toISOString().split("T")[0], to };
  }

  const from = new Date(Date.now() - preset.days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().split("T")[0], to };
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
    from: new Date().toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  });

  const [activePreset, setActivePreset] = useState("Today");
  const [loading, setLoading] = useState(true);
  const [salesTrend, setSalesTrend] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  // Abort controller ref for cleanup
  const abortControllerRef = useRef(null);
  const dateChangeTimeoutRef = useRef(null);

  // Chart refs for PDF export
  const salesChartRef = useRef(null);
  const ordersChartRef = useRef(null);
  const categoryChartRef = useRef(null);

  // Dynamic labels based on active preset
  const dayLabel = useMemo(() => {
    if (activePreset === "Yesterday") return "Yesterday's";
    return "Today's";
  }, [activePreset]);

  const comparisonLabel = useMemo(() => {
    if (activePreset === "Yesterday") return "vs day before";
    return "vs yesterday";
  }, [activePreset]);

  // Memoize api instance
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: "/api",
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

  const fetchStats = useCallback(
    async (signal, targetDate) => {
      try {
        const url = targetDate
          ? `/reports/stats?date=${targetDate}`
          : "/reports/stats";
        console.log("🔍 Fetching stats from URL:", url);
        const res = await api.get(url, { signal });
        console.log(
          "✅ Stats received, todaySales:",
          res.data.todaySales,
          "todayOrders:",
          res.data.todayOrders,
        );
        setStats(res.data);
        setError(null);
      } catch (err) {
        if (err.name === "AbortError" || err.name === "CanceledError") return;
        console.error("Failed to fetch stats:", err);
        setError("Failed to load stats. Click refresh to retry.");
      }
    },
    [api],
  );

  const fetchSalesTrend = useCallback(
    async (signal, fromDate, toDate) => {
      if (!fromDate || !toDate) {
        console.warn("fetchSalesTrend called without dates!");
        return;
      }
      try {
        console.log("📈 Fetching sales trend:", fromDate, "to", toDate);
        const res = await api.get(
          `/reports/sales?from=${fromDate}&to=${toDate}`,
          {
            signal,
          },
        );
        if (res.data && Array.isArray(res.data)) {
          console.log("✅ Sales trend data received:", res.data.length, "days");
          setSalesTrend(res.data);
        }
      } catch (err) {
        if (err.name === "AbortError" || err.name === "CanceledError") return;
        console.error("Failed to fetch sales trend:", err);
      }
    },
    [api],
  );

  const fetchAllData = useCallback(async () => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // Determine dates based on active preset
    const today = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const graphFrom = sevenDaysAgo.toISOString().split("T")[0];
    const graphTo = today.toISOString().split("T")[0];

    setLoading(true);
    try {
      await Promise.all([
        fetchStats(signal, null),
        fetchSalesTrend(signal, graphFrom, graphTo),
      ]);
    } finally {
      setLoading(false);
    }
  }, [fetchStats, fetchSalesTrend]);

  // Initial load only - run once on mount
  useEffect(() => {
    // Initial fetch: stats for today, trend for last 7 days
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const today = new Date();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const graphFrom = sevenDaysAgo.toISOString().split("T")[0];
    const graphTo = today.toISOString().split("T")[0];

    setLoading(true);
    Promise.all([
      fetchStats(signal, null),
      fetchSalesTrend(signal, graphFrom, graphTo),
    ]).finally(() => setLoading(false));

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (dateChangeTimeoutRef.current) {
        clearTimeout(dateChangeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced date range change handler
  const handleDateRangeChange = useCallback(
    (newRange) => {
      setDateRange(newRange);
      setActivePreset(null); // Clear preset when manually changing dates

      // Debounce the API call
      if (dateChangeTimeoutRef.current) {
        clearTimeout(dateChangeTimeoutRef.current);
      }
      dateChangeTimeoutRef.current = setTimeout(() => {
        fetchSalesTrend(
          abortControllerRef.current?.signal,
          newRange.from,
          newRange.to,
        );
      }, 500);
    },
    [fetchSalesTrend],
  );

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (preset) => {
      const range = getDateRangeFromPreset(preset);
      setDateRange(range);
      setActivePreset(preset.label);

      // Create new abort controller for these requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      // For "Today" and "Yesterday", show last 7 days in graphs for better visualization
      const today = new Date();
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const graphFrom = sevenDaysAgo.toISOString().split("T")[0];
      const graphTo = today.toISOString().split("T")[0];

      console.log("🔄 Preset selected:", preset.label);

      if (preset.label === "Today") {
        // Stats for today (default), graphs for last 7 days
        console.log(
          "📊 Fetching Today stats (no date param), graphs for last 7 days",
        );
        fetchStats(signal, null);
        fetchSalesTrend(signal, graphFrom, graphTo);
      } else if (preset.label === "Yesterday") {
        // Stats for yesterday, graphs for last 7 days
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        console.log(
          "📊 Fetching Yesterday stats for date:",
          yesterdayStr,
          ", graphs for last 7 days",
        );
        fetchStats(signal, yesterdayStr);
        fetchSalesTrend(signal, graphFrom, graphTo);
      } else {
        // For other presets, use the actual date range for both
        console.log(
          "📊 Fetching stats (default), graphs for range:",
          range.from,
          "to",
          range.to,
        );
        fetchStats(signal, null);
        fetchSalesTrend(signal, range.from, range.to);
      }
    },
    [fetchStats, fetchSalesTrend],
  );

  // Note: We no longer need the effect to refetch on date change since we call fetchSalesTrend directly

  const handleRefresh = () => {
    fetchAllData();
  };

  // Print function
  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const downloadPDFReport = async () => {
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
        "Report Period: " + dateRange.from + " to " + dateRange.to,
        margin,
        yPosition,
      );
      yPosition += 8;

      pdf.setDrawColor(lightGray[0], lightGray[1], lightGray[2]);
      pdf.line(margin, yPosition, pageWidth - margin, yPosition);
      yPosition += 10;

      // KEY METRICS
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text("KEY METRICS", margin, yPosition);
      yPosition += 10;

      const metrics = [
        {
          label: dayLabel + " Sales",
          value: "₹" + Number(stats.todaySales || 0).toLocaleString(),
          note: `${stats.salesGrowth >= 0 ? "+" : ""}${
            stats.salesGrowth
          }% ${comparisonLabel}`,
          positive: stats.salesGrowth >= 0,
        },
        {
          label:
            "Orders " + (activePreset === "Yesterday" ? "Yesterday" : "Today"),
          value: String(stats.todayOrders || 0),
          note: `${stats.ordersGrowth >= 0 ? "+" : ""}${
            stats.ordersGrowth
          }% ${comparisonLabel}`,
          positive: stats.ordersGrowth >= 0,
        },
        {
          label: "Items Sold",
          value: String(stats.totalItemsSold || 0),
          note: `${stats.itemsGrowth >= 0 ? "+" : ""}${
            stats.itemsGrowth
          }% ${comparisonLabel}`,
          positive: stats.itemsGrowth >= 0,
        },
        {
          label: "Avg Order Value",
          value: "₹" + Number(stats.avgOrderValue || 0).toFixed(0),
          note: "Per order average",
          positive: true,
        },
      ];

      const metricsPerRow = 2;
      const metricWidth = (pageWidth - 2 * margin - 10) / metricsPerRow;

      metrics.forEach((metric, index) => {
        const row = Math.floor(index / metricsPerRow);
        const col = index % metricsPerRow;
        const xPos = margin + col * (metricWidth + 10);
        const yPos = yPosition + row * 22;

        pdf.setFillColor(250, 250, 250);
        pdf.rect(xPos, yPos, metricWidth, 18, "F");
        pdf.setDrawColor(220, 220, 220);
        pdf.rect(xPos, yPos, metricWidth, 18);

        pdf.setTextColor(100, 100, 100);
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "normal");
        pdf.text(metric.label, xPos + 4, yPos + 5);

        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(metric.value, xPos + 4, yPos + 12);

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7);
        if (metric.positive) {
          pdf.setTextColor(34, 197, 94);
        } else {
          pdf.setTextColor(239, 68, 68);
        }
        pdf.text(metric.note, xPos + 4, yPos + 16);
      });

      yPosition += 50;

      // SALES TREND DATA TABLE
      if (yPosition > pageHeight - 80) {
        pdf.addPage();
        yPosition = 15;
      }

      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("SALES TREND (Last 7 Days)", margin, yPosition);
      yPosition += 8;

      // Table headers
      const trendHeaders = ["Date", "Sales (₹)", "Orders"];
      const trendColWidths = [60, 55, 35];
      let x = margin;

      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      trendHeaders.forEach((h, i) => {
        pdf.text(h, x + 3, yPosition);
        x += trendColWidths[i];
      });

      yPosition += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(9);

      if (salesTrend && salesTrend.length > 0) {
        salesTrend.forEach((day, idx) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          // Alternate row colors
          if (idx % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, "F");
          }

          x = margin;
          pdf.text(String(day.fullDate || ""), x + 3, yPosition);
          x += trendColWidths[0];
          pdf.text(String(day.sales?.toLocaleString() || 0), x + 3, yPosition);
          x += trendColWidths[1];
          pdf.text(String(day.orders || 0), x + 3, yPosition);
          yPosition += 7;
        });

        // Total row
        yPosition += 2;
        pdf.setFillColor(240, 240, 240);
        pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 8, "F");
        pdf.setFont("helvetica", "bold");
        x = margin;
        pdf.text("TOTAL", x + 3, yPosition);
        x += trendColWidths[0];
        pdf.text("₹" + totalSalesForPeriod.toLocaleString(), x + 3, yPosition);
        x += trendColWidths[1];
        pdf.text(String(totalOrdersForPeriod), x + 3, yPosition);
        yPosition += 12;
      } else {
        pdf.text(
          "No sales data available for the selected period.",
          margin,
          yPosition,
        );
        yPosition += 10;
      }

      // TOP SELLING ITEMS
      if (yPosition > pageHeight - 70) {
        pdf.addPage();
        yPosition = 15;
      }

      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.text("TOP SELLING ITEMS", margin, yPosition);
      yPosition += 8;

      const headers = ["#", "Item Name", "Units Sold", "Revenue (₹)"];
      const colWidths = [12, 75, 30, 40];
      x = margin;

      pdf.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      pdf.rect(margin, yPosition - 5, pageWidth - 2 * margin, 8, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");

      headers.forEach((h, i) => {
        pdf.text(h, x + 3, yPosition);
        x += colWidths[i];
      });

      yPosition += 7;
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.setFontSize(9);

      if (stats.topSellingItems && stats.topSellingItems.length > 0) {
        stats.topSellingItems.slice(0, 10).forEach((item, idx) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          if (idx % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 7, "F");
          }

          x = margin;
          pdf.text(String(idx + 1), x + 3, yPosition);
          x += colWidths[0];
          pdf.text(String(item.name || "").slice(0, 35), x + 3, yPosition);
          x += colWidths[1];
          pdf.text(String(item.totalSold || 0), x + 3, yPosition);
          x += colWidths[2];
          pdf.text(
            String(Math.round(item.revenue || 0).toLocaleString()),
            x + 3,
            yPosition,
          );
          yPosition += 7;
        });
      } else {
        pdf.text("No sales data available.", margin, yPosition);
        yPosition += 7;
      }

      yPosition += 10;

      // PAYMENT BREAKDOWN
      if (yPosition > pageHeight - 50) {
        pdf.addPage();
        yPosition = 15;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.text("PAYMENT BREAKDOWN", margin, yPosition);
      yPosition += 10;

      const paymentData = [
        {
          method: "Cash",
          count: stats.paymentBreakdown?.cash || 0,
          color: [34, 197, 94],
        },
        {
          method: "Card",
          count: stats.paymentBreakdown?.card || 0,
          color: [59, 130, 246],
        },
        {
          method: "UPI",
          count: stats.paymentBreakdown?.upi || 0,
          color: [139, 92, 246],
        },
      ];

      const totalPayments = paymentData.reduce((sum, p) => sum + p.count, 0);

      paymentData.forEach((payment, idx) => {
        const percentage =
          totalPayments > 0
            ? ((payment.count / totalPayments) * 100).toFixed(1)
            : 0;

        pdf.setFillColor(payment.color[0], payment.color[1], payment.color[2]);
        pdf.circle(margin + 3, yPosition - 1, 2.5, "F");

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
        pdf.text(
          `${payment.method}: ${payment.count} orders (${percentage}%)`,
          margin + 10,
          yPosition,
        );
        yPosition += 7;
      });

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
      pdf.setFontSize(9);

      if (stats.lowStockItems && stats.lowStockItems.length > 0) {
        stats.lowStockItems.forEach((item) => {
          if (yPosition > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          pdf.setDrawColor(250, 204, 21);
          pdf.setFillColor(255, 251, 235);
          pdf.rect(margin, yPosition - 4, pageWidth - 2 * margin, 10, "FD");

          pdf.setTextColor(180, 83, 9);
          pdf.setFont("helvetica", "bold");
          pdf.text(String(item.name || ""), margin + 4, yPosition);

          pdf.setTextColor(120, 53, 15);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(
            "Stock: " + String(item.quantity || 0) + " units remaining",
            margin + 4,
            yPosition + 5,
          );

          yPosition += 13;
        });
      } else {
        pdf.setTextColor(22, 163, 74);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("All items are well stocked.", margin, yPosition);
        yPosition += 8;
      }

      // CAPTURE CHARTS AS IMAGES
      // Add new page for charts
      pdf.addPage();
      yPosition = 15;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
      pdf.text("VISUAL ANALYTICS", margin, yPosition);
      yPosition += 10;

      // Capture Sales Chart
      if (salesChartRef.current) {
        try {
          const salesCanvas = await html2canvas(salesChartRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });
          const salesImgData = salesCanvas.toDataURL("image/png");
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (salesCanvas.height * imgWidth) / salesCanvas.width;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.text("Sales Trend", margin, yPosition);
          yPosition += 5;

          pdf.addImage(
            salesImgData,
            "PNG",
            margin,
            yPosition,
            imgWidth,
            Math.min(imgHeight, 70),
          );
          yPosition += Math.min(imgHeight, 70) + 15;
        } catch (e) {
          console.error("Error capturing sales chart:", e);
        }
      }

      // Capture Orders Chart
      if (ordersChartRef.current && yPosition < pageHeight - 80) {
        try {
          const ordersCanvas = await html2canvas(ordersChartRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });
          const ordersImgData = ordersCanvas.toDataURL("image/png");
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight =
            (ordersCanvas.height * imgWidth) / ordersCanvas.width;

          if (yPosition + imgHeight > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
          pdf.text("Order Volume", margin, yPosition);
          yPosition += 5;

          pdf.addImage(
            ordersImgData,
            "PNG",
            margin,
            yPosition,
            imgWidth,
            Math.min(imgHeight, 70),
          );
          yPosition += Math.min(imgHeight, 70) + 15;
        } catch (e) {
          console.error("Error capturing orders chart:", e);
        }
      }

      // Capture Category Chart
      if (categoryChartRef.current) {
        try {
          if (yPosition + 80 > pageHeight - 20) {
            pdf.addPage();
            yPosition = 15;
          }

          const categoryCanvas = await html2canvas(categoryChartRef.current, {
            scale: 2,
            backgroundColor: "#ffffff",
            logging: false,
          });
          const categoryImgData = categoryCanvas.toDataURL("image/png");
          const imgWidth = (pageWidth - 2 * margin) / 2;
          const imgHeight =
            (categoryCanvas.height * imgWidth) / categoryCanvas.width;

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(11);
          pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
          pdf.text("Sales by Category", margin, yPosition);
          yPosition += 5;

          pdf.addImage(
            categoryImgData,
            "PNG",
            margin,
            yPosition,
            imgWidth,
            Math.min(imgHeight, 70),
          );
        } catch (e) {
          console.error("Error capturing category chart:", e);
        }
      }

      // FOOTER on last page
      const totalPages = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(7);
        pdf.setTextColor(148, 163, 184);
        pdf.text(
          `${config.restaurant.name} - Business Report | Page ${i} of ${totalPages}`,
          margin,
          pageHeight - 8,
        );
      }

      pdf.save(
        "sales-report-" + dateRange.from + "-to-" + dateRange.to + ".pdf",
      );
      showSuccess("PDF report downloaded successfully!");
    } catch (e) {
      console.error(e);
      showError("Error generating PDF");
    } finally {
      setExporting(false);
    }
  };

  // Memoize total sales for period
  const totalSalesForPeriod = useMemo(() => {
    return salesTrend.reduce((sum, day) => sum + (day.sales || 0), 0);
  }, [salesTrend]);

  const totalOrdersForPeriod = useMemo(() => {
    return salesTrend.reduce((sum, day) => sum + (day.orders || 0), 0);
  }, [salesTrend]);

  // Skeleton loader component
  const SkeletonCard = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-gray-200 rounded mb-2"></div>
          <div className="h-8 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-20 bg-gray-200 rounded"></div>
        </div>
        <div className="w-14 h-14 bg-gray-200 rounded-2xl"></div>
      </div>
    </div>
  );

  const SkeletonChart = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 animate-pulse">
      <div className="h-6 w-40 bg-gray-200 rounded mb-6"></div>
      <div className="h-64 bg-gray-100 rounded-xl"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      <Navbar />

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 py-4 sm:py-6 print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center">
                  <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 mr-2 sm:mr-3 text-red-500 flex-shrink-0" />
                  <span className="truncate">Business Reports & Analytics</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  Real-time performance tracking and insights
                </p>
              </div>
            </div>

            {/* Date Range Presets */}
            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => handlePresetSelect(preset)}
                  className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                    activePreset === preset.label
                      ? "bg-red-500 text-white shadow-md"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Date Range Filter & Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200 flex-1 sm:flex-initial">
                <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    handleDateRangeChange({
                      ...dateRange,
                      from: e.target.value,
                    })
                  }
                  className="text-xs sm:text-sm bg-transparent focus:outline-none text-gray-700 w-full sm:w-auto"
                />
                <span className="text-gray-400 text-xs sm:text-sm">to</span>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    handleDateRangeChange({ ...dateRange, to: e.target.value })
                  }
                  className="text-xs sm:text-sm bg-transparent focus:outline-none text-gray-700 w-full sm:w-auto"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 disabled:opacity-50 text-xs sm:text-sm"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${
                      loading ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={handlePrint}
                  className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 text-xs sm:text-sm"
                  title="Print Report"
                >
                  <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={downloadPDFReport}
                  disabled={exporting}
                  className="flex-1 sm:flex-initial px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center space-x-1.5 sm:space-x-2 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                >
                  <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>{exporting ? "..." : "PDF"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="text-red-700">{error}</span>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <>
            {/* Skeleton Loading */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <SkeletonChart />
              <SkeletonChart />
            </div>
          </>
        ) : (
          <>
            {/* Period Summary (for date range) - hidden for Today/Yesterday */}
            {salesTrend.length > 1 &&
              activePreset !== "Today" &&
              activePreset !== "Yesterday" && (
                <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-2xl p-6 text-white">
                  <h3 className="text-sm font-medium text-white/80 mb-2">
                    Period Summary ({dateRange.from} to {dateRange.to})
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-3xl font-bold">
                        ₹{totalSalesForPeriod.toLocaleString()}
                      </p>
                      <p className="text-sm text-white/80">Total Sales</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        {totalOrdersForPeriod}
                      </p>
                      <p className="text-sm text-white/80">Total Orders</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">
                        ₹
                        {totalOrdersForPeriod > 0
                          ? Math.round(
                              totalSalesForPeriod / totalOrdersForPeriod,
                            )
                          : 0}
                      </p>
                      <p className="text-sm text-white/80">Avg Order Value</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{salesTrend.length}</p>
                      <p className="text-sm text-white/80">Days</p>
                    </div>
                  </div>
                </div>
              )}

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Sales */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {dayLabel} Sales
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
                      <span className="text-gray-500">{comparisonLabel}</span>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center">
                    <DollarSign className="w-7 h-7 text-red-600" />
                  </div>
                </div>
              </div>

              {/* Orders */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">
                      {activePreset === "Yesterday"
                        ? "Orders (Yesterday)"
                        : "Orders Today"}
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
                      <span className="text-gray-500">{comparisonLabel}</span>
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
                      {activePreset === "Yesterday"
                        ? "Items Sold (Yesterday)"
                        : "Items Sold Today"}
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
                      <span className="text-gray-500">{comparisonLabel}</span>
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
                  Payment Methods (
                  {activePreset === "Yesterday" ? "Yesterday" : "Today"})
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
              <div
                ref={salesChartRef}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
              >
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
                        formatter={(value) => [
                          `₹${value.toLocaleString()}`,
                          "Sales",
                        ]}
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
              <div
                ref={ordersChartRef}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
              >
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
              <div
                ref={categoryChartRef}
                className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6"
              >
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
                      <Tooltip
                        formatter={(value) =>
                          `₹${Math.round(value).toLocaleString()}`
                        }
                      />
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
                  Peak Hours (
                  {activePreset === "Yesterday" ? "Yesterday" : "Today"})
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
                        <Link
                          to="/inventory"
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
                        >
                          Restock
                        </Link>
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
