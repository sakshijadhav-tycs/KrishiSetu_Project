"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import axios from "axios";
import { loadUser } from "../../redux/slices/authSlice";
import { API_URL, BACKEND_URL } from "../../config/api";
import { resolveImageUrl } from "../../utils/imageUrl";
import FarmerVerificationBadge from "../../components/FarmerVerificationBadge";

const ProfilePage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { userInfo: user } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    farmerName: "",
    location: "",
    latitude: null,
    longitude: null,
    totalArea: "",
    cultivationArea: "",
    agricultureMethod: "",
    description: "",
  });

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
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState("");
  const [uploadedProfileImagePath, setUploadedProfileImagePath] = useState("");
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const DEFAULT_PROFILE_IMAGE = "/logo.png";

  useEffect(() => {
    if (!user) {
      navigate("/login");
    }
  }, [user, navigate]);

  useEffect(() => {
    if (profileImageFile) {
      const objectUrl = URL.createObjectURL(profileImageFile);
      setProfilePreview(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }
    setProfilePreview("");
  }, [profileImageFile]);

  useEffect(() => {
    setVerificationForm((prev) => ({
      ...prev,
      aadhaarNumber: user?.aadhaar_number || "",
      mobileNumber: user?.mobile_number || user?.phone || "",
    }));
  }, [user?.aadhaar_number, user?.mobile_number, user?.phone]);

  const getProfileImageSrc = () => {
    if (profilePreview) return profilePreview;
    if (uploadedProfileImagePath) return resolveImageUrl(uploadedProfileImagePath, BACKEND_URL);
    if (!user?.profileImage) return DEFAULT_PROFILE_IMAGE;
    return resolveImageUrl(user.profileImage, BACKEND_URL);
  };

  const handleProfileImageUpload = async () => {
    if (!profileImageFile) {
      return toast.error("Please choose an image first");
    }
    try {
      setUploadingProfileImage(true);
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("profileImage", profileImageFile);
      const { data } = await axios.put(`${API_URL}/users/farmers/profile-image`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      if (data?.success) {
        toast.success("Profile picture updated");
        setUploadedProfileImagePath(data?.data?.profileImage || "");
        setProfileImageFile(null);
        await dispatch(loadUser()).unwrap();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload profile image");
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();

    if (
      !formData.farmerName ||
      !formData.location ||
      !formData.totalArea ||
      !formData.cultivationArea ||
      !formData.agricultureMethod ||
      !formData.description
    ) {
      return toast.error("Please fill all required fields");
    }

    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${import.meta.env.VITE_API_URL || "http://localhost:5000/api"}/users/farmers/profile`,
        formData,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        toast.success("Farm profile saved successfully!");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save farm profile");
    }
  };

  const handleKYCSubmit = async (e) => {
    e.preventDefault();

    if (!kycForm.documentType || !kycForm.documentNumber || !kycForm.documentImage) {
      return toast.error("Please fill all KYC fields and upload a document");
    }

    const data = new FormData();
    data.append("documentType", kycForm.documentType);
    data.append("documentNumber", kycForm.documentNumber);
    data.append("documentImage", kycForm.documentImage);

    try {
      toast.success("KYC Submitted! Waiting for admin approval.");
    } catch (err) {
      toast.error(err.response?.data?.message || "KYC Submission Failed");
    }
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
      const token = localStorage.getItem("token");
      const { data } = await axios.post(
        `${API_URL}/users/farmers/verification/send-otp`,
        {
          aadhaarNumber: verificationForm.aadhaarNumber,
          mobileNumber: verificationForm.mobileNumber,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (data?.data?.otp) {
        toast.success(`OTP sent successfully. Dev OTP: ${data.data.otp}`);
      } else {
        toast.success(data?.message || "OTP sent successfully");
      }
      await dispatch(loadUser()).unwrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationForm.otp.trim()) {
      return toast.error("Please enter the OTP");
    }

    try {
      setVerifyingOtp(true);
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/users/farmers/verification/verify-otp`,
        {
          aadhaarNumber: verificationForm.aadhaarNumber,
          mobileNumber: verificationForm.mobileNumber,
          otp: verificationForm.otp,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success("Farmer verification completed");
      setVerificationForm((prev) => ({ ...prev, otp: "" }));
      await dispatch(loadUser()).unwrap();
    } catch (error) {
      toast.error(error.response?.data?.message || "OTP verification failed");
    } finally {
      setVerifyingOtp(false);
    }
  };

  if (!user) return null;

  return (
    <div
      className="profile-container dark:bg-gray-900 dark:text-gray-100"
      style={{ padding: "20px", maxWidth: "800px", margin: "0 auto", fontFamily: "sans-serif" }}
    >
      <div style={{ marginBottom: "20px", textAlign: "right" }}>
        <span
          style={{
            padding: "5px 15px",
            borderRadius: "20px",
            fontSize: "12px",
            fontWeight: "bold",
            backgroundColor: user?.kyc?.status === "verified" ? "#d4edda" : "#fff3cd",
            color: user?.kyc?.status === "verified" ? "#155724" : "#856404",
            border: "1px solid",
          }}
        >
          KYC Status: {user?.kyc?.status?.toUpperCase() || "NONE"}
        </span>
      </div>

      <div
        className="profile-form"
        style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}
      >
        <h2>My Profile - Farm Details</h2>

        <div className="form-group" style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
          <img
            src={getProfileImageSrc()}
            alt="Farmer Profile"
            style={{ width: "92px", height: "92px", borderRadius: "9999px", objectFit: "cover", border: "3px solid #d1fae5" }}
            onError={(e) => {
              e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
            }}
          />
          <div style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: "bold", marginBottom: "8px" }}>Change Profile Picture</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              onChange={(e) => setProfileImageFile(e.target.files?.[0] || null)}
            />
            <button
              type="button"
              onClick={handleProfileImageUpload}
              disabled={!profileImageFile || uploadingProfileImage}
              style={{
                marginTop: "10px",
                backgroundColor: "#0f766e",
                color: "white",
                padding: "8px 14px",
                border: "none",
                borderRadius: "6px",
                cursor: !profileImageFile || uploadingProfileImage ? "not-allowed" : "pointer",
                opacity: !profileImageFile || uploadingProfileImage ? 0.7 : 1,
                fontWeight: "bold",
              }}
            >
              {uploadingProfileImage ? "Uploading..." : "Update Picture"}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>FARMER NAME</label>
          <input
            type="text"
            placeholder="Enter Farmer Name"
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
            value={formData.farmerName}
            onChange={(e) => setFormData({ ...formData, farmerName: e.target.value })}
          />
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>LOCATION (e.g. Khor, Pune)</label>
          <input
            type="text"
            placeholder="Farm Location"
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#666" }}>
                LATITUDE
              </label>
              <input
                type="number"
                placeholder="Latitude"
                step="any"
                style={{ width: "100%", padding: "8px", marginTop: "2px", borderRadius: "4px", border: "1px solid #ddd" }}
                value={formData.latitude || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    latitude: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: "bold", color: "#666" }}>
                LONGITUDE
              </label>
              <input
                type="number"
                placeholder="Longitude"
                step="any"
                style={{ width: "100%", padding: "8px", marginTop: "2px", borderRadius: "4px", border: "1px solid #ddd" }}
                value={formData.longitude || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    longitude: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>
        </div>

        <div className="form-row" style={{ display: "flex", gap: "20px", marginBottom: "15px" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: "bold" }}>TOTAL AREA</label>
            <input
              type="text"
              placeholder="e.g. 10 acres"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={formData.totalArea}
              onChange={(e) => setFormData({ ...formData, totalArea: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label style={{ display: "block", fontWeight: "bold" }}>AREA UNDER CULTIVATION</label>
            <input
              type="text"
              placeholder="e.g. 8 acres"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={formData.cultivationArea}
              onChange={(e) => setFormData({ ...formData, cultivationArea: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: "15px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>AGRICULTURE METHOD</label>
          <select
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
            value={formData.agricultureMethod}
            onChange={(e) => setFormData({ ...formData, agricultureMethod: e.target.value })}
          >
            <option value="">Select Method</option>
            <option value="Organic">Organic Farming</option>
            <option value="Traditional">Traditional Method</option>
            <option value="Modern">Modern and Traditional</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: "25px" }}>
          <label style={{ display: "block", fontWeight: "bold" }}>FARMER INFORMATION / BIO</label>
          <textarea
            rows="4"
            placeholder="Tell customers about your journey..."
            style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        </div>

        <button
          className="save-btn"
          onClick={handleSaveProfile}
          style={{
            backgroundColor: "#28a745",
            color: "white",
            padding: "12px 25px",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            width: "100%",
          }}
        >
          Save Farm Profile
        </button>

        <hr style={{ margin: "40px 0", border: "0", borderTop: "1px solid #eee" }} />

        <div className="kyc-section" style={{ marginBottom: "40px" }}>
          <h2 style={{ color: "#333" }}>Farmer Verification</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
            Verify Aadhaar and mobile OTP to earn your farmer badge.
          </p>

          <div style={{ marginBottom: "16px" }}>
            <FarmerVerificationBadge verified={Boolean(user?.verified_badge)} />
          </div>

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>AADHAAR NUMBER</label>
            <input
              type="text"
              maxLength={12}
              placeholder="Enter 12 digit Aadhaar number"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={verificationForm.aadhaarNumber}
              onChange={(e) =>
                setVerificationForm({
                  ...verificationForm,
                  aadhaarNumber: e.target.value.replace(/\D/g, "").slice(0, 12),
                })
              }
              disabled={user?.verified_badge}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>MOBILE NUMBER</label>
            <input
              type="text"
              maxLength={10}
              placeholder="Enter mobile number"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={verificationForm.mobileNumber}
              onChange={(e) =>
                setVerificationForm({
                  ...verificationForm,
                  mobileNumber: e.target.value.replace(/\D/g, "").slice(0, 10),
                })
              }
              disabled={user?.verified_badge}
            />
          </div>

          <button
            type="button"
            onClick={handleSendOtp}
            disabled={sendingOtp || user?.verified_badge}
            style={{
              backgroundColor: user?.verified_badge ? "#6c757d" : "#0f766e",
              color: "white",
              padding: "12px 25px",
              border: "none",
              borderRadius: "4px",
              cursor: user?.verified_badge ? "not-allowed" : "pointer",
              fontSize: "16px",
              width: "100%",
              fontWeight: "bold",
              marginBottom: "15px",
            }}
          >
            {sendingOtp ? "Sending OTP..." : "Send OTP"}
          </button>

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>OTP VERIFICATION</label>
            <input
              type="text"
              maxLength={6}
              placeholder="Enter OTP"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={verificationForm.otp}
              onChange={(e) =>
                setVerificationForm({
                  ...verificationForm,
                  otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                })
              }
              disabled={user?.verified_badge}
            />
          </div>

          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={verifyingOtp || user?.verified_badge}
            style={{
              backgroundColor: user?.verified_badge ? "#6c757d" : "#007bff",
              color: "white",
              padding: "12px 25px",
              border: "none",
              borderRadius: "4px",
              cursor: user?.verified_badge ? "not-allowed" : "pointer",
              fontSize: "16px",
              width: "100%",
              fontWeight: "bold",
            }}
          >
            {verifyingOtp
              ? "Verifying OTP..."
              : user?.verified_badge
                ? "Verified Farmer"
                : "Verify Farmer"}
          </button>
        </div>

        <div className="kyc-section">
          <h2 style={{ color: "#333" }}>KYC Verification</h2>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
            Upload your ID proof to become a verified farmer on KrishiSetu.
          </p>

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>DOCUMENT TYPE</label>
            <select
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={kycForm.documentType}
              onChange={(e) => setKycForm({ ...kycForm, documentType: e.target.value })}
              disabled={user?.kyc?.status === "verified" || user?.kyc?.status === "pending"}
            >
              <option value="">Select Document</option>
              <option value="Aadhaar Card">Aadhaar Card</option>
              <option value="PAN Card">PAN Card</option>
              <option value="Voter ID">Voter ID</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>DOCUMENT NUMBER</label>
            <input
              type="text"
              placeholder="Enter ID Number"
              style={{ width: "100%", padding: "10px", marginTop: "5px", borderRadius: "4px", border: "1px solid #ddd" }}
              value={kycForm.documentNumber}
              onChange={(e) => setKycForm({ ...kycForm, documentNumber: e.target.value })}
              disabled={user?.kyc?.status === "verified" || user?.kyc?.status === "pending"}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontWeight: "bold" }}>UPLOAD DOCUMENT IMAGE</label>
            <input
              type="file"
              style={{ marginTop: "10px" }}
              onChange={(e) => setKycForm({ ...kycForm, documentImage: e.target.files[0] })}
              disabled={user?.kyc?.status === "verified" || user?.kyc?.status === "pending"}
            />
          </div>

          <button
            onClick={handleKYCSubmit}
            disabled={user?.kyc?.status === "verified" || user?.kyc?.status === "pending"}
            style={{
              backgroundColor: user?.kyc?.status === "verified" ? "#6c757d" : "#007bff",
              color: "white",
              padding: "12px 25px",
              border: "none",
              borderRadius: "4px",
              cursor: user?.kyc?.status === "verified" ? "not-allowed" : "pointer",
              fontSize: "16px",
              width: "100%",
              fontWeight: "bold",
            }}
          >
            {user?.kyc?.status === "pending"
              ? "Verification Pending..."
              : user?.kyc?.status === "verified"
                ? "Verified Account"
                : "Submit KYC Documents"}
          </button>

          {user?.kyc?.status === "rejected" && (
            <p style={{ color: "red", marginTop: "10px", fontWeight: "bold" }}>
              Rejection Reason: {user?.kyc?.rejectionReason}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
