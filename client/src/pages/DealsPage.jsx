"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { FaTag, FaSearch } from "react-icons/fa";
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import toast from "react-hot-toast";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const DealsPage = () => {
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get(`${API_URL}/deals/public/active`);
        setProducts(data?.data || []);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Failed to load deals");
      } finally {
        setLoading(false);
      }
    };
    loadDeals();
  }, []);

  const dealProducts = useMemo(() => {
    return (products || [])
      .filter((p) => (p?.name || "").toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const aOriginal = Number(a?.pricing?.originalPrice || a?.price || 0);
        const aFinal = Number(a?.pricing?.finalPrice || a?.price || 0);
        const bOriginal = Number(b?.pricing?.originalPrice || b?.price || 0);
        const bFinal = Number(b?.pricing?.finalPrice || b?.price || 0);
        const aOff = aOriginal > 0 ? ((aOriginal - aFinal) / aOriginal) * 100 : 0;
        const bOff = bOriginal > 0 ? ((bOriginal - bFinal) / bOriginal) * 100 : 0;
        return bOff - aOff;
      });
  }, [products, search]);

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-white dark:bg-gray-900">
      <div className="flex items-center gap-3 mb-2">
        <FaTag className="text-red-500" />
        <h1 className="text-3xl font-black text-gray-800 dark:text-gray-100">Deals</h1>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Browse all products currently running a limited-time discount.
      </p>

      <div className="mb-8 relative max-w-xl">
        <input
          type="text"
          placeholder="Search deal products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-3 pl-12 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <FaSearch className="absolute top-4 left-4 text-gray-400 dark:text-gray-500" />
      </div>

      {dealProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {dealProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 text-xl font-medium">
            No active deals found right now.
          </p>
        </div>
      )}
    </div>
  );
};

export default DealsPage;
