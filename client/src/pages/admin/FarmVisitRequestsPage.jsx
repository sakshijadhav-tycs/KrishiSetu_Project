import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const formatTime = (visit) => {
  if (visit?.slot) return visit.slot;
  const source = visit?.requestedDate || visit?.date;
  if (!source) return "-";
  const dt = new Date(source);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const FarmVisitRequestsPage = () => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const { data } = await axios.get(`${API_URL}/admin/visits`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setVisits(data?.data || []);
      } catch {
        setVisits([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVisits();
  }, []);

  const rows = useMemo(() => {
    if (statusFilter === "all") return visits;
    return visits.filter(
      (visit) => String(visit?.status || "").toLowerCase() === statusFilter
    );
  }, [visits, statusFilter]);

  const columns = [
    {
      key: "customerName",
      label: "Customer Name",
      render: (row) => row?.customerId?.name || "-",
    },
    {
      key: "farmerName",
      label: "Farmer Name",
      render: (row) => row?.farmerId?.name || "-",
    },
    {
      key: "visitDate",
      label: "Visit Date",
      render: (row) => {
        const source = row?.requestedDate || row?.date;
        return source ? new Date(source).toLocaleDateString() : "-";
      },
    },
    {
      key: "visitTime",
      label: "Time",
      render: (row) => formatTime(row),
    },
    {
      key: "message",
      label: "Message",
      render: (row) => row?.message || row?.notes || "-",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row?.status || "Pending"} />,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Farm Visit Requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Monitor farm visit requests across the platform.
          </p>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl border border-green-100 bg-white text-xs shadow-sm"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-green-100 p-8 text-sm text-gray-500">
          Loading visit requests...
        </div>
      ) : (
        <AdminTable
          columns={columns}
          rows={rows}
          getRowId={(row) => row._id}
          emptyMessage="No farm visit requests found."
        />
      )}
    </div>
  );
};

export default FarmVisitRequestsPage;
