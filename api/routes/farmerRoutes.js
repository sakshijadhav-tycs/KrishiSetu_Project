import express from "express";
import {
    getFarmerProducts,
    createProduct,
    updateProduct,
    deleteProduct
} from "../controllers/productController.js";
import {
    getFarmerProfile,
    updateFarmerProfile
} from "../controllers/userController.js";
// ✅ Naya controller import karein dashboard stats ke liye
import { getFarmerDashboard, getDashboardChartStats } from "../controllers/farmerController.js";
import { verifyToken, isFarmer } from "../utils/authMiddleware.js";

const router = express.Router();

/**
 * @route   GET /api/farmer/dashboard
 * @desc    Get farmer dashboard stats (Revenue, Pending Orders, etc.)
 * @access  Private/Farmer
 */
router.get("/dashboard", verifyToken, isFarmer, getFarmerDashboard);

/**
 * @route   GET /api/farmer/dashboard/charts
 * @desc    Get farmer dashboard chart statistics (Sales, Products, Visitors)
 * @access  Private/Farmer
 */
router.get("/dashboard/charts", verifyToken, isFarmer, getDashboardChartStats);

/**
 * @route   GET /api/farmer/profile/:id
 * @desc    Get farmer profile by user ID
 * @access  Private/Farmer
 */
router.get("/profile/:id", verifyToken, isFarmer, getFarmerProfile);

/**
 * @route   PUT /api/farmer/profile
 * @desc    Create or Update farmer profile details (Farm Name, Location, Area, etc.)
 * @access  Private/Farmer
 */
router.put("/profile", verifyToken, isFarmer, updateFarmerProfile);

/**
 * @route   GET /api/farmer/products
 * @desc    Get all products belonging to the logged-in farmer
 * @access  Private/Farmer
 */
router.get("/products", verifyToken, isFarmer, getFarmerProducts);

/**
 * @route   POST /api/farmer/products
 * @desc    Add a new product
 * @access  Private/Farmer
 */
router.post("/products", verifyToken, isFarmer, createProduct);

/**
 * @route   PUT /api/farmer/products/:id
 * @desc    Update an existing product
 * @access  Private/Farmer
 */
router.put("/products/:id", verifyToken, isFarmer, updateProduct);

/**
 * @route   DELETE /api/farmer/products/:id
 * @desc    Delete a product
 * @access  Private/Farmer
 */
router.delete("/products/:id", verifyToken, isFarmer, deleteProduct);

export default router;