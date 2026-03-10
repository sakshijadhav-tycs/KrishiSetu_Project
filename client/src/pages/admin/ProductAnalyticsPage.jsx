"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const RANGE_OPTIONS = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "custom", label: "Custom Range" },
];

const METRIC_OPTIONS = [
  { value: "revenue", label: "Revenue" },
  { value: "orders", label: "Orders" },
  { value: "quantity", label: "Quantity" },
];

const ProductAnalyticsPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [farmers, setFarmers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [meta, setMeta] = useState(null);

  const [range, setRange] = useState("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [metric, setMetric] = useState("revenue");
  const [sortOrder, setSortOrder] = useState("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const buildQuery = () => {
    const params = new URLSearchParams();
    params.set("range", range);
    params.set("metric", metric);
    params.set("sortBy", metric);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (range === "custom") {
      if (from) params.set("from", from);
      if (to) params.set("to", to);
    }
    if (categoryId) params.set("categoryId", categoryId);
    if (farmerId) params.set("farmerId", farmerId);
    if (search.trim()) params.set("search", search.trim());
    return params.toString();
  };

  const loadFilters = async () => {
    try {
      const [categoryRes, farmerRes] = await Promise.all([
        axios.get(`${API_URL}/categories`, tokenHeader()),
        axios.get(`${API_URL}/admin/farmers?limit=500`, tokenHeader()),
      ]);
      setCategories(categoryRes.data?.data || []);
      setFarmers(farmerRes.data?.data || []);
    } catch {
      setCategories([]);
      setFarmers([]);
    }
  };

  const loadTable = async () => {
    try {
      setLoading(true);
      const query = buildQuery();
      const { data } = await axios.get(
        `${API_URL}/admin/analytics/products-table?${query}`,
        tokenHeader()
      );
      setRows(data?.data || []);
      setPagination(data?.pagination || { page: 1, limit, total: 0 });
      setMeta(data?.meta || null);
    } catch {
      setRows([]);
      setPagination({ page: 1, limit, total: 0 });
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = async () => {
    try {
      const query = buildQuery();
      const response = await axios.get(`${API_URL}/admin/analytics/products-export?${query}`, {
        ...tokenHeader(),
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `product-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      // noop to keep UX non-blocking
    }
  };

  useEffect(() => {
    loadFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadTable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, range, from, to, categoryId, farmerId, metric, sortOrder, search]);

  const totalPages = useMemo(() => {
    const total = Number(pagination.total || 0);
    const pageSize = Number(pagination.limit || limit || 20);
    return Math.max(1, Math.ceil(total / pageSize));
  }, [pagination.total, pagination.limit, limit]);

  const rangeLabel = meta?.rangeLabel || RANGE_OPTIONS.find((r) => r.value === range)?.label;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Full Product Analytics</h1>
          <p className="text-sm text-gray-500 mt-1">
            {`Top products performance by ${metric} - ${rangeLabel || "Last 30 Days"} (Completed Orders)`}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700"
        >
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-green-100 p-4 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <select
            value={range}
            onChange={(e) => {
              setPage(1);
              setRange(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          >
            {RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={metric}
            onChange={(e) => {
              setPage(1);
              setMetric(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort by {opt.label}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => {
              setPage(1);
              setSortOrder(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          >
            <option value="desc">High to Low</option>
            <option value="asc">Low to High</option>
          </select>
          <select
            value={categoryId}
            onChange={(e) => {
              setPage(1);
              setCategoryId(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={farmerId}
            onChange={(e) => {
              setPage(1);
              setFarmerId(e.target.value);
            }}
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          >
            <option value="">All Farmers</option>
            {farmers.map((f) => (
              <option key={f._id} value={f._id}>
                {f.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search product..."
            className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
          />
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPage(1);
                setFrom(e.target.value);
              }}
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPage(1);
                setTo(e.target.value);
              }}
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            />
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading product analytics...</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Category
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Farmer
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Orders
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.productId} className="border-t border-gray-50 hover:bg-green-50">
                      <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                        {row.productName}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {row.categoryName || row.categoryId || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600">
                        {row.farmerName || row.farmerId || "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700">
                        {Number(row.orders || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-700">
                        {Number(row.quantity || 0)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                        Rs {Number(row.revenue || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setPage(1);
                    setLimit(Number(e.target.value));
                  }}
                  className="px-2 py-1 rounded-lg border border-green-100 bg-white"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <span>
                Page {pagination.page || page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={(pagination.page || page) <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={(pagination.page || page) >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProductAnalyticsPage;
