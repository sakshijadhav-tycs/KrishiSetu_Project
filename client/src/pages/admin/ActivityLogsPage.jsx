"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ActivityLogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("all");
  const [adminFilter, setAdminFilter] = useState("all");

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadLogs = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${API_URL}/admin/activity-logs`,
        tokenHeader()
      );
      setLogs(data.data || []);
    } catch {
      toast.error("Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs =
    actionFilter === "all" && adminFilter === "all"
      ? logs
      : logs.filter((log) => {
          const matchAction =
            actionFilter === "all" || log.action === actionFilter;
          const matchAdmin =
            adminFilter === "all" || log.admin?._id === adminFilter;
          return matchAction && matchAdmin;
        });

  const uniqueActions = Array.from(new Set(logs.map((l) => l.action)));
  const uniqueAdmins = Array.from(
    new Map(logs.map((l) => [l.admin?._id, l.admin])).values()
  ).filter(Boolean);

  const columns = [
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.action}</p>
          <p className="text-xs text-gray-500">{row.description}</p>
        </div>
      ),
    },
    {
      key: "admin",
      label: "Admin",
      render: (row) => (
        <p className="text-xs text-gray-700">
          {row.admin?.name} ({row.admin?.email})
        </p>
      ),
    },
    {
      key: "resource",
      label: "Resource",
      render: (row) => (
        <p className="text-xs text-gray-600">
          {row.resourceType} / {row.resourceId}
        </p>
      ),
    },
    {
      key: "createdAt",
      label: "Time",
      render: (row) => (
        <span className="text-xs text-gray-500">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-1">
            Transparent audit trail of all admin actions on the platform.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-3 text-xs">
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-green-100 bg-white shadow-sm"
          >
            <option value="all">All actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            value={adminFilter}
            onChange={(e) => setAdminFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-green-100 bg-white shadow-sm"
          >
            <option value="all">All admins</option>
            {uniqueAdmins.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading logs...</p>
      ) : (
        <AdminTable
          columns={columns}
          rows={filteredLogs}
          getRowId={(row) => row._id}
          emptyMessage="No admin activity recorded yet."
        />
      )}
    </div>
  );
};

export default ActivityLogsPage;

