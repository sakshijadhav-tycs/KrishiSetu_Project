import express from "express";
import { 
    register, 
    login, 
    verify, 
    resendVerification, 
    getUserProfile, 
    updateUserProfile,
    getAllUsers,
    deleteUser,
    forgotPassword, // ✅ Added Import
    resetPassword   // ✅ Added Import
} from "../controllers/userController.js"; 

import { verifyToken, isAdmin } from "../utils/authMiddleware.js";
import { validateRequest } from "../middleware/validateRequest.js";
import {
    emailOnlyBodySchema,
    loginBodySchema,
    registerBodySchema,
    resetPasswordBodySchema,
} from "../validators/authSchemas.js";
import { authRateLimiter, sensitiveRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

// --- Auth Routes ---

// @route   POST /api/auth/register
router.post("/register", authRateLimiter, validateRequest({ body: registerBodySchema }), register);

// @route   POST /api/auth/login
router.post("/login", authRateLimiter, validateRequest({ body: loginBodySchema }), login);

// @route   POST /api/auth/resend-verification
router.post(
    "/resend-verification",
    authRateLimiter,
    validateRequest({ body: emailOnlyBodySchema }),
    resendVerification
);

// --- Email Verification Route ---
router.post("/verify", authRateLimiter, verify); 

// --- Forgot & Reset Password ---
// @route   POST /api/auth/forgot-password
router.post(
    "/forgot-password",
    sensitiveRateLimiter,
    validateRequest({ body: emailOnlyBodySchema }),
    forgotPassword
);

// @route   POST /api/auth/reset-password
router.post(
    "/reset-password",
    sensitiveRateLimiter,
    validateRequest({ body: resetPasswordBodySchema }),
    resetPassword
);

// --- User Profile Routes ---
router.get("/profile", verifyToken, getUserProfile);
router.put("/profile", verifyToken, updateUserProfile);

// --- Admin Routes ---
router.get("/users", verifyToken, isAdmin, getAllUsers);
router.delete("/user/:id", verifyToken, isAdmin, deleteUser);

export default router;
