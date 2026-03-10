/**
 * Stock Management Routes
 * Monitor and manage product stock levels
 */

import express from "express";
import { verifyToken, isAdmin } from "../utils/authMiddleware.js";
import {
  getStockStatus,
  checkFarmerLowStock,
  getStockInfo,
} from "../controllers/stockController.js";

const router = express.Router();

/**
 * Get stock status for a specific product
 * @route GET /api/stock/:productId
 * @access Public
 */
router.get("/:productId", getStockStatus);

/**
 * Get low stock products for a farmer
 * @route GET /api/stock/farmer/lowstock
 * @access Private (Farmer)
 */
router.get("/farmer/lowstock", verifyToken, checkFarmerLowStock);

/**
 * Get detailed stock information
 * @route GET /api/stock/info/:productId
 * @access Private (Admin, Farmer)
 */
router.get("/info/:productId", verifyToken, getStockInfo);

export default router;
