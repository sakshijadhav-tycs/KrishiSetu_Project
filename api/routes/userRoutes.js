import express from "express";
import {
    getAllFarmers,
    getFarmerProfile,
    updateFarmerProfile,
    updateUserProfile,
    getAllUsers,
    deleteUser,
    register,
    verify,
    login,
    submitFarmerKYC,
    updateKYCStatus,
    getKYCRequests,
    getVerifiedFarmers,
    completeTutorial,
    updateFarmerProfileImage,
    sendFarmerVerificationOtp,
    verifyFarmerVerificationOtp,
} from "../controllers/userController.js";
import { verifyToken, isAdmin, isFarmer } from "../utils/authMiddleware.js";
// 🚨 Multer import karna zaroori hai images handle karne ke liye
import upload from "../utils/multer.js"; 

const router = express.Router();

// --- Public routes ---
router.get("/farmers", getAllFarmers);
router.get("/farmers/:id", getFarmerProfile);

// --- Auth Routes ---
router.post("/register", register);
router.post("/verify", verify);
router.post("/login", login); 

// --- Private routes ---
router.put("/profile", verifyToken, updateUserProfile);
router.put("/farmers/profile", verifyToken, isFarmer, updateFarmerProfile);
router.put("/farmers/profile-image", verifyToken, isFarmer, upload.single("profileImage"), updateFarmerProfileImage);
router.post("/farmers/verification/send-otp", verifyToken, isFarmer, sendFarmerVerificationOtp);
router.post("/farmers/verification/verify-otp", verifyToken, isFarmer, verifyFarmerVerificationOtp);

// Tutorial / onboarding completion
router.post("/tutorial/complete", verifyToken, completeTutorial);

// --- 🚨 KYC Routes (Newly Added & Fixed) ---

/**
 * @route   POST /api/users/kyc/submit
 * @desc    Farmer apne documents yahan se submit karega
 * @access  Private (Farmer only)
 */
router.post(
    "/kyc/submit", 
    verifyToken, 
    isFarmer, 
    upload.single("documentImage"), 
    submitFarmerKYC
);

/**
 * @route   GET /api/users/kyc/requests
 * @desc    Admin saari pending requests yahan dekh sakta hai
 * @access  Private (Admin only)
 */
router.get("/kyc/requests", verifyToken, isAdmin, getKYCRequests);

/**
 * @route   GET /api/users/kyc/verified
 * @desc    Admin verified farmers ki list yahan dekh sakta hai
 * @access  Private (Admin only)
 */
// ✅ Naya route jo verified farmers return karega
router.get("/kyc/verified", verifyToken, isAdmin, getVerifiedFarmers);

/**
 * @route   PUT /api/users/kyc/status
 * @desc    Admin KYC ko verify ya reject yahan se karega
 * @access  Private (Admin only)
 */
router.put("/kyc/status", verifyToken, isAdmin, updateKYCStatus);

// --- Admin routes ---
router.get("/", verifyToken, isAdmin, getAllUsers);
router.delete("/:id", verifyToken, isAdmin, deleteUser);

export default router;
