"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import axios from "axios";
import { toast } from "react-hot-toast";
import Loader from "../../components/Loader";
import { FaCheck, FaTimes, FaEye, FaUserCheck, FaClock } from "react-icons/fa";
import { BACKEND_URL } from "../../config/api";

const KYCRequests = () => {
  const [requests, setRequests] = useState([]);
  const [verifiedFarmers, setVerifiedFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // 'pending' or 'verified'
  const [selectedImg, setSelectedImg] = useState(null);

  // 1. Pending requests fetch karne ke liye
  const fetchPendingRequests = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/users/kyc/requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setRequests(data.data);
    } catch (err) {
      toast.error("Failed to fetch pending requests");
    }
  };

  // 2. Verified farmers fetch karne ke liye
  const fetchVerifiedFarmers = async () => {
    try {
      const { data } = await axios.get(`${BACKEND_URL}/api/users/kyc/verified`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setVerifiedFarmers(data.data);
    } catch (err) {
      toast.error("Failed to fetch verified farmers");
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([fetchPendingRequests(), fetchVerifiedFarmers()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleStatusUpdate = async (userId, status) => {
    let reason = "";
    if (status === "rejected") {
      reason = prompt("Please enter rejection reason:");
      if (!reason) return;
    }

    try {
      await axios.put(`${BACKEND_URL}/api/users/kyc/status`, 
        { userId, status, reason },
        { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }}
      );
      toast.success(`KYC ${status === "verified" ? "Approved" : "Rejected"} successfully`);
      loadAllData(); // Refresh both lists
    } catch (err) {
      toast.error("Update failed");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-black mb-8 text-gray-800 tracking-tight">KYC Management</h1>

      {/* --- Tab Navigation --- */}
      <div className="flex space-x-4 mb-8">
        <button
          onClick={() => setActiveTab("pending")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
            activeTab === "pending" 
            ? "bg-orange-500 text-white shadow-lg shadow-orange-200" 
            : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100"
          }`}
        >
          <FaClock /> Pending Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab("verified")}
          className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
            activeTab === "verified" 
            ? "bg-green-600 text-white shadow-lg shadow-green-200" 
            : "bg-white text-gray-500 hover:bg-gray-50 border border-gray-100"
          }`}
        >
          <FaUserCheck /> Verified Farmers ({verifiedFarmers.length})
        </button>
      </div>

      {/* --- Table Section --- */}
      <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-400">Farmer</th>
              <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-400">Doc Type</th>
              <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-400">ID Number</th>
              <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-400">Document</th>
              <th className="p-6 text-xs font-black uppercase tracking-widest text-gray-400 text-center">
                {activeTab === "pending" ? "Actions" : "Status"}
              </th>
            </tr>
          </thead>
          <tbody>
            {(activeTab === "pending" ? requests : verifiedFarmers).length > 0 ? (
              (activeTab === "pending" ? requests : verifiedFarmers).map((req) => (
                <tr key={req._id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="p-6">
                    <p className="font-bold text-gray-800">{req.name}</p>
                    <p className="text-xs text-gray-400">{req.email}</p>
                  </td>
                  <td className="p-6 font-bold text-gray-600">{req.kyc?.documentType}</td>
                  <td className="p-6 font-mono font-bold text-blue-600">{req.kyc?.documentNumber}</td>
                  <td className="p-6">
                    <button 
                      onClick={() => setSelectedImg(`${BACKEND_URL}/${req.kyc?.documentImage}`)}
                      className="flex items-center gap-2 bg-gray-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-200 transition"
                    >
                      <FaEye /> View Doc
                    </button>
                  </td>
                  <td className="p-6">
                    {activeTab === "pending" ? (
                      <div className="flex justify-center gap-3">
                        <button 
                          onClick={() => handleStatusUpdate(req._id, "verified")}
                          className="bg-green-100 text-green-600 p-3 rounded-xl hover:bg-green-600 hover:text-white transition shadow-sm"
                          title="Verify"
                        >
                          <FaCheck />
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(req._id, "rejected")}
                          className="bg-red-100 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition shadow-sm"
                          title="Reject"
                        >
                          <FaTimes />
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-center">
                        <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-green-200">
                          Verified
                        </span>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-10 text-center text-gray-400 italic font-medium">
                  {activeTab === "pending" 
                    ? "No pending KYC requests found." 
                    : "No verified farmers in the list."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- Image Preview Modal --- */}
      {selectedImg && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="relative max-w-4xl w-full bg-white p-2 rounded-2xl shadow-2xl">
            <button 
              onClick={() => setSelectedImg(null)}
              className="absolute -top-4 -right-4 bg-red-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg font-black hover:bg-red-600 transition-all"
            >✕</button>
            <img src={selectedImg} alt="KYC Document" className="w-full h-auto rounded-xl" />
          </div>
        </div>
      )}
    </div>
  );
};

export default KYCRequests;
