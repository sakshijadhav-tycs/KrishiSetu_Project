"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const getStatusClasses = (status) => {
  if (status === "Active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "Scheduled") return "bg-sky-50 text-sky-700 border-sky-100";
  if (status === "Expired") return "bg-rose-50 text-rose-700 border-rose-100";
  return "bg-gray-50 text-gray-700 border-gray-200";
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    targetRole: "all",
    displayType: "permanent",
    startDateTime: new Date().toISOString().slice(0, 16),
    endDateTime: "",
    durationValue: "",
    durationUnit: "hours",
  });

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_URL}/admin/notifications`, tokenHeader());
      setNotifications(data.data || []);
    } catch {
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const calculatedEndDate = useMemo(() => {
    if (form.displayType === "permanent") return "";
    if (!form.durationValue) return "";
    const start = form.startDateTime ? new Date(form.startDateTime) : new Date();
    const numeric = Number(form.durationValue);
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
    const ms = form.durationUnit === "days" ? numeric * 24 * 60 * 60 * 1000 : numeric * 60 * 60 * 1000;
    return new Date(start.getTime() + ms).toISOString().slice(0, 16);
  }, [form.displayType, form.durationUnit, form.durationValue, form.startDateTime]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.title.trim() || !form.message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    if (form.displayType === "custom") {
      const start = new Date(form.startDateTime);
      const end = new Date(form.endDateTime || calculatedEndDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        toast.error("Valid start and end time required");
        return;
      }
      if (end <= start) {
        toast.error("End time must be greater than start time");
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        targetRole: form.targetRole,
        displayType: form.displayType,
        startDateTime: form.startDateTime,
        endDateTime: form.displayType === "custom" ? (form.endDateTime || calculatedEndDate) : null,
        durationValue: form.displayType === "custom" ? form.durationValue : "",
        durationUnit: form.displayType === "custom" ? form.durationUnit : "hours",
      };

      await axios.post(`${API_URL}/admin/notifications`, payload, tokenHeader());
      toast.success("Notification created");
      setForm({
        title: "",
        message: "",
        targetRole: "all",
        displayType: "permanent",
        startDateTime: new Date().toISOString().slice(0, 16),
        endDateTime: "",
        durationValue: "",
        durationUnit: "hours",
      });
      loadNotifications();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create notification");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id) => {
    try {
      await axios.patch(`${API_URL}/admin/notifications/${id}/deactivate`, {}, tokenHeader());
      toast.success("Notification deactivated");
      loadNotifications();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to deactivate notification");
    }
  };

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.title}</p>
          <p className="text-xs text-gray-500 line-clamp-1">{row.message}</p>
        </div>
      ),
    },
    {
      key: "targetRole",
      label: "Target",
      render: (row) => (
        <span className="text-xs font-semibold uppercase text-gray-700">{row.targetRole || "all"}</span>
      ),
    },
    {
      key: "startDateTime",
      label: "Start Time",
      render: (row) => <span className="text-xs text-gray-600">{new Date(row.startDateTime).toLocaleString()}</span>,
    },
    {
      key: "endDateTime",
      label: "End Time",
      render: (row) => (
        <span className="text-xs text-gray-600">
          {row.isPermanent ? "Permanent" : row.endDateTime ? new Date(row.endDateTime).toLocaleString() : "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusClasses(row.status)}`}>
            {row.status}
          </span>
          {row.remainingTime && row.remainingTime !== "Expired" && (
            <span className="text-[10px] text-gray-500">{row.remainingTime} left</span>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) =>
        row.isActive ? (
          <button
            onClick={() => handleDeactivate(row._id)}
            className="px-3 py-1 rounded-lg bg-rose-50 text-rose-700 text-xs font-bold border border-rose-100"
          >
            Deactivate
          </button>
        ) : (
          <span className="text-xs text-gray-400">Inactive</span>
        ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">
          Create permanent, scheduled, or time-based notifications for all users, farmers, or customers.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-green-100 rounded-2xl shadow-md shadow-green-50 p-5 space-y-4"
      >
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">Title</label>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
              placeholder="New feature, maintenance window, etc."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Target</label>
            <select
              name="targetRole"
              value={form.targetRole}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
            >
              <option value="all">All Users</option>
              <option value="farmer">Only Farmers</option>
              <option value="customer">Only Customers</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
          <textarea
            name="message"
            rows={3}
            value={form.message}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
            placeholder="Write a clear, concise announcement..."
          />
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Display Type</label>
            <select
              name="displayType"
              value={form.displayType}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
            >
              <option value="permanent">Permanent</option>
              <option value="custom">Set Expiry</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Start DateTime</label>
            <input
              type="datetime-local"
              name="startDateTime"
              value={form.startDateTime}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
            />
          </div>

          {form.displayType === "custom" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">End DateTime</label>
                <input
                  type="datetime-local"
                  name="endDateTime"
                  value={form.endDateTime || calculatedEndDate}
                  onChange={handleChange}
                  className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Duration</label>
                  <input
                    type="number"
                    min="1"
                    name="durationValue"
                    value={form.durationValue}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
                    placeholder="e.g. 2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Unit</label>
                  <select
                    name="durationUnit"
                    value={form.durationUnit}
                    onChange={handleChange}
                    className="w-full px-3 py-2 rounded-xl border border-green-100 text-sm shadow-sm"
                  >
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-[0.18em] shadow-md hover:bg-green-700 transition disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Create Notification"}
          </button>
        </div>
      </form>

      <section className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">History</h2>
        {loading ? (
          <p className="text-sm text-gray-500">Loading notifications...</p>
        ) : (
          <AdminTable
            columns={columns}
            rows={notifications}
            getRowId={(row) => row._id}
            emptyMessage="No notifications created yet."
          />
        )}
      </section>
    </div>
  );
};

export default NotificationsPage;
