import { Link } from "react-router-dom";
import { FaMapMarkerAlt, FaStar, FaChartLine } from "react-icons/fa";
import { BACKEND_URL } from "../config/api";
import { resolveImageUrl } from "../utils/imageUrl";
import FarmerVerificationBadge from "./FarmerVerificationBadge";

const FarmerCard = ({ farmer }) => {
  const avgRating = Number(farmer.avgRating || 0);
  const performanceScore = Number(farmer.performanceScore || 0);
  const profileImageSrc = resolveImageUrl(farmer?.profileImage, BACKEND_URL) || "/logo.png";

  return (
    <div className="card transition-transform duration-300">
      <div className="p-6">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <img
              src={profileImageSrc}
              alt={farmer?.name || "Farmer"}
              className="w-full h-full rounded-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "/logo.png";
              }}
            />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-semibold dark:text-gray-100">{farmer.name}</h3>
              <FarmerVerificationBadge verified={Boolean(farmer?.verified_badge)} />
            </div>
            {farmer.address && (
              <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm">
                <FaMapMarkerAlt className="mr-1" />
                <span>
                  {farmer.address.city}, {farmer.address.state}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300">
            <FaStar className="text-[10px]" />
            {avgRating > 0 ? avgRating.toFixed(1) : "New"}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
            <FaChartLine className="text-[10px]" />
            {Math.round(performanceScore)} score
          </span>
        </div>

        <Link
          to={`/farmers/${farmer._id}`}
          className="block w-full bg-green-500 text-white text-center py-2 rounded-lg hover:bg-green-600 transition-colors"
        >
          View Farm
        </Link>
      </div>
    </div>
  );
};

export default FarmerCard;
