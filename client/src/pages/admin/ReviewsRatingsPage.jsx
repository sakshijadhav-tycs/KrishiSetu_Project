"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";
import AdminTable from "../../components/admin/AdminTable";
import StatusBadge from "../../components/admin/StatusBadge";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const ReviewsRatingsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [lowRated, setLowRated] = useState([]);
  const [loading, setLoading] = useState(true);

  const tokenHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [reviewsRes, lowRatedRes] = await Promise.all([
        axios.get(`${API_URL}/admin/reviews`, tokenHeader()),
        axios.get(`${API_URL}/admin/farmers/low-rated`, tokenHeader()),
      ]);
      setReviews(reviewsRes.data.data || []);
      setLowRated(lowRatedRes.data.data || []);
    } catch {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const hideReview = async (id) => {
    try {
      await axios.delete(`${API_URL}/admin/reviews/${id}`, tokenHeader());
      toast.success("Review removed");
      loadData();
    } catch {
      toast.error("Failed to remove review");
    }
  };

  const reviewColumns = [
    {
      key: "farmer",
      label: "Farmer",
      render: (row) => (
        <p className="text-xs text-gray-800">
          {row.farmerId?.name || "Unknown"}
        </p>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (row) => (
        <p className="text-xs text-gray-700">
          {row.customerName} ({row.customerId?.email || "N/A"})
        </p>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (row) => (
        <span className="text-xs font-semibold text-amber-600">
          {row.rating} / 5
        </span>
      ),
    },
    {
      key: "comment",
      label: "Comment",
      render: (row) => (
        <p className="text-xs text-gray-600 line-clamp-1">{row.comment}</p>
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      render: (row) => (
        <span className="text-xs text-gray-500">
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
          onClick={() => hideReview(row._id)}
          className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 text-[11px] font-bold"
        >
          Remove
        </button>
      ),
    },
  ];

  const lowRatedColumns = [
    {
      key: "farmer",
      label: "Farmer",
      render: (row) => (
        <p className="text-xs text-gray-800">
          {row.farmer?.name || "Unknown"}
        </p>
      ),
    },
    {
      key: "rating",
      label: "Avg Rating",
      render: (row) => (
        <span className="text-xs font-semibold text-amber-700">
          {row.avgRating.toFixed(1)} / 5
        </span>
      ),
    },
    {
      key: "reviews",
      label: "Reviews",
      render: (row) => (
        <span className="text-xs text-gray-700">{row.totalReviews}</span>
      ),
    },
    {
      key: "flag",
      label: "Risk",
      render: () => <StatusBadge status="Low Rating" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-black text-gray-900">
          Reviews & Ratings
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Audit reviews, remove inappropriate content and watch low-rated
          farmers.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading reviews...</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
              Recent Reviews
            </h2>
            <AdminTable
              columns={reviewColumns}
              rows={reviews}
              getRowId={(row) => row._id}
              emptyMessage="No reviews found."
            />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-gray-500">
              Low-Rated Farmers
            </h2>
            <AdminTable
              columns={lowRatedColumns}
              rows={lowRated}
              getRowId={(row, idx) => row.farmer?._id || idx}
              emptyMessage="No low-rated farmers."
            />
          </section>
        </>
      )}
    </div>
  );
};

export default ReviewsRatingsPage;

