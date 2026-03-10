/**
 * Stock Management Utilities
 * Handles stock reservation, confirmation, and rollback
 */

import Product from "../models/ProductModel.js";
import StockReservation from "../models/StockReservationModel.js";
import { sendToUser, broadcastEvent } from "./socketHandler.js";

/**
 * Reserve stock for an order
 * Called when user initiates checkout (before payment)
 * 
 * @param {object} items - Order items [{product, farmer, quantity}]
 * @param {string} orderId - Order ID
 * @param {string} consumerId - Consumer ID
 * @returns {Promise<{success: boolean, reservations: array, errors: array}>}
 */
export const reserveStock = async (items, orderId, consumerId) => {
  const reservations = [];
  const errors = [];

  try {
    for (const item of items) {
      try {
        const product = await Product.findById(item.product);

        if (!product) {
          errors.push(`Product not found: ${item.product}`);
          continue;
        }

        const availableStock = product.quantityAvailable || 0;

        // Check if sufficient stock available
        if (availableStock < item.quantity) {
          errors.push(
            `Insufficient stock for ${product.name}. Available: ${availableStock}, Requested: ${item.quantity}`
          );
          continue;
        }

        // Create reservation record
        const reservation = await StockReservation.create({
          product: item.product,
          order: orderId,
          consumer: consumerId,
          farmer: item.farmer,
          reservedQuantity: item.quantity,
          status: "reserved",
        });

        // Deduct from available stock immediately
        product.quantityAvailable -= item.quantity;
        await product.save();

        reservations.push(reservation);

        console.log(
          `✓ Stock reserved: ${product.name} (${item.quantity} units)`
        );
      } catch (itemError) {
        errors.push(
          `Error reserving stock for item: ${itemError.message}`
        );
      }
    }

    if (reservations.length === 0 && errors.length > 0) {
      throw new Error("Failed to reserve all items: " + errors.join(", "));
    }

    return {
      success: true,
      reservations,
      errors,
      totalReserved: reservations.length,
      totalErrors: errors.length,
    };
  } catch (error) {
    console.error("Stock reservation error:", error);
    
    // Rollback all reservations
    await releaseStock(reservations.map(r => r._id));
    
    return {
      success: false,
      reservations: [],
      errors: [error.message],
    };
  }
};

/**
 * Confirm stock reservation after successful payment
 * Called when payment is confirmed
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<{success: boolean, confirmedCount: number}>}
 */
export const confirmStockReservation = async (orderId) => {
  try {
    const result = await StockReservation.updateMany(
      { order: orderId, status: "reserved" },
      { 
        status: "confirmed",
        notes: "Stock confirmed after payment",
      }
    );

    console.log(`✓ Stock confirmed for order: ${orderId}`);

    return {
      success: true,
      confirmedCount: result.modifiedCount,
    };
  } catch (error) {
    console.error("Stock confirmation error:", error);
    return {
      success: false,
      confirmedCount: 0,
      error: error.message,
    };
  }
};

/**
 * Release reserved stock on payment failure/cancellation
 * Restores stock back to product quantity
 * 
 * @param {array} reservationIds - Array of reservation IDs to release
 * @returns {Promise<{success: boolean, releasedCount: number}>}
 */
export const releaseStock = async (reservationIds) => {
  try {
    const reservations = await StockReservation.find({
      _id: { $in: reservationIds },
      status: { $in: ["reserved", "expired"] },
    });

    let releasedCount = 0;

    for (const reservation of reservations) {
      try {
        const product = await Product.findById(reservation.product);

        if (product) {
          // Restore stock
          product.quantityAvailable =
            (product.quantityAvailable || 0) + reservation.reservedQuantity;
          await product.save();

          // Mark reservation as released
          reservation.status = "released";
          reservation.notes = "Stock released due to payment failure/cancellation";
          await reservation.save();

          releasedCount++;

          console.log(
            `✓ Stock released: ${reservation.reservedQuantity} units for product: ${reservation.product}`
          );
        }
      } catch (itemError) {
        console.error(
          `Error releasing stock for reservation ${reservation._id}:`,
          itemError
        );
      }
    }

    return {
      success: true,
      releasedCount,
    };
  } catch (error) {
    console.error("Stock release error:", error);
    return {
      success: false,
      releasedCount: 0,
      error: error.message,
    };
  }
};

/**
 * Release stock for cancelled order
 * 
 * @param {string} orderId - Order ID
 * @returns {Promise<{success: boolean, releasedCount: number}>}
 */
