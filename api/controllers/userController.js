import User from "../models/UserModel.js";
import FarmerProfile from "../models/FarmerProfileModel.js";
import Review from "../models/ReviewModel.js";
import Order from "../models/OrderModel.js";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { verifyEmail } from "../emailVerify/verifyEmail.js";
import { forgotPasswordEmail } from "../emailVerify/forgotPasswordEmail.js";
import { sendWelcomeEmail } from "../utils/sendEmail.js";
import { sendOtpSms } from "../services/smsService.js";
import {
    autoReactivateExpiredSuspensions,
    FARMER_ACCOUNT_STATUS,
    getFarmerAccountBlockReason,
} from "../utils/accountStatus.js";

const AADHAAR_REGEX = /^\d{12}$/;
const MOBILE_REGEX = /^\d{10}$/;

const buildUserResponse = (user) => ({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    profileImage: user.profileImage,
    address: user.address,
    kyc: user.kyc,
    isFirstLogin: user.isFirstLogin,
    accountStatus: user.accountStatus,
    isBlocked: user.isBlocked,
    rejectionReason: user.rejectionReason,
    suspensionStartDate: user.suspensionStartDate,
    suspensionEndDate: user.suspensionEndDate,
    suspensionReason: user.suspensionReason,
    aadhaar_number: user.aadhaar_number,
    mobile_number: user.mobile_number,
    verification_status: user.verification_status,
    otp_verified: user.otp_verified,
    verified_badge: user.verified_badge,
    kyc_submitted_at: user.kyc_submitted_at,
    kyc_verified_at: user.kyc_verified_at,
    verification_rejection_reason: user.verification_rejection_reason,
});

const normalizeAadhaar = (value = "") => String(value).replace(/\D/g, "");
const normalizeMobile = (value = "") => String(value).replace(/\D/g, "");

const maskAadhaar = (value = "") => {
    const digits = normalizeAadhaar(value);
    if (digits.length !== 12) return "";
    return `XXXX XXXX ${digits.slice(-4)}`;
};

const getVerificationUrl = (token) => {
    const frontendBase = process.env.FRONTEND_URL || "http://localhost:5173";
    return `${frontendBase}/verify-email?token=${token}`;
};

// --- AUTH FUNCTIONS ---

// @desc    Register a new user
export const register = async (req, res) => {
    try {
        const { firstName, lastName, email, password, role, phone, address } = req.body;

        if (!firstName || !lastName || !email || !password || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'All fields (Name, Email, Password, and Phone) are required' 
            });
        }

        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({ success: false, message: 'User Already Exists' });
        }

        const newUser = new User({
            firstName,
            lastName,
            name: `${firstName} ${lastName}`,
            email,
            password, 
            role: role || "consumer",
            phone,
            address,
            isverified: false 
        });

        const verificationToken = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: '365d' });
        newUser.token = verificationToken;

        await newUser.save();

        try {
            await sendWelcomeEmail({
                email: newUser.email,
                name: newUser.name,
                userId: newUser._id,
            });
        } catch (welcomeError) {
            console.error("Welcome Email Warning:", welcomeError.message);
        }

        try {
            await verifyEmail(verificationToken, email); 
        } catch (emailError) {
            console.error("Email Service Warning:", emailError.message);
        }

        return res.status(201).json({
            success: true,
            message: 'User Registered Successfully! Please verify your email.',
            user: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role
            },
            ...(process.env.NODE_ENV === "production"
                ? {}
                : { verificationUrl: getVerificationUrl(verificationToken) }),
        });
    } catch (error) {
        console.error("Register Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Login user
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, message: "Email and password are required" });
        }

        const user = await User.findOne({ email }).select("+password");
        
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        if (!user.isverified) {
            return res.status(403).json({ 
                success: false, 
                message: "Please verify your email first",
                unverified: true,
                ...(process.env.NODE_ENV === "production"
                    ? {}
                    : { verificationUrl: getVerificationUrl(user.token) }),
            });
        }
        if ((user.role === "consumer" || user.role === "user") && user.isBlocked) {
            return res.status(403).json({
                success: false,
                message: "Your account is blocked. Please contact support.",
            });
        }

        if (
            user.role === "farmer" &&
            ["Suspended", "suspended"].includes(user.accountStatus) &&
            user.suspensionEndDate &&
            new Date(user.suspensionEndDate) < new Date()
        ) {
            user.accountStatus = "Approved";
            user.suspensionStartDate = null;
            user.suspensionEndDate = null;
            user.suspensionReason = "";
            await user.save();
        }

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '365d' });

        res.status(200).json({
            success: true,
            token,
            user: buildUserResponse(user),
        });
    } catch (error) {
        console.error("Login Error:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

// @desc    Forgot Password - Send OTP
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        user.resetPasswordOTP = otp;
        user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
        await user.save();

        try {
            await forgotPasswordEmail(user.email, otp); 
        } catch (emailError) {
            return res.status(500).json({ success: false, message: "Failed to send OTP email" });
        }

        res.status(200).json({ success: true, message: "OTP sent successfully to your email" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reset Password using OTP
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;
        
        const user = await User.findOne({ 
            email, 
            resetPasswordOTP: otp,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: "Invalid OTP or OTP has expired" });
        }

        user.password = newPassword; 
        user.resetPasswordOTP = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Password reset successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Resend Verification Email
export const resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (user.isverified) return res.status(400).json({ success: false, message: "Already verified" });

        const verificationToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '365d' });
        user.token = verificationToken;
        await user.save();

        await verifyEmail(verificationToken, email);
        res.status(200).json({
            success: true,
            message: "Verification link resent!",
            ...(process.env.NODE_ENV === "production"
                ? {}
                : { verificationUrl: getVerificationUrl(verificationToken) }),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: "Failed to resend", error: error.message });
    }
};

