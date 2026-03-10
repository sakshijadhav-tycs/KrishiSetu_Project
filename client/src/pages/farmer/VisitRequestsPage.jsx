import React, { useEffect, useState } from "react";
import axios from "axios";
import Loader from "../../components/Loader";
import { toast } from "react-hot-toast";

const VisitRequestsPage = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const token = localStorage.getItem("token");
            const url = `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/visits/requests`;
            console.log("Fetching Requests URL:", url);
            const { data } = await axios.get(
                url,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            setRequests(data);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            const token = localStorage.getItem("token");
            await axios.put(
                `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/visits/${id}`,
                { status },
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            toast.success(`Visit ${status}`);
            fetchRequests(); // Refresh list
        } catch (error) {
            console.error("Update error", error);
            toast.error("Failed to update status");
        }
    };

    if (loading) return <Loader />;

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Farm Visit Requests</h1>
            {requests.length === 0 ? (
                <p className="text-gray-600">No pending visit requests.</p>
            ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {requests.map((req) => (
                                <tr key={req._id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-gray-900">{req.customer?.name || req.customerId?.name}</div>
                                        <div className="text-sm text-gray-500">{req.customer?.email || req.customerId?.email}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="text-gray-900">{new Date(req.requestedDate || req.date).toLocaleDateString()}</div>
                                        <div className="text-sm text-gray-500">{req.proposedDate ? `Proposed: ${new Date(req.proposedDate).toLocaleDateString()}` : "-"}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 max-w-xs truncate">{req.message || req.notes || "-"}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span
                                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${req.status === "Accepted"
                                                ? "bg-green-100 text-green-800"
                                                : req.status === "Rejected"
                                                    ? "bg-red-100 text-red-800"
                                                    : req.status === "Pending"
                                                        ? "bg-yellow-100 text-yellow-800"
                                                        : "bg-gray-100 text-gray-800"
                                                }`}
                                        >
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <div className="flex space-x-2">
                                            {req.status !== "Accepted" && (
                                                <button
                                                    onClick={() => handleStatusUpdate(req._id, "Accepted")}
                                                    className="text-green-600 hover:text-green-900 bg-green-50 px-3 py-1 rounded"
                                                >
                                                    Accept
                                                </button>
                                            )}
                                            {req.status !== "Rejected" && (
                                                <button
                                                    onClick={() => handleStatusUpdate(req._id, "Rejected")}
                                                    className="text-red-600 hover:text-red-900 bg-red-50 px-3 py-1 rounded"
                                                >
                                                    Reject
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default VisitRequestsPage;
