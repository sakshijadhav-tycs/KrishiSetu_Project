import React, { useEffect, useState } from "react";
import axios from "axios";
import Loader from "../../components/Loader";

const MyVisitsPage = () => {
    const [visits, setVisits] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVisits = async () => {
            try {
                const token = localStorage.getItem("token");
                const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/visits/my-visits`;
                console.log("Fetching My Visits URL:", url);
                const { data } = await axios.get(
                    url,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                console.log("Fetched Visits Data:", data);
                setVisits(data);
            } catch (error) {
                console.error("Error fetching visits:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchVisits();
    }, []);

    if (loading) return <Loader />;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">My Farm Visits</h1>
            {visits.length === 0 ? (
                <p className="text-gray-600">No visit requests found.</p>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {visits.map((visit) => (
                        <div key={visit._id} className="bg-white p-5 rounded-lg shadow border border-gray-200">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="font-bold text-lg">{visit.farmer?.name || visit.farmerId?.name || "Farmer"}</h3>
                                <span
                                    className={`px-2 py-1 text-xs font-bold rounded-full ${visit.status === "Accepted"
                                        ? "bg-green-100 text-green-700"
                                        : visit.status === "Rejected"
                                            ? "bg-red-100 text-red-700"
                                            : "bg-yellow-100 text-yellow-700"
                                        }`}
                                >
                                    {visit.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-1">
                                <strong>Date:</strong> {new Date(visit.requestedDate || visit.date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-gray-600 mb-1">
                                <strong>Proposed Date:</strong> {visit.proposedDate ? new Date(visit.proposedDate).toLocaleDateString() : "-"}
                            </p>
                            {(visit.message || visit.notes) && (
                                <p className="text-sm text-gray-500 italic mt-2">"{visit.message || visit.notes}"</p>
                            )}
                            {visit.status === 'Accepted' && visit.location && visit.location.latitude && (
                                <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${visit.location.latitude},${visit.location.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block mt-4 text-center text-blue-600 hover:underline text-sm font-semibold"
                                >
                                    ðŸ“ Get Directions
                                </a>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MyVisitsPage;
