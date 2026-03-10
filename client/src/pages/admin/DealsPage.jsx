"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const statusChipClass = {
  active: "bg-green-100 text-green-800",
  scheduled: "bg-blue-100 text-blue-800",
  expired: "bg-gray-100 text-gray-700",
  disabled: "bg-red-100 text-red-800",
};

const discountLabel = (deal) => {
  const price = Number(deal?.productId?.price || 0);
  if (deal.discountType === "percentage") return `${Number(deal.discountValue || 0)}%`;
  const fixedPrice = Number(deal.discountValue || 0);
  if (price <= 0) return `Rs ${fixedPrice.toFixed(2)}`;
  const derived = ((price - fixedPrice) / price) * 100;
  return `${derived > 0 ? derived.toFixed(1) : "0.0"}% (Fixed Rs ${fixedPrice.toFixed(2)})`;
};

const DealsPage = () => {
  const [statusFilter, setStatusFilter] = useState("all");
  const [deals, setDeals] = useState([]);
  const [analytics, setAnalytics] = useState({
    totalDealRevenue: 0,
    topPerformingProducts: [],
    topFarmersByDealSales: [],
  });
  const [loading, setLoading] = useState(true);
  const [disablingId, setDisablingId] = useState(null);

  const tokenHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  const loadDeals = async (status = "all") => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/deals/admin?status=${status}`, tokenHeader);
      setDeals(data?.data || []);
      setAnalytics(
        data?.analytics || {
          totalDealRevenue: 0,
          topPerformingProducts: [],
          topFarmersByDealSales: [],
        }
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeals(statusFilter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onStatusChange = async (value) => {
    setStatusFilter(value);
    await loadDeals(value);
  };

  const disableDeal = async (dealId) => {
    try {
      setDisablingId(dealId);
      await axios.patch(
        `${API_URL}/deals/${dealId}/admin-disable`,
        { reason: "Disabled by admin moderation" },
        tokenHeader
      );
      toast.success("Deal disabled");
      await loadDeals(statusFilter);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to disable deal");
    } finally {
      setDisablingId(null);
    }
  };

  const activeDeals = deals.filter((d) => d.dealStatus === "active" || d.dealStatus === "scheduled");
  const expiredDeals = deals.filter((d) => d.dealStatus === "expired");

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Deals Monitoring</h1>
          <p className="text-sm text-gray-500">View active/expired deals, moderate inappropriate discounts, and track deal analytics.</p>
        </div>
        <select
          className="border rounded-lg px-3 py-2 text-sm w-52"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          <option value="all">All Deals</option>
          <option value="active">Active Deals</option>
          <option value="scheduled">Scheduled Deals</option>
          <option value="expired">Expired Deals</option>
          <option value="disabled">Disabled Deals</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-black text-gray-500">Total Deal Revenue</p>
          <p className="text-2xl font-black text-green-700">Rs {Number(analytics.totalDealRevenue || 0).toFixed(2)}</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-black text-gray-500">Top Deal Product</p>
          <p className="text-sm font-black text-gray-800">
            {analytics.topPerformingProducts?.[0]?.productName || "N/A"}
          </p>
          <p className="text-xs text-gray-500">
            Rs {Number(analytics.topPerformingProducts?.[0]?.revenue || 0).toFixed(2)}
          </p>
        </div>
        <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-xs uppercase tracking-widest font-black text-gray-500">Top Farmer by Deal Sales</p>
          <p className="text-sm font-black text-gray-800">
            {analytics.topFarmersByDealSales?.[0]?.farmerName || "N/A"}
          </p>
          <p className="text-xs text-gray-500">
            Rs {Number(analytics.topFarmersByDealSales?.[0]?.revenue || 0).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">Active Deals</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Product</th>
                  <th className="py-2">Farmer</th>
                  <th className="py-2">Discount %</th>
                  <th className="py-2">Revenue</th>
                  <th className="py-2">Status</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeDeals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-gray-500">
                      No active/scheduled deals.
                    </td>
                  </tr>
                )}
                {activeDeals.map((deal) => (
                  <tr key={deal._id} className="border-b">
                    <td className="py-3 font-semibold">{deal?.productId?.name || "Unknown Product"}</td>
                    <td className="py-3">{deal?.farmerId?.name || "Unknown Farmer"}</td>
                    <td className="py-3">{discountLabel(deal)}</td>
                    <td className="py-3">Rs {Number(deal?.revenue?.revenue || 0).toFixed(2)}</td>
                    <td className="py-3">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-full ${
                          statusChipClass[deal.dealStatus] || "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {deal.dealStatus}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        className="bg-red-600 text-white text-xs font-bold px-3 py-1 rounded-md disabled:opacity-60"
                        onClick={() => disableDeal(deal._id)}
                        disabled={disablingId === deal._id}
                      >
                        {disablingId === deal._id ? "Disabling..." : "Disable"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
        <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">Expired Deals</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Product</th>
                <th className="py-2">Farmer</th>
                <th className="py-2">Discount %</th>
                <th className="py-2">Revenue</th>
                <th className="py-2">Ended On</th>
              </tr>
            </thead>
            <tbody>
              {expiredDeals.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-gray-500">
                    No expired deals.
                  </td>
                </tr>
              )}
              {expiredDeals.map((deal) => (
                <tr key={deal._id} className="border-b">
                  <td className="py-3 font-semibold">{deal?.productId?.name || "Unknown Product"}</td>
                  <td className="py-3">{deal?.farmerId?.name || "Unknown Farmer"}</td>
                  <td className="py-3">{discountLabel(deal)}</td>
                  <td className="py-3">Rs {Number(deal?.revenue?.revenue || 0).toFixed(2)}</td>
                  <td className="py-3">{new Date(deal.endDate).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DealsPage;
