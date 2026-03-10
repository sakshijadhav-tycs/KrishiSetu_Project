import { Link } from "react-router-dom";
import { FaStar, FaTrophy } from "react-icons/fa";
import { BACKEND_URL } from "../config/api";
import FarmerVerificationBadge from "./FarmerVerificationBadge";
import { resolveImageUrl } from "../utils/imageUrl";

const ProductCard = ({ product, disableLocalization = false }) => {
  const placeholder = "https://placehold.co/300x200?text=No+Image+Available";

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = placeholder;
  };

  if (!product) return null;

  const lang = i18n.language || "en";
  const localizedName = disableLocalization
    ? product.name
    : (lang === "hi" && product.name_hi) ||
      (lang === "mr" && product.name_mr) ||
      product.name;
  const avgRating = Number(product.avgRating || 0);
  const performanceScore = Number(
    product.farmerPerformanceScore || product.performanceScore || 0
  );

  const getImageUrl = (imagePath) => {
    if (!imagePath) return placeholder;
    return resolveImageUrl(imagePath, BACKEND_URL) || placeholder;
  };

  return (
    <div className="card transition-transform duration-300 border dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-1 bg-white dark:bg-gray-800 overflow-hidden">
      <div className="relative h-48 overflow-hidden">
        {product.images && product.images.length > 0 ? (
          <img
            src={getImageUrl(product.images[0])}
            alt={product.name}
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={placeholder}
            alt="placeholder"
            className="w-full h-full object-cover"
          />
        )}

        {product.isOrganic && (
          <span className="absolute top-2 right-2 bg-green-600 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-full shadow-sm">
            Organic
          </span>
        )}
        {product?.pricing?.hasDeal && (
          <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] uppercase font-black px-2 py-1 rounded-full shadow-sm">
            {product?.activeDeal?.badge || "🔥 Limited Time Deal"}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-semibold mb-1 truncate text-gray-800 dark:text-gray-200">
          {localizedName}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
          {product.category?.name || "General"}
        </p>
        {product.farmer?.name && (
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {product.farmer.name}
            </span>
            <FarmerVerificationBadge verified={Boolean(product.farmer?.verified_badge)} />
          </div>
        )}

        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
            <FaStar className="text-[10px]" />
            <span>{avgRating > 0 ? avgRating.toFixed(1) : "New"}</span>
          </div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-full">
            <FaTrophy className="text-[10px]" />
            <span>{Math.round(performanceScore)} score</span>
          </div>
        </div>

        <div className="flex justify-between items-center border-t dark:border-gray-700 pt-3">
          <div className="flex flex-col">
            {product?.pricing?.hasDeal ? (
              <>
                <span className="text-[11px] text-gray-400 line-through font-bold">
                  Rs {Number(product.pricing.originalPrice || product.price || 0).toFixed(2)}
                </span>
                <span className="text-red-600 dark:text-red-400 font-black text-lg">
                  Rs {Number(product.pricing.finalPrice || 0).toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                Rs {product.price ? product.price.toFixed(2) : "0.00"}
              </span>
            )}
            <span className="text-gray-400 dark:text-gray-500 text-[10px]">
              {t("products.pricePerUnit", {
                unit: product.unit || t("cart.unitFallback"),
              })}
            </span>
          </div>

          <Link
            to={`/products/${product._id}`}
            className="btn btn-primary !px-4 !py-2 !text-sm"
          >
            {t("products.buyNow")}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
