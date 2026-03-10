/**
 * Stock Controller
 * Handles stock management endpoints
 */

import {
  getStockStatus as getStockStatusUtil,
  checkFarmerLowStock as checkFarmerLowStockUtil,
} from "../utils/stockManagement.js";
import Product from "../models/ProductModel.js";
import StockReservation from "../models/StockReservationModel.js";

/**
 * Get stock status for a product
 * @route GET /api/stock/:productId
 */
export const getStockStatus = async (req, res) => {
  try {
    const { productId } = req.params;

    const stockStatus = await getStockStatusUtil(productId);

    if (stockStatus.error) {
      return res.status(404).json({
        success: false,
        message: stockStatus.error,
      });
    }

    res.status(200).json({
      success: true,
      data: stockStatus,
    });
  } catch (error) {
    console.error("Stock status error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stock status",
      error: error.message,
    });
  }
};

/**
 * Get low stock products for a farmer
 * @route GET /api/stock/farmer/lowstock
 * @access Private (Farmer)
 */
export const checkFarmerLowStock = async (req, res) => {
  try {
    const farmerId = req.user._id;

    const result = await checkFarmerLowStockUtil(farmerId);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error,
      });
    }

    res.status(200).json({
      success: true,
      count: result.count,
      products: result.products,
    });
  } catch (error) {
    console.error("Check farmer low stock error:", error);
    res.status(500).json({
      success: false,
      message: "Error checking low stock",
      error: error.message,
    });
  }
};

/**
 * Get detailed stock information
 * Includes reservations and availability
 * @route GET /api/stock/info/:productId
 */
export const getStockInfo = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findById(productId)
      .populate("farmer", "name")
      .select("name quantityAvailable minStockLevel farmer");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Get active reservations
    const reservations = await StockReservation.find({
      product: productId,
      status: { $in: ["reserved", "confirmed"] },
    }).select("reservedQuantity status createdAt");

    const totalReserved = reservations.reduce(
      (sum, res) => sum + res.reservedQuantity,
      0
    );
    const available = product.quantityAvailable || 0;
    const total = available + totalReserved;

    res.status(200).json({
      success: true,
      data: {
        productId: product._id,
        productName: product.name,
        farmerName: product.farmer?.name,
        availability: {
          current: available,
          reserved: totalReserved,
          total: total,
          minimumLevel: product.minStockLevel || 5,
          isLow: available <= (product.minStockLevel || 5),
        },
        reservations: {
          active: reservations.length,
          details: reservations,
        },
      },
    });
  } catch (error) {
    console.error("Get stock info error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stock information",
      error: error.message,
    });
  }
};

/**
 * Get all reservations for admin
 * @route GET /api/stock/reservations/all
 * @access Private (Admin)
 */
export const getAllReservations = async (req, res) => {
  try {
    const reservations = await StockReservation.find()
      .populate("product", "name")
      .populate("farmer", "name email")
      .populate("consumer", "name email")
      .sort({ createdAt: -1 })
      .limit(50);

    const total = await StockReservation.countDocuments();
    const active = await StockReservation.countDocuments({
      status: { $in: ["reserved", "confirmed"] },
    });
    const expired = await StockReservation.countDocuments({
      status: "expired",
    });

    res.status(200).json({
      success: true,
      summary: { total, active, expired },
      data: reservations,
    });
  } catch (error) {
    console.error("Get all reservations error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching reservations",
      error: error.message,
    });
  }
};
