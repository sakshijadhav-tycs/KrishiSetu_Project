"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const SettingsPage = () => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `${API_URL}/admin/settings`,
        tokenHeader()
      );
      setSettings(data.data || {});
    } catch {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API_URL}/admin/settings`, settings, tokenHeader());
      toast.success("Settings updated");
      loadSettings();
    } catch {
      toast.error("Failed to update settings");
    }
  };

  if (loading && !settings) {
    return <p className="text-sm text-gray-500">Loading settings...</p>;
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Platform Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure global platform behaviour and support information.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Platform Name
            </label>
            <input
              type="text"
              name="platformName"
              value={settings.platformName || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Support Email
            </label>
            <input
              type="email"
              name="supportEmail"
              value={settings.supportEmail || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Support Phone
            </label>
            <input
              type="text"
              name="supportPhone"
              value={settings.supportPhone || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Default Commission %
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              name="defaultCommissionPercent"
              value={settings.defaultCommissionPercent || 0}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Minimum Payout Amount
            </label>
            <input
              type="number"
              min="0"
              name="minPayoutAmount"
              value={settings.minPayoutAmount || 0}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
          <label className="flex items-center gap-3 text-sm text-gray-700">
            <input
              type="checkbox"
              name="maintenanceMode"
              checked={!!settings.maintenanceMode}
              onChange={handleChange}
              className="rounded border-gray-300"
            />
            Enable maintenance mode
          </label>
          <div className="w-full md:w-1/2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Maintenance message
            </label>
            <input
              type="text"
              name="maintenanceMessage"
              value={settings.maintenanceMessage || ""}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs"
              placeholder="Short message shown to users during maintenance"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-[0.18em]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default SettingsPage;

