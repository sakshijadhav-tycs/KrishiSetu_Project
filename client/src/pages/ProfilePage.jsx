"use client";

import React, { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadUser, updateProfile } from "../redux/slices/authSlice";
import { updateFarmerProfile } from "../redux/slices/farmerSlice";
import Loader from "../components/Loader";
import axios from "axios"; // Added for KYC API call
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaLeaf,
  FaCheck,
  FaCamera,
  FaTrash,
  FaShieldAlt, // Added for KYC tab
  FaIdCard,
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import MapPicker from "../components/MapPicker";
import { API_URL, BACKEND_URL } from "../config/api";
import { resolveImageUrl } from "../utils/imageUrl";

// Error Boundary Component
class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("MapPicker Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '10px', backgroundColor: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c00' }}>
          <strong>Map Error:</strong> {this.state.error?.message}
        </div>
      );
    }

    return this.props.children;
  }
}

const ProfilePage = () => {
  const dispatch = useDispatch();

  // Redux state
  const { userInfo, loading } = useSelector((state) => state.auth);
  const {
    myFarmerProfile,
    loading: farmerLoading,
    success: farmerSuccess,
  } = useSelector((state) => state.farmers);

  const [activeTab, setActiveTab] = useState("general");

  // User Form State
  const [userForm, setUserForm] = useState({
    name: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      zipCode: "",
    },
  });

  // Farmer Form State
  const [farmerForm, setFarmerForm] = useState({
    farmerName: "",
    location: "",
    latitude: null,
    longitude: null,
    totalArea: "",
    cultivationArea: "",
    agricultureMethod: "",
    description: "",
    farmImages: [],
  });

  // --- 🚨 KYC FORM STATE ---
  const [kycForm, setKycForm] = useState({
    documentType: "",
    documentNumber: "",
    documentImage: null,
  });
  const [verificationForm, setVerificationForm] = useState({
    aadhaarNumber: "",
    mobileNumber: "",
    otp: "",
  });
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [uploadedProfileImagePath, setUploadedProfileImagePath] = useState("");
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const DEFAULT_PROFILE_IMAGE = "/logo.png";
  const documentKycStatus = String(userInfo?.kyc?.status || "").toLowerCase();
  const farmerVerificationStatus =
    userInfo?.role === "farmer"
      ? String(
          userInfo?.verification_status ||
            (userInfo?.verified_badge ? "verified" : "unverified")
        ).toLowerCase()
      : String(userInfo?.kyc?.status || "none").toLowerCase();
  const isFarmerVerified = farmerVerificationStatus === "verified";
  const isFarmerVerificationPending = farmerVerificationStatus === "pending";
  const isFarmerVerificationRejected = farmerVerificationStatus === "rejected";
  const isDocumentKycLocked =
    documentKycStatus === "verified" || documentKycStatus === "pending";

  // Load User General Info
  useEffect(() => {
    if (userInfo) {
      setUserForm({
        name: userInfo.name || "",
        phone: userInfo.phone || "",
        address: {
          street: userInfo.address?.street || "",
          city: userInfo.address?.city || "",
          state: userInfo.address?.state || "",
          zipCode: userInfo.address?.zipCode || "",
        },
      });
    }
  }, [userInfo]);

  // Load Farmer Profile Info
  useEffect(() => {
    if (userInfo?.role === "farmer" && myFarmerProfile) {
      setFarmerForm({
        farmerName: myFarmerProfile.farmerName || "",
        location: myFarmerProfile.location || "",
        latitude: myFarmerProfile.latitude || null,
        longitude: myFarmerProfile.longitude || null,
        totalArea: myFarmerProfile.totalArea || "",
        cultivationArea: myFarmerProfile.cultivationArea || "",
        agricultureMethod: myFarmerProfile.agricultureMethod || "",
        description: myFarmerProfile.description || "",
        farmImages: myFarmerProfile.farmImages || [],
      });
    }
  }, [userInfo, myFarmerProfile]);

  useEffect(() => {
    setVerificationForm((prev) => ({
      ...prev,
      aadhaarNumber: userInfo?.aadhaar_number || prev.aadhaarNumber || "",
      mobileNumber: userInfo?.mobile_number || userInfo?.phone || prev.mobileNumber || "",
    }));
    if (userInfo?.aadhaar_number) {
      setKycForm((prev) => ({
        ...prev,
        documentNumber: prev.documentNumber || userInfo.aadhaar_number,
      }));
    }
    if (userInfo?.otp_verified || userInfo?.verified_badge) {
      setOtpSent(true);
    }
  }, [userInfo?.aadhaar_number, userInfo?.mobile_number, userInfo?.phone, userInfo?.otp_verified, userInfo?.verified_badge]);

  useEffect(() => {
    if (profileImageFile) {
      const objectUrl = URL.createObjectURL(profileImageFile);
      setProfilePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setProfilePreview("");
  }, [profileImageFile]);

  const getProfileImageSrc = () => {
    if (profilePreview) return profilePreview;
    if (uploadedProfileImagePath) return resolveImageUrl(uploadedProfileImagePath, BACKEND_URL);
    if (!userInfo?.profileImage) return DEFAULT_PROFILE_IMAGE;
    return resolveImageUrl(userInfo.profileImage, BACKEND_URL);
  };

  const handleProfileImageUpload = async () => {
    if (!profileImageFile) {
      return toast.error("Please choose an image first");
    }
    if (userInfo?.role !== "farmer") {
      return toast.error("Profile image upload is currently enabled for farmers only");
    }

    try {
      setUploadingProfileImage(true);
      const formData = new FormData();
      formData.append("profileImage", profileImageFile);

      const response = await axios.put(`${API_URL}/users/farmers/profile-image`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.data?.success) {
        toast.success("Profile picture updated");
        setUploadedProfileImagePath(response.data?.data?.profileImage || "");
        setProfileImageFile(null);
        await dispatch(loadUser()).unwrap();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile picture");
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const handleUserChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setUserForm((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setUserForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFarmerChange = (e) => {
    const { name, value } = e.target;
    setFarmerForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.readyState === 2) {
          setFarmerForm((prev) => ({
            ...prev,
            farmImages: [...prev.farmImages, reader.result],
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index) => {
    const filteredImages = farmerForm.farmImages.filter((_, i) => i !== index);
    setFarmerForm((prev) => ({ ...prev, farmImages: filteredImages }));
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateProfile(userForm)).unwrap();
      toast.success("Profile updated successfully!");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to update profile");
    }
  };

  const handleFarmerSubmit = async (e) => {
    e.preventDefault();
    try {
      await dispatch(updateFarmerProfile(farmerForm)).unwrap();
      toast.success("Farm profile updated!");
    } catch (err) {
      toast.error(err?.data?.message || "Failed to update farm profile");
    }
  };

  const handleAadhaarChange = (e) => {
    const aadhaarNumber = e.target.value.replace(/\D/g, "").slice(0, 12);
    setVerificationForm((prev) => ({ ...prev, aadhaarNumber }));
    setKycForm((prev) => ({ ...prev, documentNumber: aadhaarNumber }));
  };

  const handleSendOtp = async () => {
    if (!/^\d{12}$/.test(verificationForm.aadhaarNumber.trim())) {
      return toast.error("Aadhaar number must be exactly 12 digits");
    }
    if (!/^\d{10}$/.test(verificationForm.mobileNumber.trim())) {
      return toast.error("Mobile number must be exactly 10 digits");
    }

    try {
      setSendingOtp(true);
      const response = await axios.post(
        `${API_URL}/users/farmers/verification/send-otp`,
        {
          aadhaar_number: verificationForm.aadhaarNumber,
          mobile_number: verificationForm.mobileNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setOtpSent(true);
      setVerificationForm((prev) => ({ ...prev, otp: "" }));
      if (response?.data?.data?.otp) {
        toast.success(`OTP sent successfully. Dev OTP: ${response.data.data.otp}`);
      } else {
        toast.success(response?.data?.message || "OTP sent successfully");
      }
      await dispatch(loadUser()).unwrap();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!/^\d{6}$/.test(verificationForm.otp.trim())) {
      return toast.error("OTP must be exactly 6 digits");
    }

    try {
      setVerifyingOtp(true);
      await axios.post(
        `${API_URL}/users/farmers/verification/verify-otp`,
        {
          otp: verificationForm.otp,
          aadhaar_number: verificationForm.aadhaarNumber,
          mobile_number: verificationForm.mobileNumber,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      toast.success("Aadhaar verified successfully");
      setVerificationForm((prev) => ({ ...prev, otp: "" }));
      await dispatch(loadUser()).unwrap();
    } catch (err) {
      toast.error(err.response?.data?.message || "OTP verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  // --- 🚨 KYC SUBMIT HANDLER ---
  const handleKycSubmit = async (e) => {
    e.preventDefault();
    if (!kycForm.documentType || !kycForm.documentNumber || !kycForm.documentImage) {
      return toast.error("Please fill all KYC fields");
    }
    if (!/^\d{12}$/.test(String(kycForm.documentNumber || "").trim())) {
      return toast.error("Aadhaar number must be exactly 12 digits");
    }

    const formData = new FormData();
    formData.append("documentType", kycForm.documentType);
    formData.append("documentNumber", kycForm.documentNumber);
    formData.append("documentImage", kycForm.documentImage);

    try {
      await axios.post(`${API_URL}/users/kyc/submit`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      toast.success("KYC submitted successfully!");
      await dispatch(loadUser()).unwrap();
    } catch (err) {
      toast.error(err.response?.data?.message || "KYC Submission Failed");
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl animate-fadeIn">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-black text-gray-800 tracking-tight">
          {t("profile.title")}
        </h1>
        {/* Status Indicator */}
        {userInfo?.role === "farmer" && (
          <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border-2 ${isFarmerVerified ? 'bg-green-50 border-green-200 text-green-600' : 'bg-orange-50 border-orange-200 text-orange-600'
            }`}>
            {t("profile.kycStatusLabel")}{" "}
            {farmerVerificationStatus || t("profile.kycNone")}
          </div>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex space-x-6 border-b border-gray-200 mb-8 overflow-x-auto whitespace-nowrap">
        <button
          className={`pb-4 px-2 font-black text-sm uppercase tracking-widest transition-all ${activeTab === "general" ? "text-green-600 border-b-4 border-green-600" : "text-gray-400"
            }`}
          onClick={() => setActiveTab("general")}
        >
          {t("profile.tabGeneral")}
        </button>
        {userInfo?.role === "farmer" && (
          <>
            <button
              className={`pb-4 px-2 font-black text-sm uppercase tracking-widest transition-all ${activeTab === "farm" ? "text-green-600 border-b-4 border-green-600" : "text-gray-400"
                }`}
              onClick={() => setActiveTab("farm")}
            >
              {t("profile.tabFarm")}
            </button>
            <button
              className={`pb-4 px-2 font-black text-sm uppercase tracking-widest transition-all flex items-center ${activeTab === "kyc" ? "text-blue-600 border-b-4 border-blue-600" : "text-gray-400"
                }`}
              onClick={() => setActiveTab("kyc")}
            >
              <FaShieldAlt className="mr-2" /> {t("profile.tabKyc")}
            </button>
          </>
        )}
      </div>

      {activeTab === "general" && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-50">
          <form onSubmit={handleUserSubmit} className="space-y-8">
            <div className="flex flex-col items-center pb-6 border-b border-gray-100">
              <div className="relative">
                <img
                  src={getProfileImageSrc()}
                  alt="Profile"
                  className="w-32 h-32 rounded-full object-cover border-4 border-green-100 shadow-md"
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                  }}
                />
                {isFarmerVerified && (
                  <span className="absolute bottom-1 right-1 w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center border-2 border-white">
                    <FaCheck size={12} />
                  </span>
                )}
              </div>

              <div className="mt-4 flex flex-col sm:flex-row items-center gap-3">
                <label className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold cursor-pointer inline-flex items-center">
                  <FaCamera className="mr-2" /> Change Picture
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleProfileImageUpload}
                  disabled={!profileImageFile || uploadingProfileImage}
                  className={`px-4 py-2 rounded-xl text-sm font-bold text-white ${
                    !profileImageFile || uploadingProfileImage
                      ? "bg-green-400 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {uploadingProfileImage ? "Uploading..." : "Save Picture"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">
                  {t("profile.fullName")}
                </label>
                <div className="relative">
                  <FaUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    name="name"
                    value={userForm.name}
                    onChange={handleUserChange}
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white transition-all font-bold outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">
                  {t("profile.emailAddress")}
                </label>
                <div className="relative">
                  <FaEnvelope className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="email"
                    value={userInfo?.email || ""}
                    disabled
                    className="w-full pl-12 p-4 bg-gray-100 border-0 rounded-2xl text-gray-400 font-bold cursor-not-allowed"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">
                  {t("profile.phoneNumber")}
                </label>
                <div className="relative">
                  <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="tel"
                    name="phone"
                    value={userForm.phone}
                    onChange={handleUserChange}
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white transition-all font-bold outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-[0.2em]">
                  {t("profile.role")}
                </label>
                <div className="p-4 bg-green-50 text-green-700 rounded-2xl font-black text-xs uppercase tracking-widest">
                  {userInfo?.role || t("profile.roleUser")}
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-gray-100">
              <h3 className="text-xl font-black mb-6 flex items-center text-gray-800">
                <FaMapMarkerAlt className="mr-3 text-green-500" />{" "}
                {t("profile.addressDetails")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input
                  type="text"
                  name="address.street"
                  placeholder={t("profile.streetPlaceholder")}
                  value={userForm.address.street}
                  onChange={handleUserChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white transition-all font-bold outline-none col-span-full"
                />
                <input
                  type="text"
                  name="address.city"
                  placeholder={t("profile.cityPlaceholder")}
                  value={userForm.address.city}
                  onChange={handleUserChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white transition-all font-bold outline-none"
                />
                <input
                  type="text"
                  name="address.state"
                  placeholder={t("profile.statePlaceholder")}
                  value={userForm.address.state}
                  onChange={handleUserChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white transition-all font-bold outline-none"
                />
              </div>
            </div>
            <button type="submit" className="px-12 bg-green-600 text-white py-4 rounded-2xl font-black hover:bg-green-700 transition shadow-xl active:scale-95">
              {t("profile.updateInfo")}
            </button>
          </form>
        </div>
      )}

      {activeTab === "farm" && userInfo?.role === "farmer" && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-50 animate-slideUp">
          <form onSubmit={handleFarmerSubmit} className="space-y-8">
            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Farm Gallery</label>
              <div className="flex flex-wrap gap-4">
                {farmerForm.farmImages.map((img, index) => (
                  <div key={index} className="relative group w-28 h-28">
                    <img src={img} alt="Farm" className="w-full h-full object-cover rounded-2xl shadow-md border-2 border-white" />
                    <button type="button" onClick={() => removeImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg scale-0 group-hover:scale-100 transition-transform"><FaTrash size={10} /></button>
                  </div>
                ))}
                <label className="w-28 h-28 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 hover:border-green-300 transition-all">
                  <FaCamera className="text-gray-300 text-2xl mb-1" />
                  <span className="text-[9px] font-black text-gray-400 uppercase">Upload</span>
                  <input type="file" className="hidden" multiple accept="image/*" onChange={handleImageChange} />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Official Farm Name</label>
                <div className="relative">
                  <FaLeaf className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    name="farmerName"
                    value={farmerForm.farmerName}
                    onChange={handleFarmerChange}
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold outline-none"
                    placeholder="e.g. Green Valley Farms"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Farm Location</label>
                <input
                  type="text"
                  name="location"
                  value={farmerForm.location}
                  onChange={handleFarmerChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold outline-none"
                  placeholder="City, District"
                />
              </div>
            </div>

            {/* Latitude and Longitude Inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Latitude</label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={farmerForm.latitude || ''}
                  onChange={(e) => setFarmerForm({ ...farmerForm, latitude: parseFloat(e.target.value) })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold outline-none"
                  placeholder="Latitude"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Longitude</label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={farmerForm.longitude || ''}
                  onChange={(e) => setFarmerForm({ ...farmerForm, longitude: parseFloat(e.target.value) })}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold outline-none"
                  placeholder="Longitude"
                />
              </div>
            </div>

            {/* Map Picker */}
            <div className="rounded-2xl overflow-hidden border-2 border-gray-100">
              <MapErrorBoundary>
                <MapPicker
                  latitude={farmerForm.latitude}
                  longitude={farmerForm.longitude}
                  locationText="Click on map to select your farm location"
                  onLocationSelect={(coords) => setFarmerForm({
                    ...farmerForm,
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    location: coords.locationAddress || farmerForm.location
                  })}
                />
              </MapErrorBoundary>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Total Land Area</label>
                <input
                  type="text"
                  name="totalArea"
                  value={farmerForm.totalArea}
                  onChange={handleFarmerChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold"
                  placeholder="e.g. 5 Hectares"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Farming Method</label>
                <select
                  name="agricultureMethod"
                  value={farmerForm.agricultureMethod}
                  onChange={handleFarmerChange}
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-bold outline-none appearance-none"
                >
                  <option value="">Select Method</option>
                  <option value="Organic Farming">Organic Farming</option>
                  <option value="Traditional Method">Traditional Method</option>
                  <option value="Modern and traditional methods">Modern & Traditional</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Farm Description</label>
              <textarea
                name="description"
                rows="4"
                value={farmerForm.description}
                onChange={handleFarmerChange}
                className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-green-500 focus:bg-white font-medium outline-none"
                placeholder="Share your story with your customers..."
              />
            </div>

            <button type="submit" disabled={farmerLoading} className="px-12 bg-green-700 text-white py-4 rounded-2xl font-black hover:bg-green-800 transition shadow-xl flex items-center">
              {farmerLoading ? "Saving..." : "Save Farm Profile"}
              {farmerSuccess && <FaCheck className="ml-3 animate-pulse" />}
            </button>
          </form>
        </div>
      )}

      {/* --- 🚨 NEW KYC TAB SECTION --- */}
      {activeTab === "kyc" && userInfo?.role === "farmer" && (
        <div className="bg-white p-8 rounded-3xl shadow-2xl border border-gray-50 animate-slideUp">
          <form onSubmit={handleKycSubmit} className="space-y-8">
            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start space-x-4 mb-6">
              <FaShieldAlt className="text-blue-500 text-2xl mt-1" />
              <div>
                <h4 className="font-black text-blue-800 uppercase text-xs tracking-widest">
                  KYC Status: {farmerVerificationStatus || "unverified"}
                </h4>
                <p className="text-sm text-blue-600 font-medium mt-1">
                  Upload your identity documents. After verification, a blue checkmark will appear on your products.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">ID Document Type</label>
                <select
                  className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white font-bold outline-none appearance-none"
                  value={kycForm.documentType}
                  onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
                  disabled={isDocumentKycLocked}
                >
                  <option value="">Select Document</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="PAN Card">PAN Card</option>
                  <option value="Voter ID">Voter ID</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Aadhaar Number</label>
                <div className="relative">
                  <FaIdCard className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    placeholder="Enter 12 digit Aadhaar number"
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white font-bold outline-none"
                    value={verificationForm.aadhaarNumber}
                    onChange={handleAadhaarChange}
                    disabled={isFarmerVerified}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Mobile Number</label>
                <div className="relative">
                  <FaPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="Enter mobile number"
                    className="w-full pl-12 p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white font-bold outline-none"
                    value={verificationForm.mobileNumber}
                    onChange={(e) =>
                      setVerificationForm((prev) => ({
                        ...prev,
                        mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                      }))
                    }
                    disabled={isFarmerVerified}
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Send OTP</label>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || isFarmerVerified}
                  className={`w-full p-4 rounded-2xl font-black transition ${sendingOtp || isFarmerVerified
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                  {sendingOtp ? "Sending OTP..." : "Send OTP"}
                </button>
              </div>
              {otpSent && !isFarmerVerified && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">OTP Input</label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="Enter 6 digit OTP"
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-blue-500 focus:bg-white font-bold outline-none"
                      value={verificationForm.otp}
                      onChange={(e) =>
                        setVerificationForm((prev) => ({
                          ...prev,
                          otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                        }))
                      }
                      disabled={isFarmerVerified}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-gray-400 uppercase mb-2 tracking-widest">Verify OTP</label>
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={verifyingOtp || !/^\d{6}$/.test(verificationForm.otp) || isFarmerVerified}
                      className={`w-full p-4 rounded-2xl font-black transition ${verifyingOtp || !/^\d{6}$/.test(verificationForm.otp) || isFarmerVerified
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                        }`}
                    >
                      {verifyingOtp ? "Verifying OTP..." : "Verify OTP"}
                    </button>
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-gray-400 uppercase mb-4 tracking-widest">Document Image (Front Side)</label>
              <div className="flex items-center gap-6">
                {kycForm.documentImage ? (
                  <div className="relative w-40 h-24">
                    <img
                      src={URL.createObjectURL(kycForm.documentImage)}
                      alt="Doc Preview"
                      className="w-full h-full object-cover rounded-xl border-2 border-blue-200"
                    />
                    <button
                      type="button"
                      onClick={() => setKycForm({ ...kycForm, documentImage: null })}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                    >
                      <FaTrash size={10} />
                    </button>
                  </div>
                ) : (
                  <label className="w-40 h-24 border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-all">
                    <FaCamera className="text-gray-300 text-2xl mb-1" />
                    <span className="text-[9px] font-black text-gray-400 uppercase">Upload ID</span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => setKycForm({ ...kycForm, documentImage: e.target.files[0] })}
                      disabled={isDocumentKycLocked}
                    />
                  </label>
                )}
              </div>
            </div>

            {isFarmerVerificationRejected && (
              <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
                Reason: {userInfo?.verification_rejection_reason || userInfo?.kyc?.rejectionReason}
              </div>
            )}

            <button
              type="submit"
              disabled={isDocumentKycLocked}
              className={`px-12 py-4 rounded-2xl font-black transition shadow-xl active:scale-95 ${isDocumentKycLocked
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              {documentKycStatus === 'pending' ? 'Verification Pending...' :
                documentKycStatus === 'verified' ? 'Account Verified' : 'Submit KYC Documents'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ProfilePage;

