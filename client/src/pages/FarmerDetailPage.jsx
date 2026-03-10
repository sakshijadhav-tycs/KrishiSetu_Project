import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams, useNavigate } from "react-router-dom";
import { FaPhone, FaEnvelope, FaMapMarkerAlt, FaComments, FaCalendarAlt } from "react-icons/fa";
import {
  getFarmerProfile,
  clearFarmerProfile,
} from "../redux/slices/farmerSlice";
import Loader from "../components/Loader";
import ReviewSection from "../components/ReviewSection";
import MapDisplay from "../components/MapDisplay";
import VisitRequestModal from "../components/VisitRequestModal";
import { BACKEND_URL } from "../config/api";
import { resolveImageUrl } from "../utils/imageUrl";
import FarmerVerificationBadge from "../components/FarmerVerificationBadge";

const FarmerDetailPage = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);

  const { farmerProfile, loading } = useSelector(
    (state) => state.farmers
  );

  useEffect(() => {
    dispatch(getFarmerProfile(id));

    return () => {
      dispatch(clearFarmerProfile());
    };
  }, [dispatch, id]);

  if (loading || !farmerProfile) {
    return <Loader />;
  }

  const { farmer, profile } = farmerProfile;
  const chatTargetId = farmer?._id || id;
  const profileImageSrc = resolveImageUrl(farmer?.profileImage, BACKEND_URL) || "/logo.png";

  // Updated handler to match your App.jsx route
  const handleMessageClick = () => {
    if (chatTargetId) {
      // App.jsx mein path 'chat/:userId' hai, isliye hum '/chat/' use kar rahe hain
      navigate(`/chat/${chatTargetId}`);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* --- Farmer Header Section --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Profile Picture */}
          <div className="w-24 h-24 rounded-full overflow-hidden bg-green-100">
            <img
              src={profileImageSrc}
              alt={farmer?.name || "Farmer"}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = "/logo.png";
              }}
            />
          </div>

          <div className="flex-1">
            <div className="flex justify-between items-start flex-wrap gap-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className="text-3xl font-extrabold text-gray-900">
                  {farmer?.name || "Farmer Name"}
                </h1>
                <FarmerVerificationBadge verified={Boolean(farmer?.verified_badge)} />
              </div>

              <div className="flex gap-3">
                {/* --- Message Button --- */}
                <button
                  onClick={handleMessageClick}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-md"
                >
                  <FaComments />
                  Chat
                </button>

                {/* --- Request Visit Button --- */}
                <button
                  onClick={() => setIsVisitModalOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-md"
                >
                  <FaCalendarAlt />
                  Request Visit
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <p className="flex items-center text-gray-600">
                <FaEnvelope className="mr-3 text-green-600" />
                {farmer?.email}
              </p>

              <p className="flex items-center text-gray-600">
                <FaPhone className="mr-3 text-green-600" />
                {farmer?.phone || "Contact not provided"}
              </p>

              <p className="flex items-center text-gray-600">
                <FaMapMarkerAlt className="mr-3 text-green-600" />
                {profile?.location || (farmer?.address ? `${farmer.address.city || ''}, ${farmer.address.state || ''}` : "Location not specified")}
              </p>
            </div>
          </div>
        </div>

        {/* --- Farm Description --- */}
        {profile?.description && (
          <div className="mt-6 pt-6 border-t border-gray-100">
            <h4 className="font-bold text-gray-800 mb-2">About the Farm</h4>
            <p className="text-gray-600 italic">"{profile.description}"</p>
          </div>
        )}
      </div>

      {/* --- Review Section --- */}
      <div className="mt-12">
        <ReviewSection farmerId={id} />
      </div>

      {/* --- Visit Request Modal --- */}
      <VisitRequestModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        farmerId={farmer?._id}
        farmerName={farmer?.name}
      />
    </div>
  );
};

export default FarmerDetailPage;