export const releaseStockByOrder = async (orderId) => {
  try {
    const reservations = await StockReservation.find({
      order: orderId,
      status: { $in: ["reserved", "confirmed"] },
    });

    const reservationIds = reservations.map(r => r._id);
    return await releaseStock(reservationIds);
  } catch (error) {
    console.error("Error releasing stock for order:", error);
    return {
      success: false,
      releasedCount: 0,
      error: error.message,
    };
  }
};

/**
 * Clean up expired reservations
 * Called periodically to release stock from unpaid orders
 * 
 * @returns {Promise<{success: boolean, expiredCount: number}>}
 */
export const cleanupExpiredReservations = async () => {
  try {
    const now = new Date();

    const expiredReservations = await StockReservation.find({
      expiresAt: { $lt: now },
      status: "reserved",
    });

    const expiredIds = expiredReservations.map(r => r._id);
    
    if (expiredIds.length > 0) {
      const result = await releaseStock(expiredIds);
      
      console.log(
        `✓ Cleaned up ${result.releasedCount} expired stock reservations`
      );

      return {
        success: true,
        expiredCount: result.releasedCount,
      };
    }

    return {
      success: true,
      expiredCount: 0,
    };
  } catch (error) {
    console.error("Cleanup expired reservations error:", error);
    return {
      success: false,
      expiredCount: 0,
      error: error.message,
    };
  }
};

/**
 * Check and alert for low stock
 * 
 * @param {string} productId - Product ID
 * @param {object} socketIO - Socket.IO instance (optional for real-time alerts)
 * @returns {Promise<{isLow: boolean, currentStock: number, minimumStock: number}>}
 */
export const checkLowStock = async (productId, socketIO = null) => {
  try {
    const product = await Product.findById(productId).populate("farmer");

    if (!product) {
      return { isLow: false, error: "Product not found" };
    }

    const minimumStock = product.minStockLevel || 5;
    const currentStock = product.quantityAvailable || 0;
    const isLow = currentStock <= minimumStock;

    if (isLow && socketIO && product.farmer) {
      // Send real-time alert to farmer
      sendToUser(socketIO, product.farmer._id, "stock:alert", {
        productId: product._id,
        productName: product.name,
        currentStock,
        minimumStock,
        alertLevel: "warning",
      });

      console.log(
        `⚠️  Low stock alert for ${product.name}: ${currentStock}/${minimumStock}`
      );
    }

    return {
      isLow,
      currentStock,
      minimumStock,
      product: {
        id: product._id,
        name: product.name,
        farmer: product.farmer?._id,
      },
    };
  } catch (error) {
    console.error("Low stock check error:", error);
    return {
      isLow: false,
      error: error.message,
    };
  }
};

/**
 * Get stock status for a product
 * 
 * @param {string} productId - Product ID
 * @returns {Promise<object>} Stock status details
 */
export const getStockStatus = async (productId) => {
  try {
    const product = await Product.findById(productId);

    if (!product) {
      return { error: "Product not found" };
    }

    const totalReserved = await StockReservation.aggregate([
      {
        $match: {
          product: product._id,
          status: { $in: ["reserved", "confirmed"] },
        },
      },
      {
        $group: {
          _id: null,
          totalReserved: { $sum: "$reservedQuantity" },
        },
      },
    ]);

    const reserved = totalReserved[0]?.totalReserved || 0;
    const available = product.quantityAvailable || 0;
    const total = available + reserved;

    return {
      productId: product._id,
      productName: product.name,
      available,
      reserved,
      total,
      minimumStock: product.minStockLevel || 5,
      isLow: available <= (product.minStockLevel || 5),
      percentageAvailable: total > 0 ? Math.round((available / total) * 100) : 0,
    };
  } catch (error) {
    console.error("Get stock status error:", error);
    return { error: error.message };
  }
};

/**
 * Batch check low stock for all products of a farmer
 * 
 * @param {string} farmerId - Farmer ID
 * @returns {Promise<array>} Array of low stock products
 */
export const checkFarmerLowStock = async (farmerId) => {
  try {
    const minimumStock = 5; // Default minimum

    const lowStockProducts = await Product.find({
      farmer: farmerId,
      $expr: { $lte: ["$quantityAvailable", minimumStock] },
    })
      .select("name quantityAvailable minStockLevel")
      .limit(10);

    return {
      success: true,
      count: lowStockProducts.length,
      products: lowStockProducts,
    };
  } catch (error) {
    console.error("Check farmer low stock error:", error);
    return {
      success: false,
      count: 0,
      error: error.message,
    };
  }
};

// Cleanup expired reservations every 10 minutes
setInterval(async () => {
  const result = await cleanupExpiredReservations();
  if (!result.success) {
    console.error("Scheduled cleanup failed:", result.error);
  }
}, 10 * 60 * 1000);
