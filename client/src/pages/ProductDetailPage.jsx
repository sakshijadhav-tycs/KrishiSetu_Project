"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getProductDetails, clearProductDetails } from "../redux/slices/productSlice";
import { addToCart } from "../redux/slices/cartSlice";
import Loader from "../components/Loader";
import { FaShoppingCart, FaCheckCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { BACKEND_URL } from "../config/api";
import FarmerVerificationBadge from "../components/FarmerVerificationBadge";
import { resolveImageUrl } from "../utils/imageUrl";

const ProductDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  const { product, loading, error } = useSelector((state) => state.products);
  const { userInfo } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(getProductDetails(id));
    return () => {
      dispatch(clearProductDetails());
    };
  }, [dispatch, id]);

  const addToCartHandler = () => {
    if (!userInfo) {
      toast.warn(t("products.loginToAdd"));
      navigate("/login");
      return;
    }

    if (product) {
      const safeFarmer = product.farmer || { _id: "600000000000000000000001", name: "Farm Fresh Farmer" };
      const cartPrice = Number(product?.pricing?.finalPrice ?? product.price ?? 0);
      dispatch(addToCart({
        product: { ...product, farmer: safeFarmer, price: cartPrice },
        quantity: qty
      }));
      toast.success(
        t("products.addedToCart", { name: product.name })
      );
      navigate("/cart");
    } else {
      toast.error(t("products.detailsUnavailable"));
    }
  };

  if (loading) return <Loader />;
  if (error) return (
    <div className="text-center mt-20">
      <p className="text-red-500 text-xl mb-4">{error}</p>
      <Link to="/products" className="text-green-600 font-bold underline">
        {t("products.goBackShopLink")}
      </Link>
    </div>
  );
  if (!product) return null;

  const lang = i18n.language || "en";
  const localizedName =
    (lang === "hi" && product.name_hi) ||
    (lang === "mr" && product.name_mr) ||
    product.name;
  const localizedDescription =
    (lang === "hi" && product.description_hi) ||
    (lang === "mr" && product.description_mr) ||
    product.description;
  const formattedHarvestDate = product.harvestDate
    ? new Date(product.harvestDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 bg-white p-8 rounded-2xl shadow-md border border-gray-100">
        <div className="flex justify-center items-center bg-gray-50 rounded-xl overflow-hidden min-h-[400px]">
          <img
            src={product.images && product.images.length > 0
              ? resolveImageUrl(product.images[0], BACKEND_URL)
              : "https://via.placeholder.com/500?text=No+Image"}
            alt={product.name}
            className="w-full h-auto object-cover max-h-[500px]"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "https://via.placeholder.com/500?text=Image+Not+Found";
            }}
          />
        </div>

        <div className="flex flex-col">
          <h1 className="text-4xl font-extrabold text-gray-800 mb-2">
            {localizedName}
          </h1>

          <div className="flex flex-wrap items-center gap-4 mb-4">
            <span className="bg-green-100 text-green-700 text-sm font-bold px-3 py-1 rounded-full flex items-center">
              <FaCheckCircle className="mr-1" /> {product.category?.name || "Organic"}
            </span>

            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              <span className="text-xs text-gray-500 font-medium italic">Sold by:</span>
              <span className="text-green-600 font-bold hover:underline cursor-pointer">
                {product.farmer?.name || "Unknown Farmer"}
              </span>
              <FarmerVerificationBadge verified={Boolean(product.farmer?.verified_badge)} />
            </div>
          </div>

          {product?.pricing?.hasDeal ? (
            <div className="mb-4">
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 text-xs font-black px-2 py-1 mb-2">
                {product?.activeDeal?.badge || "🔥 Limited Time Deal"}
              </span>
              <div className="text-lg text-gray-400 line-through font-bold">
                Rs {Number(product?.pricing?.originalPrice || product.price || 0).toFixed(2)}
              </div>
              <p className="text-3xl font-black text-red-600">
                Rs {Number(product?.pricing?.finalPrice || 0).toFixed(2)}{" "}
                <span className="text-sm text-gray-500 font-normal">
                  {t("products.pricePerUnit", { unit: product.unit })}
                </span>
              </p>
            </div>
          ) : (
            <p className="text-3xl font-bold text-green-600 mb-4">
              Rs {product.price}{" "}
              <span className="text-sm text-gray-500 font-normal">
                {t("products.pricePerUnit", { unit: product.unit })}
              </span>
            </p>
          )}

          <div className="mb-6 text-gray-600 leading-relaxed border-b pb-6">
            {localizedDescription}
            {formattedHarvestDate && (
              <p className="mt-4 text-sm font-semibold text-gray-700">
                Harvest Date: {formattedHarvestDate}
              </p>
            )}
          </div>

          <div className="border border-gray-200 p-6 rounded-xl bg-gray-50">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-gray-700">
                {t("cart.itemsLabel", { count: qty })}
              </span>
              <select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-24 p-2 border rounded-md bg-white focus:ring-2 focus:ring-green-500 outline-none"
              >
                {[...Array(product.quantityAvailable > 0 ? Math.min(product.quantityAvailable, 10) : 10).keys()].map((x) => (
                  <option key={x + 1} value={x + 1}>{x + 1}</option>
                ))}
              </select>
            </div>

            <button
              onClick={addToCartHandler}
              disabled={product.quantityAvailable === 0}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center transition-all shadow-lg active:scale-95 ${
                product.quantityAvailable === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              <FaShoppingCart className="mr-2" />
              {product.quantityAvailable === 0
                ? t("products.outOfStock")
                : t("products.addToCart")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;
