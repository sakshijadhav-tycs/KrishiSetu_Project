"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";
import AdminModal from "../../components/admin/AdminModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ComplaintCenterPage = () => {
  const [complaints, setComplaints] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const loadComplaints = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API_URL}/admin/complaints`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setComplaints(data.data || []);
    } catch {
      toast.error("Failed to load complaints");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const openEdit = (complaint) => {
    setEditing(complaint);
    setEditStatus(complaint.status);
    setEditNotes(complaint.adminNote || complaint.adminNotes || "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/admin/complaints/${editing._id}`,
        { status: editStatus, adminNote: editNotes },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Complaint updated");
      setEditing(null);
      loadComplaints();
    } catch {
      toast.error("Failed to update complaint");
    }
  };

  const filtered =
    statusFilter === "all"
      ? complaints
      : complaints.filter(
          (c) => c.status === statusFilter || c.legacyStatus === statusFilter
        );

  const isOverSLA = (row) => {
    if (row.status !== "Pending" && row.status !== "In Review") return false;
    const created = new Date(row.createdAt);
    const diffDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 3;
  };

  const columns = [
    {
      key: "complaintId",
      label: "Complaint ID",
      render: (row) => (
        <p className="text-xs font-semibold text-gray-700">
          {row.complaintId || row._id}
        </p>
      ),
    },
    {
      key: "createdBy",
      label: "From",
      render: (row) => (
        <p className="text-xs text-gray-700">
          {(row.createdBy || row.userId)?.name} (
          {(row.createdBy || row.userId)?.role})
        </p>
      ),
    },
    {
      key: "complaintType",
      label: "Type",
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">
            {row.complaintType || row.title}
          </p>
          <p className="text-xs text-gray-500 line-clamp-1">{row.description}</p>
        </div>
      ),
    },
    {
      key: "orderId",
      label: "Order ID",
      render: (row) => (
        <p className="text-xs text-gray-700">
          {row.orderId?._id || row.order?._id || "-"}
        </p>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "Created Date",
      render: (row) => (
        <span
          className={`text-xs ${
            isOverSLA(row) ? "text-rose-600 font-semibold" : "text-gray-500"
          }`}
        >
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <button
          onClick={() => openEdit(row)}
          className="px-3 py-1 rounded-xl bg-gray-900 text-white text-[11px] font-bold"
        >
          Update
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Complaint Center</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track platform issues, update statuses and maintain complaint history.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-gray-200 bg-white"
        >
          <option value="all">All complaints</option>
          <option value="Pending">Pending</option>
          <option value="In Review">In Review</option>
          <option value="Resolved">Resolved</option>
          <option value="Rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading complaints...</p>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          getRowId={(row) => row._id}
          emptyMessage="No complaints found."
        />
      )}

      {editing && (
        <AdminModal
          title="Update Complaint"
          onClose={() => setEditing(null)}
          primaryAction={{ label: "Save changes", onClick: saveEdit }}
          secondaryAction={{ label: "Cancel", onClick: () => setEditing(null) }}
        >
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold text-gray-900 mb-1">
                {editing.complaintType || editing.title}
              </p>
              <p className="text-xs text-gray-600">{editing.description}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Status
              </label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
              >
                <option value="Pending">Pending</option>
                <option value="In Review">In Review</option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Admin note
              </label>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
                placeholder="Add note for this complaint..."
              />
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
};

export default ComplaintCenterPage;
