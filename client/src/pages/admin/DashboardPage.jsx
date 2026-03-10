"use client";

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import Loader from "../../components/Loader";
import AdminCard from "../../components/admin/AdminCard";
import StatusBadge from "../../components/admin/StatusBadge";

// All icons updated for react-icons/fa6 compatibility
import {
  FaUsers, 
  FaBox, 
  FaCartShopping,        // Updated from FaShoppingCart
  FaTriangleExclamation  // Updated from FaExclamationTriangle
} from "react-icons/fa6";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
} from "recharts";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const DashboardPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  const loadDashboard = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(data.data);
    } catch (err) {
      if (err?.response?.status === 401 || !localStorage.getItem("token")) {
        setData(null);
        return;
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    setMounted(true);
  }, []);

  if (loading || !data) {
    return <Loader />;
  }

  const { kpis, complaintDistribution, recentActivity, monthlySales } = data;
  const pendingComplaints =
    complaintDistribution?.find((c) => c._id === "open")?.count || 0;

  const monthlyData =
    monthlySales?.map((m) => ({
      month:
        ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][
          (m._id.month || 1) - 1
        ],
      revenue: m.totalAmount,
      orders: m.ordersCount,
    })) || [];

  return (
    <div
      className={`space-y-8 transition-all duration-500 ${
        mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Snapshot of farmers, products, orders and platform health.
          </p>
        </div>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AdminCard
          title="Farmers"
          value={kpis.farmers}
          subtitle="Active farmer accounts"
          icon={FaUsers}
        />
        <AdminCard
          title="Products"
          value={kpis.products}
          subtitle="Active marketplace listings"
          icon={FaBox}
          accent="sky"
        />
        <AdminCard
          title="Orders"
          value={kpis.orders}
          subtitle="All time orders"
          icon={FaCartShopping} // Updated reference
          accent="orange"
        />
        <AdminCard
          title="Complaints"
          value={kpis.complaints}
          subtitle={`${pendingComplaints} open`}
          icon={FaTriangleExclamation}
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D-style Revenue Area Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-green-100 shadow-lg shadow-green-100 p-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
            Monthly Revenue
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow
                      dx="0"
                      dy="10"
                      stdDeviation="8"
                      floodColor="#16A34A"
                      floodOpacity="0.15"
                    />
                  </filter>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5F5EA"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: "#4B5563" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#4B5563" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #BBF7D0",
                    boxShadow: "0 10px 30px rgba(22,163,74,0.15)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [`₹${value.toFixed(2)}`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#16A34A"
                  strokeWidth={3}
                  fill="url(#revenueGradient)"
                  animationDuration={1000}
                  filter="url(#shadow)"
                  activeDot={{ r: 6, strokeWidth: 0, fill: "#16A34A" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3D-style Orders Bar Chart */}
        <div className="bg-white rounded-2xl border border-green-100 shadow-lg shadow-green-100 p-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
            Monthly Orders
          </h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <defs>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22C55E" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#16A34A" stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#E5F5EA"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
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
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #BBF7D0",
                    boxShadow: "0 10px 30px rgba(22,163,74,0.15)",
                    fontSize: 12,
                  }}
                  formatter={(value) => [value, "Orders"]}
                />
                <Bar
                  dataKey="orders"
                  fill="url(#ordersGradient)"
                  radius={[8, 8, 0, 0]}
                  animationDuration={1000}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-green-100 shadow-md shadow-green-50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
              Complaint Status
            </h2>
            <Link
              to="/admin/complaints"
              className="text-xs font-bold text-green-700"
            >
              View all
            </Link>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {complaintDistribution?.length ? (
              complaintDistribution.map((c) => (
                <div
                  key={c._id}
                  className="px-4 py-2 rounded-xl bg-gray-50 border border-gray-100 flex items-center gap-2"
                >
                  <StatusBadge status={c._id} />
                  <span className="font-semibold text-gray-700">
                    {c.count}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">
                No complaints have been filed yet.
              </p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-green-100 shadow-md shadow-green-50 p-6">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
            Quick Links
          </h2>
          <div className="space-y-2 text-sm">
            <Link
              to="/admin/farmers"
              className="block text-green-700 font-semibold hover:underline"
            >
              Review farmers
            </Link>
            <Link
              to="/admin/kyc"
              className="block text-green-700 font-semibold hover:underline"
            >
              Verify farmer KYC
            </Link>
            <Link
              to="/admin/notifications"
              className="block text-green-700 font-semibold hover:underline"
            >
              Send notification
            </Link>
            <Link
              to="/admin/deals"
              className="block text-green-700 font-semibold hover:underline"
            >
              Monitor deals
            </Link>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-md shadow-green-50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
            Recent Admin Activity
          </h2>
          <Link
            to="/admin/activity-logs"
            className="text-xs font-bold text-green-700"
          >
            View logs
          </Link>
        </div>
        {recentActivity?.length ? (
          <ul className="divide-y divide-gray-100 text-sm">
            {recentActivity.map((log) => (
              <li key={log._id} className="py-2 flex justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{log.action}</p>
                  <p className="text-xs text-gray-500">
                    {log.description} by {log.admin?.name}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.createdAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">
            No admin actions recorded yet.
          </p>
        )}
      </div>
    </div>
  );
};

export default DashboardPage;
