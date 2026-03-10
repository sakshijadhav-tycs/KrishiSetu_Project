import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { getAllFarmers } from "../redux/slices/farmerSlice";
import FarmerCard from "../components/FarmerCard";
import FarmersMap from "../components/FarmersMap";
import Loader from "../components/Loader";
import { FaList } from "react-icons/fa";

const FarmersPage = () => {
  const dispatch = useDispatch();
  const [viewMode, setViewMode] = useState("list"); // 'list' or 'map'

  const { farmers, loading } = useSelector(
    (state) => state.farmers
  );

  useEffect(() => {
    dispatch(getAllFarmers());
  }, [dispatch]);

  const rankedFarmers = useMemo(
    () =>
      [...(farmers || [])].sort((a, b) => {
        const scoreA = a.performanceScore ?? 0;
        const scoreB = b.performanceScore ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;

        const ratingA = a.avgRating ?? 0;
        const ratingB = b.avgRating ?? 0;
        if (ratingB !== ratingA) return ratingB - ratingA;

        return (a.name || "").localeCompare(b.name || "");
      }),
    [farmers]
  );

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 bg-white dark:bg-gray-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-gray-100">
          {t("farmers.pageTitle")}
        </h1>

        <div className="flex gap-2">
          <button
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${viewMode === "list"
                ? "bg-green-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
              }`}
          >
            <FaList /> List View
          </button>
        </div>
      </div>

      {rankedFarmers?.length > 0 ? (
        <>
          {viewMode === "list" ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {rankedFarmers.map((farmer) => (
                <FarmerCard key={farmer._id} farmer={farmer} />
              ))}
            </div>
          ) : (
            <FarmersMap farmers={rankedFarmers} />
          )}
        </>
      ) : (
        <p className="dark:text-gray-300">{t("farmers.noFarmers")}</p>
      )}
    </div>
  );
};

export default FarmersPage;
