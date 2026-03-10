import { useEffect, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";
import { FaPause, FaPlay, FaTimesCircle } from "react-icons/fa";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SubscriptionsPage = () => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [upcoming, setUpcoming] = useState([]);
  const [filter, setFilter] = useState("active");
  const [loading, setLoading] = useState(true);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [subsRes, upRes] = await Promise.all([
        axios.get(`${API_URL}/subscriptions/me?status=${filter}`, tokenHeader()),
        axios.get(`${API_URL}/subscriptions/upcoming-deliveries`, tokenHeader()),
      ]);
      setSubscriptions(subsRes.data?.data || []);
      setUpcoming(upRes.data?.data || []);
    } catch {
      setSubscriptions([]);
      setUpcoming([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const updateStatus = async (id, action) => {
    try {
      await axios.put(`${API_URL}/subscriptions/${id}/${action}`, {}, tokenHeader());
      toast.success(`Subscription ${action}d`);
      loadData();
    } catch (error) {
      toast.error(error?.response?.data?.message || `Failed to ${action} subscription`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-black text-gray-900 mb-4">My Subscriptions</h1>

        <div className="mb-4 flex gap-2">
          {["active", "paused", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase ${
                filter === s ? "bg-green-600 text-white" : "bg-white border border-gray-200 text-gray-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 bg-white rounded-2xl border border-gray-100">Loading...</div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div key={sub._id} className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="font-black text-gray-900">{sub.productId?.name || "Product"}</p>
                <p className="text-sm text-gray-600">
                  Qty {sub.quantity} | {sub.frequency} | Next delivery:{" "}
                  {sub.nextDeliveryDate ? new Date(sub.nextDeliveryDate).toLocaleDateString() : "N/A"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Farmer: {sub.farmerId?.name || "N/A"} | Status: {sub.status}
                </p>
                {sub.status === "cancelled" && sub.cancelledAt && (
                  <p className="text-xs text-red-600 mt-1 font-semibold">
                    Effective cancellation: {new Date(sub.cancelledAt).toLocaleString()}
                  </p>
                )}
                <div className="flex gap-2 mt-3">
                  {sub.status === "active" && (
                    <button
                      onClick={() => updateStatus(sub._id, "pause")}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white"
                    >
                      <FaPause /> Pause
                    </button>
                  )}
                  {sub.status === "paused" && (
                    <button
                      onClick={() => updateStatus(sub._id, "resume")}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 text-white"
                    >
                      <FaPlay /> Resume
                    </button>
                  )}
                  {sub.status !== "cancelled" && (
                    <button
                      onClick={() => updateStatus(sub._id, "cancel")}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-red-600 text-white"
                    >
                      <FaTimesCircle /> Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
            {subscriptions.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-sm text-gray-500">
                No subscriptions found.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 bg-white rounded-2xl border border-gray-100 p-4">
          <h2 className="text-sm font-black uppercase tracking-widest text-gray-500 mb-3">
            Upcoming Deliveries
          </h2>
          {upcoming.length > 0 ? (
            <div className="space-y-2">
              {upcoming.map((sub) => (
                <div key={`up-${sub._id}`} className="text-sm text-gray-700">
                  {sub.productId?.name || "Product"} - {new Date(sub.nextDeliveryDate).toLocaleDateString()}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No upcoming deliveries.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubscriptionsPage;
