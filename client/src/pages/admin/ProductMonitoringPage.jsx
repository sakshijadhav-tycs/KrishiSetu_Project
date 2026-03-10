"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ProductMonitoringPage = () => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [removing, setRemoving] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const formatHarvestDate = (value) => {
    if (!value) return "Not provided";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "Not provided";
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      const { data } = await axios.get(`${API_URL}/admin/products`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setProducts(data.data || []);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleHide = async () => {
    if (!removing) return;
    if (!reason.trim()) {
      toast.error("Please provide a reason for removal.");
      return;
    }
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/admin/products/${removing._id}/hide`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success("Product marked as inactive");
      setRemoving(null);
      setReason("");
      fetchProducts();
    } catch {
      toast.error("Failed to update product");
    }
  };

  const filtered = useMemo(() => {
    let data = [...products];

    if (filter !== "all") {
      data = data.filter((p) => {
        if (filter === "expired") return p.flags?.isExpired;
        if (filter === "duplicate") return p.flags?.isDuplicate;
        if (filter === "inactive") return p.flags?.isInactive;
        return true;
      });
    }

    if (search.trim()) {
      const term = search.toLowerCase();
      data = data.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.farmer?.name?.toLowerCase().includes(term)
      );
    }

    return data;
  }, [products, filter, search]);

  const columns = [
    {
      key: "name",
      label: "Product",
      render: (row) => (
        <div>
          <p className="font-semibold text-gray-900">{row.name}</p>
          <p className="text-xs text-gray-500">
            {row.category?.name || "Uncategorised"}
          </p>
        </div>
      ),
    },
    {
      key: "farmer",
      label: "Farmer",
      render: (row) => (
        <p className="text-xs text-gray-700">{row.farmer?.name || "-"}</p>
      ),
    },
    {
      key: "price",
      label: "Price",
      align: "right",
      render: (row) => (
        <span className="font-semibold text-gray-800">
          ₨{row.price?.toFixed(2)}
        </span>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      align: "right",
      render: (row) => (
        <span className="text-xs text-gray-700">
          {row.quantityAvailable} {row.unit}
        </span>
      ),
    },
    {
      key: "flags",
      label: "Flags",
      render: (row) => {
        const flags = [];
        if (row.flags?.isExpired) flags.push("Expired");
        if (row.flags?.isDuplicate) flags.push("Duplicate");
        if (row.flags?.isInactive) flags.push("Inactive");
        if (!flags.length)
          return <span className="text-xs text-emerald-600">Healthy</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
              <StatusBadge key={f} status={f} />
            ))}
          </div>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => setSelectedProduct(row)}
            className="px-3 py-1 rounded-xl bg-green-50 text-green-700 text-[11px] font-bold hover:bg-green-100 transition"
          >
            Details
          </button>
          <button
            onClick={() => setRemoving(row)}
            className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-bold hover:bg-rose-100 transition"
            disabled={row.flags?.isInactive}
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">
            Product Monitoring
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Detect expired, duplicate or inappropriate listings and keep the
            marketplace clean.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by product or farmer..."
            className="px-3 py-2 rounded-xl border border-green-100 bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-green-100 bg-white shadow-sm"
          >
            <option value="all">All products</option>
            <option value="expired">Expired</option>
            <option value="duplicate">Duplicate</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading products...</p>
      ) : (
        <AdminTable
          columns={columns}
          rows={filtered}
          getRowId={(row) => row._id}
          emptyMessage="No products found."
        />
      )}
      {selectedProduct && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-green-100 p-6 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
              Product Details
            </h2>
            <div className="space-y-2 text-sm text-gray-700">
              <p>
                <span className="font-semibold">Product:</span> {selectedProduct.name || "-"}
              </p>
              <p>
                <span className="font-semibold">Farmer:</span> {selectedProduct.farmer?.name || "-"}
              </p>
              <p>
                <span className="font-semibold">Category:</span> {selectedProduct.category?.name || "-"}
              </p>
              <p>
                <span className="font-semibold">Price:</span> Rs {Number(selectedProduct.price || 0).toFixed(2)}
              </p>
              <p>
                <span className="font-semibold">Harvest Date:</span> {formatHarvestDate(selectedProduct.harvestDate)}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedProduct(null)}
                className="px-5 py-2 rounded-xl border border-green-600 text-xs font-bold text-green-700 hover:bg-green-50 transition shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {removing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-green-100 p-6 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
              Remove Product
            </h2>
            <p className="text-sm text-gray-600">
              You are about to remove{" "}
              <span className="font-semibold">{removing.name}</span>. Please
              provide a short reason for this action. This will be stored in the
              audit log.
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-green-100 text-xs"
              placeholder="Example: Misleading information or policy violation"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRemoving(null);
                  setReason("");
                }}
                className="px-5 py-2 rounded-xl border border-green-600 text-xs font-bold text-green-700 hover:bg-green-50 transition shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleHide}
                className="px-5 py-2 rounded-xl bg-green-600 text-white text-xs font-bold hover:bg-green-700 shadow-md hover:shadow-lg transition"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductMonitoringPage;

