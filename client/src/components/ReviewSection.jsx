import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import axios from "axios";
import { FaStar, FaUserCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { API_URL } from "../config/api";

const ReviewSection = ({ farmerId }) => {
  const { userInfo, isAuthenticated } = useSelector((state) => state.auth);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ avgRating: 0, totalReviews: 0 });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // 1. Fetch Reviews
  const fetchReviews = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/reviews/${farmerId}`);
      setReviews(data.data);
    } catch (err) {
      console.error("Error fetching reviews");
    }
  };

  const fetchSummary = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/reviews/summary/${farmerId}`);
      setSummary({
        avgRating: Number(data.avgRating || 0),
        totalReviews: Number(data.totalReviews || 0),
      });
    } catch (err) {
      console.error("Error fetching review summary");
    }
  };

  useEffect(() => {
    fetchReviews();
    fetchSummary();
  }, [farmerId]);

  // 2. Average Rating Summary
  const avgRating = Number(summary.avgRating || 0).toFixed(1);

  // 3. Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) return toast.error("Please select a rating");
    
    setLoading(true);
    try {
      const config = {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      };
      await axios.post(`${API_URL}/reviews`, { farmerId, rating, comment }, config);
      toast.success("Review submitted!");
      setRating(0);
      setComment("");
      await Promise.all([fetchReviews(), fetchSummary()]); // Refresh list
    } catch (err) {
      toast.error(err.response?.data?.message || "Error submitting review");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-12 border-t pt-8">
      <h3 className="text-2xl font-bold mb-6">Customer Reviews</h3>

      {/* --- Rating Summary --- */}
      <div className="flex items-center mb-8 bg-green-50 p-6 rounded-xl">
        <div className="text-center mr-8">
          <h1 className="text-5xl font-black text-green-700">{avgRating}</h1>
          <p className="text-gray-600 text-sm">{summary.totalReviews} Reviews</p>
        </div>
        <div className="flex text-yellow-400 text-2xl">
          {[...Array(5)].map((_, i) => (
            <FaStar key={i} className={i < Math.floor(avgRating) ? "fill-current" : "text-gray-300"} />
          ))}
        </div>
      </div>

      {/* --- Review Form (Visible only to logged-in customers) --- */}
      {isAuthenticated && userInfo?.role === "consumer" ? (
        <form onSubmit={handleSubmit} className="mb-10 bg-white p-6 rounded-xl shadow-sm border">
          <h4 className="font-bold mb-4">Leave a Review</h4>
          <div className="flex mb-4">
            {[...Array(5)].map((_, i) => {
              const ratingValue = i + 1;
              return (
                <label key={i}>
                  <input type="radio" className="hidden" value={ratingValue} onClick={() => setRating(ratingValue)} />
                  <FaStar
                    className="cursor-pointer transition-colors text-2xl mr-1"
                    color={ratingValue <= (hover || rating) ? "#ffc107" : "#e4e5e9"}
                    onMouseEnter={() => setHover(ratingValue)}
                    onMouseLeave={() => setHover(0)}
                  />
                </label>
              );
            })}
          </div>
          <textarea
            className="w-full p-3 border rounded-lg outline-none focus:ring-2 focus:ring-green-500"
            rows="3"
            placeholder="Share your experience with this farmer..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="mt-3 bg-green-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-700 transition-all disabled:opacity-50"
          >
            {loading ? "Posting..." : "Post Review"}
          </button>
        </form>
      ) : (
        <p className="mb-6 text-gray-500 italic">Please login as a consumer to leave a review.</p>
      )}

      {/* --- Feedback List --- */}
      <div className="space-y-6">
        {reviews.length === 0 ? (
          <p className="text-gray-400">No reviews yet for this farm.</p>
        ) : (
          reviews.map((review) => (
            <div key={review._id} className="flex gap-4 p-4 border-b">
              <FaUserCircle className="text-4xl text-gray-300" />
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <h5 className="font-bold text-gray-800">{review.customerName}</h5>
                  <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex text-yellow-400 text-sm mb-2">
                  {[...Array(5)].map((_, i) => (
                    <FaStar key={i} className={i < review.rating ? "fill-current" : "text-gray-300"} />
                  ))}
                </div>
                <p className="text-gray-600">{review.comment}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ReviewSection;
