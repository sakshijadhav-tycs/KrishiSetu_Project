"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";
import FarmerVerificationBadge from "../../components/FarmerVerificationBadge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const FarmersManagementPage = () => {
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchFarmers = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setFarmers([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/admin/farmers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      // Backend controller 'data' field mein array bhej raha hai
      setFarmers(data.data || []);
    } catch (err) {
      console.error("Fetch Error:", err);
      if (err?.response?.status === 401 || !localStorage.getItem("token")) {
        setFarmers([]);
        return;
      }
      toast.error("Failed to load farmers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFarmers();
  }, []);

  const handleStatusChange = async (farmerId, newStatus) => {
    try {
      const token = localStorage.getItem("token");
      
      /**
       * BACKEND ALIGNMENT:
       * Controller expects 'status' in body and updates 'accountStatus'
       */
      await axios.patch(
        `${API_URL}/admin/farmers/${farmerId}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      toast.success(`Farmer status updated to ${newStatus}`);
      // Refresh list to pull updated 'accountStatus' from DB
      fetchFarmers(); 
    } catch (err) {
      console.error("Update Error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  const filteredFarmers = useMemo(() => {
    let data = [...farmers];

    if (statusFilter !== "all") {
      // Filtering based on 'accountStatus' field updated by Admin
      data = data.filter((f) => (f.accountStatus || "Pending") === statusFilter);
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      data = data.filter(
        (f) =>
          f.name?.toLowerCase().includes(term) ||
          f.email?.toLowerCase().includes(term)
      );
    }

    if (verificationFilter !== "all") {
      data = data.filter(
        (f) => (f.verification?.verificationStatus || "unverified") === verificationFilter
      );
    }

    data.sort(
      (a, b) =>
        (b.performance?.ordersCount || 0) - (a.performance?.ordersCount || 0)
    );

    return data;
  }, [farmers, statusFilter, search, verificationFilter]);

  const handleVerificationChange = async (farmerId, nextStatus) => {
    try {
      const token = localStorage.getItem("token");
      const reason =
        nextStatus === "unverified"
          ? window.prompt("Verification rejection/revoke reason:", "")
          : "";
      await axios.patch(
        `${API_URL}/admin/farmers/${farmerId}/verification`,
        {
          status: nextStatus,
          reason: reason || "",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(`Farmer verification updated to ${nextStatus}`);
      fetchFarmers();
    } catch (err) {
      console.error("Verification Update Error:", err.response?.data || err.message);
      toast.error(err.response?.data?.message || "Failed to update verification");
    }
  };

  const promptSuspendFarmer = async (row) => {
    const reason = window.prompt("Suspension reason:", row.suspension?.reason || "");
    const endDate = window.prompt("Suspension end date (YYYY-MM-DD):");
    if (!endDate) return;
    const token = localStorage.getItem("token");
    try {
      await axios.patch(
        `${API_URL}/admin/farmers/${row._id}/status`,
        {
          status: "Suspended",
          suspensionReason: reason || "",
          suspensionEndDate: endDate,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Farmer suspended");
      fetchFarmers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to suspend farmer");
    }
  };

  const promptRejectFarmer = async (row) => {
    const reason = window.prompt("Rejection reason:", row.rejectionReason || "");
    const token = localStorage.getItem("token");
    try {
      await axios.patch(
        `${API_URL}/admin/farmers/${row._id}/status`,
        {
          status: "Rejected",
          rejectionReason: reason || "",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Farmer rejected");
      fetchFarmers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject farmer");
    }
  };

  const liftSuspension = async (row) => {
    const token = localStorage.getItem("token");
    try {
      await axios.patch(
        `${API_URL}/admin/farmers/${row._id}/lift-suspension`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Suspension lifted");
      fetchFarmers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to lift suspension");
    }
  };

  const actionButtonClass = (tone = "neutral") => {
    const tones = {
      success: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
      info: "bg-blue-50 text-blue-700 hover:bg-blue-100",
      neutral: "bg-slate-50 text-slate-700 hover:bg-slate-100",
      warning: "bg-amber-50 text-amber-700 hover:bg-amber-100",
      danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
      sky: "bg-sky-50 text-sky-700 hover:bg-sky-100",
    };
    return `px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95 ${
      tones[tone] || tones.neutral
    }`;
  };

  const renderFarmerActions = (row) => {
    const accountStatus = String(row.accountStatus || "Pending").toLowerCase();
    const verificationStatus = String(
      row?.verification?.verificationStatus || "unverified"
    ).toLowerCase();
    const isVerified = verificationStatus === "verified";

    if (accountStatus === "suspended") {
      return (
        <div className="flex justify-end gap-2 text-[11px] flex-wrap">
          <button
            onClick={() => liftSuspension(row)}
            className={actionButtonClass("sky")}
          >
            Lift Suspension
          </button>
          <button
            onClick={() => promptRejectFarmer(row)}
            className={actionButtonClass("danger")}
          >
            Reject
          </button>
        </div>
      );
    }

    if (accountStatus === "rejected") {
      return (
        <div className="flex justify-end gap-2 text-[11px] flex-wrap">
          <button
            onClick={() => handleStatusChange(row._id, "Approved")}
            className={actionButtonClass("success")}
          >
            Approve
          </button>
        </div>
      );
    }

    if (accountStatus === "approved") {
      return (
        <div className="flex justify-end gap-2 text-[11px] flex-wrap">
          {isVerified ? (
            <button
              onClick={() => handleVerificationChange(row._id, "unverified")}
              className={actionButtonClass("neutral")}
            >
              Revoke Verification
            </button>
          ) : (
            <button
              onClick={() => handleVerificationChange(row._id, "verified")}
              className={actionButtonClass("info")}
            >
              Verify
            </button>
          )}
          <button
            onClick={() => promptSuspendFarmer(row)}
            className={actionButtonClass("warning")}
          >
            Suspend
          </button>
        </div>
      );
    }

    return (
      <div className="flex justify-end gap-2 text-[11px] flex-wrap">
        <button
          onClick={() => handleStatusChange(row._id, "Approved")}
          className={actionButtonClass("success")}
        >
          Approve
        </button>
        <button
          onClick={() => promptRejectFarmer(row)}
          className={actionButtonClass("danger")}
        >
          Reject
        </button>
      </div>
    );
  };

  const columns = [
    {
      key: "farmer",
      label: "Farmer",
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">{row.email}</p>
        </div>
      ),
    },
    {
      key: "performance",
      label: "Performance",
      render: (row) => (
        <div className="text-xs text-gray-600">
          <p>Orders: <span className="font-semibold">{row.performance?.ordersCount || 0}</span></p>
          <p>Sales: <span className="font-semibold">₨{(row.performance?.totalSales || 0).toFixed(2)}</span></p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        /**
         * Reading 'accountStatus' as it's the field modified by Admin controller
         * Default to "Pending" for new/unprocessed farmers.
         */
        return <StatusBadge status={row.accountStatus || "Pending"} />;
      },
    },
    {
      key: "verification",
      label: "Verification",
      render: (row) => (
        <div className="text-xs text-gray-600 space-y-1">
          <div>
            <FarmerVerificationBadge verified={Boolean(row?.verification?.verifiedBadge)} />
          </div>
          <p>
            Aadhaar:{" "}
            <span className="font-semibold">
              {row?.verification?.aadhaarNumberMasked || "Not submitted"}
            </span>
          </p>
          <p>
            Mobile:{" "}
            <span className="font-semibold">
              {row?.verification?.mobileNumber || "Not submitted"}
            </span>
          </p>
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => renderFarmerActions(row),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            Farmer Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Approve, reject, or suspend farmers and track their performance.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="px-3 py-2 text-xs rounded-xl border border-green-100 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-green-100 bg-white shadow-sm"
          >
            <option value="all">All statuses</option>
            <option value="Approved">Approved</option>
            <option value="Suspended">Suspended</option>
            <option value="Rejected">Rejected</option>
            <option value="Pending">Pending</option>
          </select>
          <select
            value={verificationFilter}
            onChange={(e) => setVerificationFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-green-100 bg-white shadow-sm"
          >
            <option value="all">All verification</option>
            <option value="verified">Verified</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-32">
          <p className="text-sm text-gray-500">Loading farmers...</p>
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={filteredFarmers}
          getRowId={(row) => row._id}
          emptyMessage="No farmers found."
        />
      )}
    </div>
  );
};

export default FarmersManagementPage;
