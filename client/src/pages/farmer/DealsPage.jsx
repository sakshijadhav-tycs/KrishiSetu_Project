"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const initialForm = {
  productId: "",
  discountType: "percentage",
  discountValue: "",
  startDate: "",
  endDate: "",
  isEnabled: true,
};

const statusChipClass = {
  active: "bg-green-100 text-green-800",
  scheduled: "bg-blue-100 text-blue-800",
  expired: "bg-gray-100 text-gray-700",
  disabled: "bg-red-100 text-red-800",
};

const DealsPage = () => {
  const [products, setProducts] = useState([]);
  const [deals, setDeals] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);

  const tokenHeader = useMemo(
    () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
    []
  );

  const loadProducts = async () => {
    const { data } = await axios.get(`${API_URL}/products/farmer/me`, tokenHeader);
    setProducts(data?.data || []);
  };

  const loadDeals = async (status = "all") => {
    const { data } = await axios.get(`${API_URL}/deals/farmer/me?status=${status}`, tokenHeader);
    setDeals(data?.data || []);
  };

  const loadPage = async (status = "all") => {
    try {
      setLoading(true);
      await Promise.all([loadProducts(), loadDeals(status)]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load deals");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage(statusFilter);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setForm(initialForm);
    setEditingId(null);
  };

  const submitDeal = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        discountValue: Number(form.discountValue),
      };
      if (editingId) {
        await axios.put(`${API_URL}/deals/${editingId}`, payload, tokenHeader);
        toast.success("Deal updated");
      } else {
        await axios.post(`${API_URL}/deals`, payload, tokenHeader);
        toast.success("Deal created");
      }
      resetForm();
      await loadDeals(statusFilter);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save deal");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (deal) => {
    setEditingId(deal._id);
    setForm({
      productId: deal?.productId?._id || "",
      discountType: deal.discountType,
      discountValue: String(deal.discountValue ?? ""),
      startDate: new Date(deal.startDate).toISOString().slice(0, 10),
      endDate: new Date(deal.endDate).toISOString().slice(0, 10),
      isEnabled: Boolean(deal.isEnabled),
    });
  };

  const toggleDeal = async (deal) => {
    try {
      await axios.put(
        `${API_URL}/deals/${deal._id}`,
        {
          isEnabled: !deal.isEnabled,
          disabledReason: deal.isEnabled ? "Disabled by farmer" : "",
        },
        tokenHeader
      );
      toast.success(deal.isEnabled ? "Deal disabled" : "Deal enabled");
      await loadDeals(statusFilter);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update deal status");
    }
  };

  const onStatusFilterChange = async (status) => {
    setStatusFilter(status);
    await loadDeals(status);
  };

  if (loading) {
    return <div className="p-6">Loading deals...</div>;
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Deals</h1>
        <p className="text-sm text-gray-500">Create and manage time-bound discounts for your products.</p>
      </div>

      <form onSubmit={submitDeal} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm uppercase tracking-widest font-black text-gray-500">
          {editingId ? "Edit Deal" : "Create Deal"}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.productId}
            onChange={(e) => setForm((prev) => ({ ...prev, productId: e.target.value }))}
            required
          >
            <option value="">Select product</option>
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} (Rs {Number(p.price || 0).toFixed(2)})
              </option>
            ))}
          </select>

          <select
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.discountType}
            onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value }))}
            required
          >
            <option value="percentage">Discount Percentage</option>
            <option value="fixedPrice">Fixed Deal Price</option>
          </select>

          <input
            type="number"
            min="0"
            step="0.01"
            className="border rounded-lg px-3 py-2 text-sm"
            placeholder={form.discountType === "percentage" ? "Discount %" : "Deal price"}
            value={form.discountValue}
            onChange={(e) => setForm((prev) => ({ ...prev, discountValue: e.target.value }))}
            required
          />

          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.startDate}
            onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            required
          />

          <input
            type="date"
            className="border rounded-lg px-3 py-2 text-sm"
            value={form.endDate}
            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            required
          />

          <label className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.isEnabled}
              onChange={(e) => setForm((prev) => ({ ...prev, isEnabled: e.target.checked }))}
            />
            Enable immediately
          </label>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="bg-green-600 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-green-700"
          >
            {saving ? "Saving..." : editingId ? "Update Deal" : "Create Deal"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="border border-gray-300 text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <h2 className="text-sm uppercase tracking-widest font-black text-gray-500">Your Deals</h2>
          <select
            className="border rounded-lg px-3 py-2 text-sm w-44"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="scheduled">Scheduled</option>
            <option value="expired">Expired</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2">Product</th>
                <th className="py-2">Discount</th>
                <th className="py-2">Period</th>
                <th className="py-2">Pricing</th>
                <th className="py-2">Deal Sales</th>
                <th className="py-2">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.length === 0 && (
                <tr>
                  <td className="py-4 text-gray-500" colSpan={7}>
                    No deals found.
                  </td>
                </tr>
              )}
              {deals.map((deal) => (
                <tr key={deal._id} className="border-b align-top">
                  <td className="py-3 font-semibold">{deal?.productId?.name || "Deleted Product"}</td>
                  <td className="py-3">
                    {deal.discountType === "percentage"
                      ? `${Number(deal.discountValue || 0)}%`
                      : `Fixed Rs ${Number(deal.discountValue || 0).toFixed(2)}`}
                  </td>
                  <td className="py-3">
                    {new Date(deal.startDate).toLocaleDateString()} - {new Date(deal.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-3">
                    <div className="text-xs text-gray-500 line-through">
                      Rs {Number(deal?.pricing?.originalPrice || 0).toFixed(2)}
                    </div>
                    <div className="font-black text-red-600">
                      Rs {Number(deal?.pricing?.discountedPrice || 0).toFixed(2)}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-semibold">Rs {Number(deal?.revenue?.revenue || 0).toFixed(2)}</div>
                    <div className="text-xs text-gray-500">{Number(deal?.revenue?.units || 0)} units</div>
                  </td>
                  <td className="py-3">
                    <span
                      className={`text-xs font-bold px-2 py-1 rounded-full ${
                        statusChipClass[deal.dealStatus] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {deal.dealStatus}
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(deal)}
                        className="text-xs border border-gray-300 px-2 py-1 rounded-md"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDeal(deal)}
                        className={`text-xs px-2 py-1 rounded-md text-white ${
                          deal.isEnabled ? "bg-red-500" : "bg-green-600"
                        }`}
                      >
                        {deal.isEnabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DealsPage;
