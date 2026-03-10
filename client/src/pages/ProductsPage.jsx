"use client";

import { useEffect, useState, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";

// Actions
import { getProducts, clearProductError } from "../redux/slices/productSlice";
import { getCategories, clearCategoryError } from "../redux/slices/categorySlice";

// Components
import ProductCard from "../components/ProductCard";
import Loader from "../components/Loader";
import { FaSearch, FaLeaf } from "react-icons/fa";
const ProductsPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();

  // 1. Extract state with error handling
  const { products = [], loading: productLoading, error: productError } = useSelector((state) => state.products || {});
  const { categories = [], loading: categoryLoading, error: categoryError } = useSelector((state) => state.categories || {});

  const [filters, setFilters] = useState({
    category: "",
    search: "",
  });

  // 2. Fetch data and handle URL params on mount
  useEffect(() => {
    dispatch(getCategories());
    dispatch(getProducts());

    const params = new URLSearchParams(location.search);
    const categoryId = params.get("category");
    if (categoryId) {
      setFilters((prev) => ({ ...prev, category: categoryId }));
    }
  }, [dispatch, location.search]);

  // 3. Global Error Handling Effect (Crucial to prevent "An error occurred" loops)
  useEffect(() => {
    if (productError) {
      toast.error(productError);
      dispatch(clearProductError());
    }
    if (categoryError) {
      toast.error(categoryError);
      dispatch(clearCategoryError());
    }
  }, [productError, categoryError, dispatch]);

  // 4. Optimized Filtering Logic using useMemo for performance
  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
      const matchesCategory =
        filters.category === "" ||
        product.category?._id === filters.category ||
        product.category === filters.category;

      const matchesSearch = (product.name || "")
        .toLowerCase()
        .includes(filters.search.toLowerCase());

      return matchesCategory && matchesSearch;
      })
      .sort((a, b) => {
        const scoreA = a.farmerPerformanceScore ?? a.performanceScore ?? 0;
        const scoreB = b.farmerPerformanceScore ?? b.performanceScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const ratingA = a.avgRating ?? 0;
        const ratingB = b.avgRating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;

        return (a.name || "").localeCompare(b.name || "");
      });
  }, [products, filters]);

  if (productLoading || categoryLoading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen bg-white dark:bg-gray-900">
      <h1 className="text-3xl font-bold mb-6 text-slate-800 dark:text-gray-100">
        {t("products.browseTitle")}
      </h1>

      {/* Categories Bar */}
      <div className="flex flex-wrap gap-3 mb-8">
        <button
          onClick={() => setFilters({ ...filters, category: "" })}
          className={`px-6 py-2 rounded-full border transition-all duration-300 ${filters.category === ""
              ? "bg-green-700 text-white border-green-700 shadow-md"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400"
            }`}
        >
          {t("products.all")}
        </button>

        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => setFilters({ ...filters, category: cat._id })}
            className={`px-6 py-2 rounded-full border transition-all duration-300 ${filters.category === cat._id
                ? "bg-green-700 text-white border-green-700 shadow-md"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-green-500 hover:text-green-600 dark:hover:text-green-400"
              }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="mb-8 relative max-w-xl">
        <input
          type="text"
          placeholder={t("products.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          className="w-full px-4 py-3 pl-12 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
        <FaSearch className="absolute top-4 left-4 text-gray-400 dark:text-gray-500" />
      </div>

      {/* Product Grid */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product._id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <FaLeaf className="text-green-200 dark:text-green-900 text-6xl mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 text-xl font-medium">
            {t("products.noMatch")}
          </p>
          <button
            onClick={() => setFilters({ category: "", search: "" })}
            className="mt-4 text-green-600 dark:text-green-400 font-semibold hover:underline"
          >
            {t("products.clearFilters")}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductsPage;
