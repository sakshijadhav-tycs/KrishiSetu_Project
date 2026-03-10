import React, { useState, useEffect, useRef } from "react";
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

const MapPicker = ({
  latitude,
  longitude,
  onLocationSelect,
  locationText = "Click on map to select location",
}) => {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Default to Pune coordinates if not provided
  const defaultLat = 18.5204;
  const defaultLng = 73.8567;

  const initialLat = latitude && !isNaN(latitude) ? parseFloat(latitude) : defaultLat;
  const initialLng = longitude && !isNaN(longitude) ? parseFloat(longitude) : defaultLng;

  const [searchInput, setSearchInput] = useState("");

  // Initialize Map
  useEffect(() => {
    // Only initialize if container exists and map doesn't
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Add click handler
      map.on("click", (e) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
        onLocationSelect({
          latitude: lat,
          longitude: lng,
        });
      });

      mapRef.current = map;

      // Add initial marker if coordinates exist
      if (latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
        updateMarker(parseFloat(latitude), parseFloat(longitude));
      }
    }

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []); // Run once on mount

  // Update marker and view when props change
  useEffect(() => {
    if (mapRef.current && latitude && longitude && !isNaN(latitude) && !isNaN(longitude)) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      // Update view only if distance is significant or it's the first load? 
      // Better to just set view if it changes significantly to avoid jitter during drag?
      // simple approach: set view.
      mapRef.current.setView([lat, lng], 13);
      updateMarker(lat, lng);
    }
  }, [latitude, longitude]);

  const updateMarker = (lat, lng) => {
    if (!mapRef.current) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng])
        .addTo(mapRef.current)
        .bindPopup("Farm Location")
        .openPopup();
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchInput
        )}`
      );
      const data = await response.json();

      if (data.length > 0) {
        const { lat, lon } = data[0];
        const newLat = parseFloat(lat);
        const newLng = parseFloat(lon);

        if (mapRef.current) {
          mapRef.current.setView([newLat, newLng], 13);
          updateMarker(newLat, newLng);
          onLocationSelect({
            latitude: newLat,
            longitude: newLng,
            locationAddress: searchInput,
          });
        }
        setSearchInput("");
      } else {
        alert("Location not found. Please try a different search term.");
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      alert("Error searching for location.");
    }
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search location (e.g., Khor, Pune)"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleSearchKeyPress}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            Search
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {locationText}
        </p>
      </div>

      <div
        ref={mapContainerRef}
        style={{ width: "100%", height: "400px", border: "2px solid #ccc", borderRadius: "8px", overflow: "hidden", zIndex: 0 }}
      />
    </div>
  );
};

export default MapPicker;