// @desc    Verify email token
export const verify = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(" ")[1];
        if (!token) return res.status(400).json({ success: false, message: 'Token missing.' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) return res.status(400).json({ success: false, message: 'User not found' });

        user.token = null; 
        user.isverified = true; 
        await user.save();

        return res.status(200).json({ success: true, message: 'Email verified successfully!' });
    } catch (error) {
        res.status(400).json({ success: false, message: "Invalid or expired token" });
    }
};

// --- KYC FUNCTIONS ---

// @desc    Farmer submits KYC documents
export const submitFarmerKYC = async (req, res) => {
    try {
        const { documentType, documentNumber } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        if (user.role !== "farmer") {
            return res.status(403).json({ success: false, message: "Only farmers can submit KYC" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "Please upload a document image" });
        }

        user.kyc.documentType = documentType;
        user.kyc.documentNumber = documentNumber;
        user.kyc.documentImage = req.file.path.replace(/\\/g, "/"); 
        user.kyc.status = "pending";
        user.kyc.submittedAt = Date.now();
        user.kyc.rejectionReason = ""; 
        user.kyc_submitted_at = user.kyc_submitted_at || new Date();

        await user.save();

        res.status(200).json({ 
            success: true, 
            message: "KYC submitted successfully. Waiting for admin approval.",
            data: user.kyc 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Admin updates KYC status
export const updateKYCStatus = async (req, res) => {
    try {
        const { userId, status, reason } = req.body;

        if (!["verified", "rejected"].includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: "Farmer not found" });
        }

        user.kyc.status = status;
        if (status === "rejected") {
            user.kyc.rejectionReason = reason || "Documents are not clear or invalid.";
        } else {
            user.kyc.rejectionReason = "";
            user.kyc_verified_at = new Date();
        }

        await user.save();

        res.status(200).json({ 
            success: true, 
            message: `KYC status updated to ${status}`,
            data: user.kyc 
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get all pending KYC requests for Admin
export const getKYCRequests = async (req, res) => {
    try {
        const pendingRequests = await User.find({ "kyc.status": "pending" }).select("name email phone kyc aadhaar_number mobile_number verification_status verified_badge kyc_submitted_at kyc_verified_at");
        res.status(200).json({ success: true, count: pendingRequests.length, data: pendingRequests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ✅ @desc    Get all Verified Farmers for Admin
// ✅ @route   GET /api/users/kyc/verified
export const getVerifiedFarmers = async (req, res) => {
    try {
        const verifiedFarmers = await User.find({
            $or: [
                { "kyc.status": "verified" },
                { verified_badge: true },
            ],
        }).select("name email phone kyc aadhaar_number mobile_number verification_status verified_badge kyc_submitted_at kyc_verified_at");
        res.status(200).json({ success: true, count: verifiedFarmers.length, data: verifiedFarmers });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const sendFarmerVerificationOtp = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        const aadhaarNumber = normalizeAadhaar(
            req.body.aadhaar_number || req.body.aadhaarNumber || req.body.documentNumber
        );
        const mobileNumber = normalizeMobile(
            req.body.mobile_number || req.body.mobileNumber
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role !== "farmer") {
            return res.status(403).json({ success: false, message: "Only farmers can request verification" });
        }
        if (!AADHAAR_REGEX.test(aadhaarNumber)) {
            return res.status(400).json({ success: false, message: "Aadhaar number must be exactly 12 digits" });
        }
        if (!MOBILE_REGEX.test(mobileNumber)) {
            return res.status(400).json({ success: false, message: "Mobile number must be exactly 10 digits" });
        }

        const otp = `${Math.floor(100000 + Math.random() * 900000)}`;
        user.aadhaar_number = aadhaarNumber;
        user.mobile_number = mobileNumber;
        user.verification_status = "unverified";
        user.otp_verified = false;
        user.verified_badge = false;
        user.kyc_submitted_at = new Date();
        user.kyc_verified_at = null;
        user.verification_rejection_reason = "";
        user.mobile_otp_code = otp;
        user.mobile_otp_expires_at = new Date(Date.now() + 5 * 60 * 1000);
        await user.save();

        const smsResult = await sendOtpSms({
            mobileNumber: user.mobile_number,
            otp,
        });

        return res.status(200).json({
            success: true,
            message: smsResult?.message || "OTP sent successfully",
            data: {
                mobile_number: user.mobile_number,
                verification_status: user.verification_status,
                aadhaar_masked: maskAadhaar(user.aadhaar_number),
                ...(process.env.NODE_ENV === "production" || !smsResult?.simulated ? {} : { otp }),
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const verifyFarmerVerificationOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const user = await User.findById(req.user.id).select("+mobile_otp_code");
        const aadhaarNumber = normalizeAadhaar(
            req.body.aadhaar_number || req.body.aadhaarNumber || user?.aadhaar_number
        );
        const mobileNumber = normalizeMobile(
            req.body.mobile_number || req.body.mobileNumber || user?.mobile_number
        );

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        if (user.role !== "farmer") {
            return res.status(403).json({ success: false, message: "Only farmers can complete verification" });
        }
        if (!AADHAAR_REGEX.test(aadhaarNumber)) {
            return res.status(400).json({ success: false, message: "Aadhaar number must be exactly 12 digits" });
        }
        if (!MOBILE_REGEX.test(mobileNumber)) {
            return res.status(400).json({ success: false, message: "Mobile number must be exactly 10 digits" });
        }
        if (!otp || String(otp).trim().length !== 6) {
            return res.status(400).json({ success: false, message: "OTP must be exactly 6 digits" });
        }
        if (user.aadhaar_number !== aadhaarNumber || user.mobile_number !== mobileNumber) {
            return res.status(400).json({ success: false, message: "Verification details do not match the OTP request" });
        }
        if (!user.mobile_otp_code || String(user.mobile_otp_code) !== String(otp).trim()) {
            return res.status(400).json({ success: false, message: "Invalid OTP" });
        }
        if (!user.mobile_otp_expires_at || new Date(user.mobile_otp_expires_at) < new Date()) {
            return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
        }

        user.verification_status = "verified";
        user.otp_verified = true;
        user.verified_badge = true;
        user.kyc_verified_at = new Date();
        user.verification_rejection_reason = "";
        user.mobile_otp_code = "";
        user.mobile_otp_expires_at = null;
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Aadhaar verified successfully",
            data: {
                aadhaar_masked: maskAadhaar(user.aadhaar_number),
                mobile_number: user.mobile_number,
                verification_status: user.verification_status,
                otp_verified: user.otp_verified,
                verified_badge: user.verified_badge,
                kyc_submitted_at: user.kyc_submitted_at,
                kyc_verified_at: user.kyc_verified_at,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};

// --- USER & PROFILE FUNCTIONS ---

export const getUserProfile = async (req, res) => {
    try {
        await autoReactivateExpiredSuspensions();
        const user = await User.findById(req.user.id).select("-password");
        if (user) {
            const accountState =
                user.role === "farmer" ? getFarmerAccountBlockReason(user) : null;
            res.json({ success: true, user, accountState });
        } else {
            res.status(404).json({ success: false, message: "User not found" });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Mark onboarding/tutorial as completed (so Joyride doesn't repeat)
export const completeTutorial = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        user.isFirstLogin = false;
        await user.save();

        res.json({
            success: true,
            message: "Tutorial completed",
            user: buildUserResponse(user),
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const updateUserProfile = async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        const user = await User.findById(req.user.id);

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        user.name = name || user.name;
        user.phone = phone || user.phone;
        user.address = address || user.address;
        
        const updatedUser = await user.save();
        res.json({ success: true, data: updatedUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

// --- ADMIN & FARMER FUNCTIONS ---

export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find().select("-password");
        res.json({ success: true, count: users.length, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const deleteUser = async (req, res) => {
    try {
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "User removed" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getAllFarmers = async (req, res) => {
    try {
        await autoReactivateExpiredSuspensions();
        const farmers = await User.find({
            role: "farmer",
            accountStatus: { $in: [FARMER_ACCOUNT_STATUS.APPROVED, "approved"] },
        }).select("-password");

        if (!farmers.length) {
            return res.json({ success: true, count: 0, data: [] });
        }

        const farmerIds = farmers.map((farmer) => farmer._id);

        const [reviewStats, orderStats] = await Promise.all([
            Review.aggregate([
                {
                    $match: {
                        farmerId: { $in: farmerIds },
                        isHidden: { $ne: true },
                    },
                },
                {
                    $group: {
                        _id: "$farmerId",
                        avgRating: { $avg: "$rating" },
                        ratingCount: { $sum: 1 },
                    },
                },
            ]),
            Order.aggregate([
                { $match: { status: { $in: ["completed", "delivered"] } } },
                { $unwind: "$items" },
                { $match: { "items.farmer": { $in: farmerIds } } },
                {
                    $group: {
                        _id: "$items.farmer",
                        completedOrders: { $sum: 1 },
                        totalRevenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } },
                    },
                },
            ]),
        ]);

        const reviewMap = new Map(
            reviewStats.map((item) => [
                item._id.toString(),
                {
                    avgRating: Number(item.avgRating || 0),
                    ratingCount: item.ratingCount || 0,
                },
            ])
        );

        const orderMap = new Map(
            orderStats.map((item) => [
                item._id.toString(),
                {
                    completedOrders: item.completedOrders || 0,
                    totalRevenue: Number(item.totalRevenue || 0),
                },
            ])
        );

        const rankedFarmers = farmers
            .map((farmer) => {
                const reviewInfo = reviewMap.get(farmer._id.toString()) || {
                    avgRating: 0,
                    ratingCount: 0,
                };
                const orderInfo = orderMap.get(farmer._id.toString()) || {
                    completedOrders: 0,
                    totalRevenue: 0,
                };
                const performanceScore =
                    reviewInfo.avgRating * 20 +
                    Math.min(orderInfo.completedOrders, 60) +
                    Math.min(orderInfo.totalRevenue / 200, 20);

                return {
                    ...farmer.toObject(),
                    avgRating: Number(reviewInfo.avgRating.toFixed(2)),
                    ratingCount: reviewInfo.ratingCount,
                    completedOrders: orderInfo.completedOrders,
                    totalRevenue: Number(orderInfo.totalRevenue.toFixed(2)),
                    performanceScore: Number(performanceScore.toFixed(2)),
                };
            })
            .sort((a, b) => {
                if (b.performanceScore !== a.performanceScore) {
                    return b.performanceScore - a.performanceScore;
                }
                if (b.avgRating !== a.avgRating) {
                    return b.avgRating - a.avgRating;
                }
                return a.name.localeCompare(b.name);
            });

        res.json({ success: true, count: rankedFarmers.length, data: rankedFarmers });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getFarmerProfile = async (req, res) => {
    try {
        await autoReactivateExpiredSuspensions();
        const farmer = await User.findOne({ _id: req.params.id, role: "farmer" }).select("-password");
        if (!farmer) {
            return res.status(404).json({ success: false, message: "Farmer not found" });
        }
        const isOwnerOrAdmin =
            req.user &&
            (req.user.role === "admin" ||
                req.user._id?.toString() === farmer._id.toString());

        if (!isOwnerOrAdmin && !["Approved", "approved"].includes(farmer.accountStatus)) {
            return res.status(404).json({ success: false, message: "Farmer not found" });
        }
        const profile = await FarmerProfile.findOne({ user: req.params.id });
        res.json({ success: true, data: { farmer, profile: profile || {} } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
};

export const updateFarmerProfile = async (req, res) => {
    try {
        const { 
            farmerName, location, latitude, longitude, locationAddress, totalArea, cultivationArea, 
            agricultureMethod, description, farmImages 
        } = req.body;

        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "User not authorized" });
        }

        const profileFields = {
            user: req.user.id,
            farmerName,
            location,
            latitude: latitude || null,
            longitude: longitude || null,
            locationAddress: locationAddress || "",
            totalArea,
            cultivationArea,
            agricultureMethod,
            description,
            farmImages: farmImages || []
        };

        let farmerProfile = await FarmerProfile.findOneAndUpdate(
            { user: req.user.id },
            { $set: profileFields },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({ 
            success: true, 
            message: "Farm profile updated successfully", 
            data: farmerProfile 
        });

    } catch (error) {
        console.error("Backend Error Details:", error); 
        res.status(500).json({ 
            success: false, 
            message: "Database Error", 
            error: error.message 
        });
    }
};

export const updateFarmerProfileImage = async (req, res) => {
    try {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "User not authorized" });
        }
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Profile image is required" });
        }

        const user = await User.findOne({ _id: req.user.id, role: "farmer" });
        if (!user) {
            return res.status(404).json({ success: false, message: "Farmer not found" });
        }

        user.profileImage = req.file.path.replace(/\\/g, "/");
        await user.save();

        return res.status(200).json({
            success: true,
            message: "Profile image updated successfully",
            data: {
                _id: user._id,
                profileImage: user.profileImage,
            },
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};
