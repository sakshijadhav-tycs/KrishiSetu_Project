"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import Loader from "../../components/Loader";
import {
  FaBoxOpen,
  FaSearch,
  FaShoppingBasket,
  FaTimes,
} from "react-icons/fa";
import AdminCard from "../../components/admin/AdminCard";
import { useLocation, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const OrdersPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const ordersListRef = useRef(null);
  const settlementLedgerRef = useRef(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, limit: 20 });
  const [stats, setStats] = useState([]);
  const [overview, setOverview] = useState({});
  const [globalOverview, setGlobalOverview] = useState(null);
  const [settlementSummary, setSettlementSummary] = useState(null);
  const [settlementLedger, setSettlementLedger] = useState([]);
  const [settlementLoading, setSettlementLoading] = useState(false);
  const [settlementPagination, setSettlementPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
  });
  const [settlementFilters, setSettlementFilters] = useState({
    from: "",
    to: "",
    farmerId: "",
    status: "all",
    settlementType: "all",
    overdueOnly: false,
  });
  const [farmerOptions, setFarmerOptions] = useState([]);
  const [returnRequests, setReturnRequests] = useState([]);
  const [returnRequestsLoading, setReturnRequestsLoading] = useState(false);

  const normalizeFilterValue = (value, allowed) => {
    const normalized = String(value || "all").toLowerCase();
    return allowed.has(normalized) ? normalized : "all";
  };

  const getFiltersFromQuery = (search) => {
    const params = new URLSearchParams(search || "");
    return {
      statusFilter: normalizeFilterValue(
        params.get("status"),
        new Set([
          "all",
          "pending",
          "accepted",
          "processing",
          "shipped",
          "delivered",
          "completed",
          "rejected",
          "cancelled",
        ])
      ),
      categoryFilter: normalizeFilterValue(
        params.get("category"),
        new Set(["all", "split", "single", "subscription"])
      ),
      paymentFilter: normalizeFilterValue(
        params.get("paymentMethod"),
        new Set(["all", "razorpay", "cod"])
      ),
      searchTerm: String(params.get("search") || ""),
      fromDate: String(params.get("from") || ""),
      toDate: String(params.get("to") || ""),
      page: Number(params.get("page") || 1) > 0 ? Number(params.get("page") || 1) : 1,
    };
  };

  const buildSearchParams = (filters) => {
    const params = new URLSearchParams();
    if (filters.statusFilter && filters.statusFilter !== "all")
      params.set("status", filters.statusFilter);
    if (filters.categoryFilter && filters.categoryFilter !== "all")
      params.set("category", filters.categoryFilter);
    if (filters.paymentFilter && filters.paymentFilter !== "all")
      params.set("paymentMethod", filters.paymentFilter);
    if (filters.fromDate) params.set("from", filters.fromDate);
    if (filters.toDate) params.set("to", filters.toDate);
    if (filters.searchTerm?.trim()) params.set("search", filters.searchTerm.trim());
    if ((filters.page || 1) > 1) params.set("page", String(filters.page));
    return params.toString();
  };

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadGlobalOverview = async () => {
    try {
      if (globalOverview) return;
      const params = new URLSearchParams();
      params.set("page", "1");
      params.set("limit", "1");
      const { data } = await axios.get(
        `${API_URL}/admin/orders?${params.toString()}`,
        tokenHeader()
      );
      setGlobalOverview(data?.overview || {});
    } catch {
      setGlobalOverview({});
    }
  };

  const loadSettlementSummary = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/settlements/summary`, tokenHeader());
      setSettlementSummary(data?.data || null);
    } catch {
      setSettlementSummary(null);
    }
  };

  const loadFarmerOptions = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/admin/farmers?limit=500`, tokenHeader());
      setFarmerOptions(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setFarmerOptions([]);
    }
  };

  const loadReturnRequests = async () => {
    try {
      setReturnRequestsLoading(true);
      const { data } = await axios.get(
        `${API_URL}/transparent-orders/admin/return-requests`,
        tokenHeader()
      );
      setReturnRequests(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setReturnRequests([]);
    } finally {
      setReturnRequestsLoading(false);
    }
  };

  const loadSettlementLedger = async (override = {}) => {
    try {
      setSettlementLoading(true);
      const params = new URLSearchParams();
      const effective = {
        ...settlementFilters,
        ...override,
      };
      const nextPage = Number(override.page || settlementPagination.page || 1);
      const nextLimit = Number(override.limit || settlementPagination.limit || 10);
      params.set("page", String(nextPage));
      params.set("limit", String(nextLimit));
      if (effective.from) params.set("from", effective.from);
      if (effective.to) params.set("to", effective.to);
      if (effective.farmerId) params.set("farmerId", effective.farmerId);
      if (effective.status && effective.status !== "all") params.set("status", effective.status);
      if (effective.settlementType && effective.settlementType !== "all") {
        params.set("settlementType", effective.settlementType);
      }
      if (effective.overdueOnly) params.set("overdueOnly", "true");

      const { data } = await axios.get(
        `${API_URL}/admin/settlements/ledger?${params.toString()}`,
        tokenHeader()
      );
      setSettlementLedger(Array.isArray(data?.data) ? data.data : []);
      setSettlementPagination(
        data?.pagination || { page: nextPage, limit: nextLimit, total: 0 }
      );
      if (data?.summary) {
        setSettlementSummary(data.summary);
      }
    } catch {
      setSettlementLedger([]);
      setSettlementPagination({ page: 1, limit: 10, total: 0 });
    } finally {
      setSettlementLoading(false);
    }
  };

  const loadOrders = async (overrideFilters = {}) => {
    try {
      setLoading(true);
      const effectivePage = overrideFilters.page ?? page;
      const effectiveStatus = overrideFilters.statusFilter ?? statusFilter;
      const effectiveCategory = overrideFilters.categoryFilter ?? categoryFilter;
      const effectivePayment = overrideFilters.paymentFilter ?? paymentFilter;
      const effectiveSearch = overrideFilters.searchTerm ?? searchTerm;
      const effectiveFrom = overrideFilters.fromDate ?? fromDate;
      const effectiveTo = overrideFilters.toDate ?? toDate;

      const params = new URLSearchParams();
      params.set("page", String(effectivePage));
      params.set("limit", String(pagination.limit || 20));
      if (effectiveStatus !== "all") params.set("status", effectiveStatus);
      if (effectiveCategory !== "all") params.set("category", effectiveCategory);
      if (effectivePayment !== "all") params.set("paymentMethod", effectivePayment);
      if (effectiveFrom) params.set("from", effectiveFrom);
      if (effectiveTo) params.set("to", effectiveTo);
      if (effectiveSearch.trim()) params.set("search", effectiveSearch.trim());

      const { data } = await axios.get(
        `${API_URL}/admin/orders?${params.toString()}`,
        tokenHeader()
      );

      setOrders(data.data || []);
      setPagination(data.pagination || { total: 0, limit: 20, page: 1 });
      setStats(data.stats || []);
      setOverview(data.overview || {});
    } catch {
      setOrders([]);
      setOverview({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    loadGlobalOverview();
    loadSettlementSummary();
    loadFarmerOptions();
    loadReturnRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSettlementLedger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementPagination.page, settlementPagination.limit]);

  useEffect(() => {
    const queryFilters = getFiltersFromQuery(location.search);
    setStatusFilter(queryFilters.statusFilter);
    setCategoryFilter(queryFilters.categoryFilter);
    setPaymentFilter(queryFilters.paymentFilter);
    setSearchTerm(queryFilters.searchTerm);
    setFromDate(queryFilters.fromDate);
    setToDate(queryFilters.toDate);
    setPage(queryFilters.page);
    loadOrders(queryFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const applyAndNavigateFilters = (nextFilters, options = {}) => {
    const mergedFilters = {
      statusFilter,
      categoryFilter,
      paymentFilter,
      searchTerm,
      fromDate,
      toDate,
      page,
      ...nextFilters,
    };
    const search = buildSearchParams(mergedFilters);
    navigate(
      {
        pathname: "/admin/orders",
        search: search ? `?${search}` : "",
      },
      { replace: options.replace ?? false }
    );
    if (options.scrollToList) {
      setTimeout(() => {
        ordersListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
  };

  const applyCardFilter = (preset) => {
    const next = {
      statusFilter: "all",
      categoryFilter: "all",
      paymentFilter: "all",
      searchTerm: "",
      fromDate: "",
      toDate: "",
      page: 1,
      ...preset,
    };
    applyAndNavigateFilters(next, { scrollToList: true });
  };

  const resetFilters = () => {
    applyAndNavigateFilters(
      {
        statusFilter: "all",
        categoryFilter: "all",
        paymentFilter: "all",
        searchTerm: "",
        fromDate: "",
        toDate: "",
        page: 1,
      },
      { scrollToList: true }
    );
  };

  const applySettlementCardFilter = (preset = {}) => {
    const nextFilters = {
      from: "",
      to: "",
      farmerId: "",
      status: "all",
      settlementType: "all",
      overdueOnly: false,
      ...preset,
    };
    setSettlementFilters(nextFilters);
    setSettlementPagination((prev) => ({ ...prev, page: 1 }));
    loadSettlementLedger({ ...nextFilters, page: 1 });
    setTimeout(() => {
      settlementLedgerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  };

  const filteredStats = useMemo(() => {
    const map = new Map(stats.map((s) => [s._id, s.count]));
    return {
      total: stats.reduce((sum, s) => sum + (s.count || 0), 0),
      pending: map.get("pending") || 0,
      cancelled: map.get("cancelled") || 0,
    };
  }, [stats]);

  const renderPaymentBadge = (status) => {
    const s = (status || "").toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (s === "paid") cls = "bg-emerald-100 text-emerald-700";
    if (s === "unpaid") cls = "bg-amber-100 text-amber-700";
    if (s === "failed") cls = "bg-rose-100 text-rose-700";
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>
        {status}
      </span>
    );
  };

  const renderStatusBadge = (status) => {
    const s = (status || "").toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (["completed", "accepted", "delivered"].includes(s))
      cls = "bg-emerald-100 text-emerald-700";
    else if (["processing", "shipped", "out_for_delivery"].includes(s))
      cls = "bg-sky-100 text-sky-700";
    else if (s === "pending") cls = "bg-amber-100 text-amber-700";
    else if (s === "cancelled" || s === "rejected")
      cls = "bg-rose-100 text-rose-700";
    return (
      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${cls}`}>
        {status}
      </span>
    );
  };

  const cardsOverview = globalOverview || overview;

  const renderPayoutStatusBadge = (status = "") => {
    const s = String(status || "").trim().toLowerCase();
    let cls = "bg-gray-100 text-gray-700";
    if (s === "transferred") cls = "bg-green-100 text-green-700";
    else if (s === "eligible") cls = "bg-sky-100 text-sky-700";
    else if (s === "pending") cls = "bg-yellow-100 text-yellow-700";
    else if (s === "onhold") cls = "bg-red-100 text-red-700";
    return (
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${cls}`}>
        {status || "-"}
      </span>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Order Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track and supervise platform transactions without modifying payments.
          </p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <AdminCard
          title="Total Orders"
          value={cardsOverview.totalOrders ?? filteredStats.total}
          subtitle="All filtered orders"
          onClick={() => applyCardFilter({})}
        />
        <AdminCard
          title="Split Orders"
          value={cardsOverview.splitOrders ?? 0}
          subtitle="Multi-vendor"
          accent="orange"
          onClick={() => applyCardFilter({ categoryFilter: "split" })}
        />
        <AdminCard
          title="Single Vendor"
          value={cardsOverview.singleVendorOrders ?? 0}
          subtitle="Standard orders"
          accent="red"
          onClick={() => applyCardFilter({ categoryFilter: "single" })}
        />
        <AdminCard
          title="COD Orders"
          value={cardsOverview.codOrders ?? 0}
          subtitle="Cash/COD flow"
          onClick={() => applyCardFilter({ paymentFilter: "cod" })}
        />
        <AdminCard
          title="Paid Orders"
          value={cardsOverview.paidOrders ?? 0}
          subtitle="Payment confirmed"
          accent="sky"
          onClick={() => applyCardFilter({ paymentFilter: "razorpay" })}
        />
        <AdminCard
          title="Delivered Orders"
          value={cardsOverview.deliveredOrders ?? 0}
          subtitle="Fulfilled"
          onClick={() => applyCardFilter({ statusFilter: "delivered" })}
        />
        <AdminCard
          title="Cancelled Orders"
          value={cardsOverview.cancelledOrders ?? filteredStats.cancelled}
          subtitle="Cancelled"
          accent="red"
          onClick={() => applyCardFilter({ statusFilter: "cancelled" })}
        />
        <AdminCard
          title="On Hold Payouts"
          value={cardsOverview.disputedOrders ?? 0}
          subtitle="Blocked by return or cancellation"
          accent="orange"
          onClick={() => applySettlementCardFilter({ status: "OnHold" })}
        />
        <AdminCard
          title="Pending Payouts"
          value={`Rs ${(cardsOverview.pendingPayouts ?? 0).toFixed(2)}`}
          subtitle="Awaiting eligibility"
          onClick={() => applySettlementCardFilter({ status: "Pending" })}
        />
        <AdminCard
          title="Eligible Payouts"
          value={`Rs ${(cardsOverview.eligiblePayouts ?? 0).toFixed(2)}`}
          subtitle="Ready to transfer"
          accent="sky"
          onClick={() => applySettlementCardFilter({ status: "Eligible" })}
        />
        <AdminCard
          title="Overdue Eligible"
          value={cardsOverview.overdueEligiblePayoutCount ?? 0}
          subtitle="Past auto-settle time"
          accent="orange"
          onClick={() => applySettlementCardFilter({ status: "Eligible", overdueOnly: true })}
        />
        <AdminCard
          title="Overdue Amount"
          value={`Rs ${(cardsOverview.overdueEligiblePayoutAmount ?? 0).toFixed(2)}`}
          subtitle="Needs settlement catch-up"
          accent="red"
        />
        <AdminCard title="Transferred Payouts" value={`Rs ${(cardsOverview.transferredPayouts ?? 0).toFixed(2)}`} subtitle="Settled payouts" />
        <AdminCard title="Commission Earned" value={`Rs ${(cardsOverview.totalCommissionEarned ?? 0).toFixed(2)}`} subtitle="Platform commission" />
        <AdminCard title="GST Collected" value={`Rs ${(cardsOverview.totalGSTCollected ?? 0).toFixed(2)}`} subtitle="Total GST" accent="orange" />
        <AdminCard title="Delivery Earnings" value={`Rs ${(cardsOverview.totalDeliveryEarnings ?? 0).toFixed(2)}`} subtitle="Delivery charges" accent="sky" />
        <AdminCard
          title="Subscription Orders"
          value={cardsOverview.subscriptionOrders ?? 0}
          subtitle="Auto-generated"
          onClick={() => applyCardFilter({ categoryFilter: "subscription" })}
        />
        <AdminCard title="Active Subscriptions" value={cardsOverview.activeSubscriptions ?? 0} subtitle="Active + paused" accent="sky" />
      </div>

      {/* Farmer settlement summary + ledger */}
      <div
        ref={settlementLedgerRef}
        className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-gray-500">
              Farmer Settlement Ledger
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Farmer payout history with actual transfer status and dates.
            </p>
          </div>
          <button
            onClick={() => {
              loadSettlementSummary();
              loadSettlementLedger({ page: 1 });
              setSettlementPagination((prev) => ({ ...prev, page: 1 }));
            }}
            className="px-3 py-1.5 rounded-xl border border-green-100 text-xs font-bold text-green-700 hover:bg-green-50"
          >
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 p-4 border-b border-gray-100">
          <AdminCard
            title="Eligible Amount"
            value={`Rs ${Number(settlementSummary?.totalEligibleAmount || 0).toFixed(2)}`}
            subtitle="Ready to transfer"
            accent="sky"
          />
          <AdminCard
            title="Transferred Amount"
            value={`Rs ${Number(settlementSummary?.totalTransferredAmount || 0).toFixed(2)}`}
            subtitle="Paid to farmers"
          />
          <AdminCard
            title="Pending Amount"
            value={`Rs ${Number(settlementSummary?.totalPendingAmount || 0).toFixed(2)}`}
            subtitle="Awaiting eligibility"
            accent="orange"
          />
          <AdminCard
            title="Overdue Eligible"
            value={`Rs ${Number(settlementSummary?.overdueEligibleAmount || 0).toFixed(2)}`}
            subtitle="Needs settlement"
            accent="red"
          />
          <AdminCard
            title="Last Successful Run"
            value={
              settlementSummary?.lastSuccessfulSettlementRun?.startedAt
                ? new Date(
                    settlementSummary.lastSuccessfulSettlementRun.startedAt
                  ).toLocaleString()
                : "N/A"
            }
            subtitle={
              settlementSummary?.lastSuccessfulSettlementRun?.jobName || "No successful runs"
            }
            accent="sky"
          />
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <input
              type="date"
              value={settlementFilters.from}
              onChange={(e) =>
                setSettlementFilters((prev) => ({ ...prev, from: e.target.value }))
              }
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            />
            <input
              type="date"
              value={settlementFilters.to}
              onChange={(e) =>
                setSettlementFilters((prev) => ({ ...prev, to: e.target.value }))
              }
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            />
            <select
              value={settlementFilters.farmerId}
              onChange={(e) =>
                setSettlementFilters((prev) => ({ ...prev, farmerId: e.target.value }))
              }
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            >
              <option value="">All Farmers</option>
              {farmerOptions.map((f) => (
                <option key={f._id} value={f._id}>
                  {f.name}
                </option>
              ))}
            </select>
            <select
              value={settlementFilters.status}
              onChange={(e) =>
                setSettlementFilters((prev) => ({ ...prev, status: e.target.value }))
              }
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            >
              <option value="all">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Eligible">Eligible</option>
              <option value="Transferred">Transferred</option>
              <option value="OnHold">OnHold</option>
            </select>
            <select
              value={settlementFilters.settlementType}
              onChange={(e) =>
                setSettlementFilters((prev) => ({
                  ...prev,
                  settlementType: e.target.value,
                }))
              }
              className="px-3 py-2 rounded-xl border border-green-100 text-xs bg-white"
            >
              <option value="all">All Types</option>
              <option value="regular">Regular</option>
              <option value="transparent">Transparent</option>
            </select>
            <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-green-100 text-xs bg-white">
              <input
                type="checkbox"
                checked={settlementFilters.overdueOnly}
                onChange={(e) =>
                  setSettlementFilters((prev) => ({
                    ...prev,
                    overdueOnly: e.target.checked,
                  }))
                }
              />
              Overdue only
            </label>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button
              onClick={() => {
                const reset = {
                  from: "",
                  to: "",
                  farmerId: "",
                  status: "all",
                  settlementType: "all",
                  overdueOnly: false,
                };
                setSettlementFilters(reset);
                setSettlementPagination((prev) => ({ ...prev, page: 1 }));
                loadSettlementLedger({ ...reset, page: 1 });
              }}
              className="px-4 py-2 rounded-xl border border-green-100 text-xs font-bold text-green-700 hover:bg-green-50"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setSettlementPagination((prev) => ({ ...prev, page: 1 }));
                loadSettlementLedger({ ...settlementFilters, page: 1 });
              }}
              className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700"
            >
              Apply
            </button>
          </div>
        </div>

        {settlementLoading ? (
          <div className="p-6">
            <Loader />
          </div>
        ) : settlementLedger.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Farmer Name
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Farmer ID
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Order/Sub-order ID
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Amount
                    </th>
                    <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Payout Status
                    </th>
                    <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Transfer Date
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Trigger
                    </th>
                    <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                      Auto Settle At
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {settlementLedger.map((row) => (
                    <tr key={`${row.settlementType}-${row.rowId}`} className="border-t border-gray-50">
                      <td className="px-4 py-3 text-xs font-semibold text-gray-800">
                        {row.farmerId ? (
                          <button
                            onClick={() =>
                              navigate(`/admin/orders/settlements/farmer/${row.farmerId}`)
                            }
                            className="text-green-700 hover:underline"
                          >
                            {row.farmerName || "Unknown Farmer"}
                          </button>
                        ) : (
                          row.farmerName || "Unknown Farmer"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 font-mono">
                        {row.farmerId || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                        {row.orderOrSubOrderId || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">{row.settlementType}</td>
                      <td className="px-4 py-3 text-xs text-right font-semibold text-gray-800">
                        Rs {Number(row.amountTransferred || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-xs text-center">
                        {renderPayoutStatusBadge(row.payoutStatus)}
                      </td>
                      <td className="px-4 py-3 text-xs text-right text-gray-600">
                        {row.transferDate ? new Date(row.transferDate).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 capitalize">
                        {row.settlementTrigger || "-"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700">
                        {row.autoSettleAt ? new Date(row.autoSettleAt).toLocaleString() : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
              <span>
                Page {settlementPagination.page} of{" "}
                {Math.max(
                  1,
                  Math.ceil(
                    Number(settlementPagination.total || 0) /
                      Number(settlementPagination.limit || 10)
                  )
                )}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={settlementPagination.page <= 1}
                  onClick={() =>
                    setSettlementPagination((prev) => ({
                      ...prev,
                      page: Math.max(1, prev.page - 1),
                    }))
                  }
                  className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
                >
                  Prev
                </button>
                <button
                  disabled={
                    settlementPagination.page >=
                    Math.max(
                      1,
                      Math.ceil(
                        Number(settlementPagination.total || 0) /
                          Number(settlementPagination.limit || 10)
                      )
                    )
                  }
                  onClick={() =>
                    setSettlementPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                  }
                  className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 text-xs text-gray-500">No settlement records found.</div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-gray-700">
              Return Requests
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              View customer return requests and farmer decisions.
            </p>
          </div>
          <span className="text-xs font-bold text-gray-400">
            {returnRequests.length} records
          </span>
        </div>
        {returnRequestsLoading ? (
          <div className="p-6 text-xs text-gray-500">Loading return requests...</div>
        ) : returnRequests.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Sub-order
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Farmer
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Reason
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Decision
                  </th>
                </tr>
              </thead>
              <tbody>
                {returnRequests.map((request) => (
                  <tr
                    key={request._id}
                    className="border-t border-gray-50 hover:bg-green-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-gray-700">
                      #{String(request._id || "").slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div className="font-semibold">{request.customer?.name || "Unknown"}</div>
                      <div className="text-gray-500">{request.customer?.email || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      <div className="font-semibold">{request.farmerId?.name || "Unknown"}</div>
                      <div className="text-gray-500">{request.farmerId?.email || "-"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {request.returnRequest?.reason || "-"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-sky-100 text-sky-700">
                        {request.returnRequest?.status || "None"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-xs text-gray-500">No return requests found.</div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-green-100 p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="md:flex-1">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Search by Order ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="e.g. 65f1c9..."
                className="w-full px-4 py-2 pl-9 border border-green-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="text-gray-400 text-xs" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Order Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Order Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
            >
              <option value="all">All</option>
              <option value="split">Split Sub Orders</option>
              <option value="single">Single Vendor</option>
              <option value="subscription">Subscription</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Payment Method
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
            >
              <option value="all">All</option>
              <option value="razorpay">Razorpay</option>
              <option value="cod">COD</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              From
            </label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              To
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={resetFilters}
            className="px-5 py-2 rounded-xl border border-green-600 text-xs font-bold text-green-700 hover:bg-green-50 transition shadow-sm"
          >
            Reset
          </button>
          <button
            onClick={() => {
              applyAndNavigateFilters({
                statusFilter,
                categoryFilter,
                paymentFilter,
                searchTerm,
                fromDate,
                toDate,
                page: 1,
              });
            }}
            className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {/* Orders table */}
      <div ref={ordersListRef} />
      {loading ? (
        <Loader />
      ) : orders.length > 0 ? (
        <div className="bg-white rounded-2xl border border-green-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-green-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Order ID
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Payment
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Date
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-gray-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order._id}
                    className="border-t border-gray-50 hover:bg-green-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-gray-700 font-mono">
                      #{order._id.slice(-8).toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-700">
                      {order.consumer?.name || "Unknown"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-gray-800">
                      &#8377;{order.totalAmount?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderPaymentBadge(order.paymentStatus)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {renderStatusBadge(order.status)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-700 font-semibold">
                      {order.orderCategory || order.orderType || "single"}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right text-xs">
                      <button
                        onClick={() => navigate(`/admin/orders/${order._id}`)}
                        className="px-4 py-1.5 rounded-xl bg-gray-900 text-white text-[11px] font-bold hover:bg-green-700 transition"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-600">
            <span>
              Page {pagination.page} of{" "}
              {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.limit || 20)))}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                disabled={
                  page >=
                  Math.ceil((pagination.total || 0) / (pagination.limit || 20))
                }
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1 rounded-xl border border-green-100 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-2xl border border-green-100 shadow-sm">
          <FaShoppingBasket className="text-green-500 text-5xl mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Orders Found</h3>
          <p className="text-gray-600 mb-4">
            Adjust your filters or date range to see more results.
          </p>
          <button
            onClick={resetFilters}
            className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition"
          >
            Reset Filters
          </button>
        </div>
      )}

    </div>
  );
};

export default OrdersPage;



