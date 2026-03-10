import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const MapDisplay = ({
  latitude,
  longitude,
  farmName = "Farm Location",
  locationText = "Location",
  height = "300px",
  zoom = 14,
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  // Default to Pune coordinates if not provided
  const defaultLat = 19.0760;
  const defaultLng = 72.8777;

  const lat = latitude && !isNaN(latitude) ? parseFloat(latitude) : defaultLat;
  const lng = longitude && !isNaN(longitude) ? parseFloat(longitude) : defaultLng;

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([lat, lng], zoom);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Disable scroll zoom
      map.scrollWheelZoom.disable();

      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
        L.marker([lat, lng])
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center;">
              <strong>${farmName}</strong><br/>
              Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}
            </div>
          `)
          .openPopup();
      }

      mapRef.current = map;
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update view if props change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], zoom);
      // We could also update marker here but usually MapDisplay is static for a page load
      // Re-creating the map on significant prop change might be safer or just using key
    }
  }, [lat, lng, zoom]);

  return (
    <div className="w-full">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-800 mb-2">{locationText}</h3>
        {latitude && longitude && (
          <div className="text-sm text-gray-600 bg-gray-100 p-2 rounded">
            <div>
              <strong>Latitude:</strong> {latitude?.toFixed(4)}
            </div>
            <div>
              <strong>Longitude:</strong> {longitude?.toFixed(4)}
            </div>
          </div>
        )}
      </div>

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height, border: "2px solid #ccc", borderRadius: "8px", overflow: "hidden", zIndex: 0 }}
      />
    </div>
  );
};

export default MapDisplay;
