"use client";

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminCard from "../../components/admin/AdminCard";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

const TOP_LIMIT_OPTIONS = [5, 10, 20];
const METRIC_OPTIONS = [
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "quantity", label: "Quantity" },
];

const truncateLabel = (value, max = 24) => {
  const text = String(value || "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const metricToSeriesKey = (metric) => {
  if (metric === "orders") return "ordersCount";
  if (metric === "quantity") return "totalSold";
  return "totalRevenue";
};

const metricToSeriesLabel = (metric) => {
  if (metric === "orders") return "Orders";
  if (metric === "quantity") return "Quantity";
  return "Revenue";
};

const formatMetricValue = (metric, value) => {
  const n = Number(value || 0);
  if (metric === "revenue") return `Rs ${n.toFixed(2)}`;
  return `${n}`;
};

const AnalyticsReportsPage = () => {
  const [overview, setOverview] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [topMeta, setTopMeta] = useState(null);
  const [topFarmers, setTopFarmers] = useState([]);
  const [complaintTrend, setComplaintTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  const [topLimit, setTopLimit] = useState(5);
  const [topMetric, setTopMetric] = useState("revenue");
  const [topRange, setTopRange] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const rangeSubtitle = useMemo(() => {
    if (topMeta?.rangeLabel) {
      return `Top Products - ${topMeta.rangeLabel} (Completed Orders)`;
    }
    const fallback = RANGE_OPTIONS.find((opt) => opt.value === topRange)?.label || "Last 30 Days";
    return `Top Products - ${fallback} (Completed Orders)`;
  }, [topMeta?.rangeLabel, topRange]);

  const buildTopQuery = () => {
    const params = new URLSearchParams();
    params.set("limit", String(topLimit));
    params.set("metric", topMetric);
    params.set("range", topRange);
    if (topRange === "custom") {
      if (customFrom) params.set("from", customFrom);
      if (customTo) params.set("to", customTo);
    }
    return params.toString();
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const topQuery = buildTopQuery();
      const [overviewRes, monthlyRes, topRes, farmersRes, complaintsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/analytics/sales`, tokenHeader()),
        axios.get(`${API_URL}/admin/analytics/monthly-revenue`, tokenHeader()),
        axios.get(`${API_URL}/admin/analytics/top-products?${topQuery}`, tokenHeader()),
        axios.get(`${API_URL}/admin/farmers`, tokenHeader()),
        axios.get(`${API_URL}/admin/complaints`, tokenHeader()),
      ]);

      setOverview(overviewRes.data.data || null);
      setMonthly(
        (monthlyRes.data.data || []).map((m) => ({
          month: m._id.month,
          revenue: m.totalRevenue,
          orders: m.ordersCount,
        }))
      );

      setTopMeta(topRes.data.meta || null);
      setTopProducts(
        (topRes.data.data || []).map((p) => ({
          ...p,
          productName: p.name || p.productName || `Product ${String(p._id || "").slice(-4)}`,
        }))
      );

      const farmers = farmersRes.data.data || [];
      setTopFarmers(
        farmers
          .map((f) => ({
            name: f.name,
            orders: f.performance?.ordersCount || 0,
            revenue: f.performance?.totalSales || 0,
          }))
          .sort((a, b) => b.orders - a.orders)
          .slice(0, 5)
      );

      const complaints = complaintsRes.data.data || [];
      const buckets = new Map();
      complaints.forEach((c) => {
        const d = new Date(c.createdAt);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const prev = buckets.get(key) || { month: d.getMonth() + 1, total: 0 };
        prev.total += 1;
        buckets.set(key, prev);
      });
      setComplaintTrend(Array.from(buckets.values()).sort((a, b) => a.month - b.month));
    } catch {
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLimit, topMetric, topRange, customFrom, customTo]);

  useEffect(() => {
    const id = setInterval(() => {
      loadData();
    }, 30000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topLimit, topMetric, topRange, customFrom, customTo]);

  const monthLabel = (m) =>
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
      (m || 1) - 1
    ];

  const seriesKey = metricToSeriesKey(topMetric);
  const seriesLabel = metricToSeriesLabel(topMetric);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Analytics & Reports</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track marketplace performance, revenue trends and top-performing products.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading analytics...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AdminCard
              title="Total Revenue"
              value={`Rs ${(overview?.totalRevenue || 0).toFixed(2)}`}
              subtitle="Completed paid orders"
            />
            <AdminCard
              title="Total Orders"
              value={overview?.ordersCount || 0}
              subtitle="Across all time"
              accent="orange"
            />
            <AdminCard
              title="Avg Order Value"
              value={
                overview && overview.ordersCount
                  ? `Rs ${(overview.totalRevenue / overview.ordersCount).toFixed(2)}`
                  : "Rs 0.00"
              }
              subtitle="Revenue / Order"
              accent="sky"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-green-100 p-6 shadow-lg shadow-green-100">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                Monthly Revenue
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthly}>
                    <defs>
                      <linearGradient id="analyticsRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16A34A" stopOpacity={0.85} />
                        <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5F5EA" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={monthLabel}
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `Rs ${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value) => [`Rs ${Number(value || 0).toFixed(2)}`, "Revenue"]}
                      labelFormatter={(label) => monthLabel(label)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #BBF7D0",
                        boxShadow: "0 10px 30px rgba(22,163,74,0.15)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#16A34A"
                      strokeWidth={3}
                      fill="url(#analyticsRevenue)"
                      animationDuration={1000}
                      activeDot={{ r: 6, strokeWidth: 0, fill: "#16A34A" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-green-100 p-6 shadow-lg shadow-green-100">
              <div className="flex items-center justify-between gap-2 mb-3">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500">
                  Top Products
                </h2>
                <Link
                  to="/admin/analytics/products"
                  className="text-[11px] font-bold text-green-700 hover:text-green-800"
                >
                  View Full Product Analytics &rarr;
                </Link>
              </div>
              <p className="text-xs text-gray-500 mb-3">{rangeSubtitle}</p>

              <div className="grid grid-cols-1 gap-2 mb-3">
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={topLimit}
                    onChange={(e) => setTopLimit(Number(e.target.value))}
                    className="px-2 py-2 rounded-xl border border-green-100 text-xs bg-white"
                  >
                    {TOP_LIMIT_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        Top {n}
                      </option>
                    ))}
                  </select>
                  <select
                    value={topMetric}
                    onChange={(e) => setTopMetric(e.target.value)}
                    className="px-2 py-2 rounded-xl border border-green-100 text-xs bg-white"
                  >
                    {METRIC_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={topRange}
                    onChange={(e) => setTopRange(e.target.value)}
                    className="px-2 py-2 rounded-xl border border-green-100 text-xs bg-white"
                  >
                    {RANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                {topRange === "custom" && (
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-green-100 text-xs bg-white"
                    />
                    <input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                      className="px-2 py-2 rounded-xl border border-green-100 text-xs bg-white"
                    />
                  </div>
                )}
              </div>

              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topProducts.map((row) => ({
                      ...row,
                      shortName: truncateLabel(row.productName, 22),
                    }))}
                    layout="vertical"
                    margin={{ left: 12, right: 16, top: 6, bottom: 6 }}
                  >
                    <defs>
                      <linearGradient id="topProductsGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#22C55E" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#16A34A" stopOpacity={0.7} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5F5EA" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 10, fill: "#6B7280" }}
                      tickFormatter={(v) => (topMetric === "revenue" ? `Rs ${Number(v || 0).toFixed(0)}` : `${v}`)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="shortName"
                      tick={{ fontSize: 10, fill: "#374151" }}
                      width={125}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [formatMetricValue(topMetric, value), seriesLabel]}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.productName || "Product"
                      }
                      contentStyle={{
                        borderRadius: 10,
                        border: "1px solid #BBF7D0",
                        boxShadow: "0 10px 24px rgba(22,163,74,0.12)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey={seriesKey}
                      fill="url(#topProductsGradient)"
                      radius={[0, 8, 8, 0]}
                      maxBarSize={24}
                      animationDuration={900}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-green-100 p-6 shadow-md shadow-green-50">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                Most Active Farmers
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topFarmers}>
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) =>
                        name === "orders" ? [value, "Orders"] : [`Rs ${Number(value || 0).toFixed(2)}`, "Revenue"]
                      }
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #BFDBFE",
                        boxShadow: "0 10px 30px rgba(59,130,246,0.15)",
                        fontSize: 12,
                      }}
                    />
                    <Bar
                      dataKey="orders"
                      fill="#16A34A"
                      radius={[8, 8, 0, 0]}
                      animationDuration={1000}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-green-100 p-6 shadow-md shadow-green-50">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                Complaint Trend
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={complaintTrend}>
                    <defs>
                      <linearGradient id="complaintsGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#FFEDD5" vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickFormatter={monthLabel}
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#4B5563" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value) => [value, "Complaints"]}
                      labelFormatter={(label) => monthLabel(label)}
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid #FED7AA",
                        boxShadow: "0 10px 30px rgba(249,115,22,0.15)",
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#F97316"
                      strokeWidth={2}
                      fill="url(#complaintsGradient)"
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AnalyticsReportsPage;
