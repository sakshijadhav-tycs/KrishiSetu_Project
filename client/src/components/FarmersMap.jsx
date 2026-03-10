import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";
import FarmerVerificationBadge from "./FarmerVerificationBadge";

// Fix default marker icon issue in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const FarmersMap = ({ farmers = [] }) => {
  const navigate = useNavigate();

  // Filter farmers with coordinates
  const farmersWithCoordinates = farmers.filter(
    (farmer) => farmer.profile?.latitude && farmer.profile?.longitude
  );

  // Calculate center of all farmers
  const calculateCenter = () => {
    if (farmersWithCoordinates.length === 0) {
      return [19.0760, 72.8777]; // Default to India center
    }

    const avgLat =
      farmersWithCoordinates.reduce((sum, f) => sum + f.profile.latitude, 0) /
      farmersWithCoordinates.length;
    const avgLng =
      farmersWithCoordinates.reduce((sum, f) => sum + f.profile.longitude, 0) /
      farmersWithCoordinates.length;

    return [avgLat, avgLng];
  };

  const center = calculateCenter();

  return (
    <div className="w-full h-full">
      {farmersWithCoordinates.length === 0 ? (
        <div className="bg-gray-100 p-8 rounded-lg text-center text-gray-600 h-96 flex items-center justify-center">
          <p className="text-lg">
            No farmers with location data available. Please try list view.
          </p>
        </div>
      ) : (
        <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
          <MapContainer
            center={center}
            zoom={11}
            style={{ height: "600px", width: "100%" }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {farmersWithCoordinates.map((farmer) => (
              <Marker
                key={farmer._id}
                position={[farmer.profile.latitude, farmer.profile.longitude]}
              >
                <Popup>
                  <div className="cursor-pointer">
                    <strong className="block text-sm mb-2">
                      {farmer.profile?.farmerName || farmer.name}
                    </strong>
                    <div className="mb-2">
                      <FarmerVerificationBadge verified={Boolean(farmer?.verified_badge)} />
                    </div>
                    <p className="text-xs text-gray-600 mb-2">
                      {farmer.profile?.location}
                    </p>
                    <button
                      onClick={() => navigate(`/farmers/${farmer._id}`)}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 rounded transition"
                    >
                      View Profile
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
        <strong>Map Info:</strong> {farmersWithCoordinates.length} of{" "}
        {farmers.length} farmers have location data on map.
      </div>
    </div>
  );
};

export default FarmersMap;
