import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import toast from "react-hot-toast";
import Loader from "../../components/Loader";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const COMPLAINT_TYPES = [
  "Order Issue",
  "Payment Issue",
  "Product Quality Issue",
  "Account Issue",
  "Other",
];

const STATUS_FILTERS = ["All", "Pending", "In Review", "Resolved", "Rejected"];

const getStatusBadgeClass = (status) => {
  const s = (status || "").toLowerCase();
  if (s === "pending") return "bg-amber-50 text-amber-700 border-amber-100";
  if (s === "in review") return "bg-sky-50 text-sky-700 border-sky-100";
  if (s === "resolved") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (s === "rejected") return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const ConsumerComplaintsPage = () => {
  const [searchParams] = useSearchParams();
  const preselectedOrderId = searchParams.get("orderId") || "";

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [statusFilter, setStatusFilter] = useState("All");
  const [orders, setOrders] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState({
    complaintType: "Order Issue",
    orderId: preselectedOrderId,
    description: "",
    image: null,
  });

  const tokenHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [ordersRes, complaintsRes] = await Promise.all([
        axios.get(`${API_URL}/orders/consumer`, tokenHeader),
        axios.get(`${API_URL}/complaints/my`, tokenHeader),
      ]);
      setOrders(ordersRes.data?.data || []);
      setComplaints(complaintsRes.data?.data || []);
    } catch (error) {
      toast.error("Failed to load complaint data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredComplaints =
    statusFilter === "All"
      ? complaints
      : complaints.filter((c) => c.status === statusFilter);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error("Please enter complaint description");
      return;
    }

    try {
      setSubmitting(true);
      const payload = new FormData();
      payload.append("complaintType", form.complaintType);
      if (form.orderId) payload.append("orderId", form.orderId);
      payload.append("description", form.description.trim());
      if (form.image) payload.append("image", form.image);

      await axios.post(`${API_URL}/complaints`, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success("Complaint submitted");
      setForm((prev) => ({ ...prev, description: "", image: null }));
      await loadData();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to submit complaint");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">My Complaints</h1>
          <p className="text-sm text-gray-500 mt-1">Raise and track your complaint status.</p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Raise Complaint</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Complaint Type</label>
            <select
              value={form.complaintType}
              onChange={(e) => setForm((prev) => ({ ...prev, complaintType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {COMPLAINT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Order ID (Optional)</label>
            <select
              value={form.orderId}
              onChange={(e) => setForm((prev) => ({ ...prev, orderId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Not related to an order</option>
              {orders.map((order) => (
                <option key={order._id} value={order._id}>
                  {order._id}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Description</label>
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Describe your issue in detail..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Image (Optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.files?.[0] || null }))}
            className="w-full text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2 bg-green-600 text-white rounded-lg font-bold text-sm disabled:opacity-60"
        >
          {submitting ? "Submitting..." : "Submit Complaint"}
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">Complaint History</h2>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-semibold text-gray-700"
          >
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        {filteredComplaints.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No complaints filed yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">Complaint ID</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Admin Note</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredComplaints.map((c) => (
                  <tr key={c._id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-semibold">{c.complaintId}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusBadgeClass(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">{c.adminNote || "-"}</td>
                    <td className="px-4 py-3">{new Date(c.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsumerComplaintsPage;
