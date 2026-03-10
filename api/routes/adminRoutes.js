import express from "express";
import { verifyToken, isAdmin } from "../utils/authMiddleware.js";
import { getAdminDashboard } from "../controllers/adminDashboardController.js";
import {
  getAllFarmersForAdmin,
  updateFarmerStatus,
  liftFarmerSuspension,
  updateFarmerVerification,
} from "../controllers/adminFarmerController.js";
import {
  getAllProductsForAdmin,
  hideProductAsInappropriate,
} from "../controllers/adminProductController.js";
import {
  getAllComplaints,
  updateComplaint,
  suspendComplaintUser,
  sendComplaintWarning,
} from "../controllers/adminComplaintController.js";
import {
  getAllVisitsForAdmin,
  cancelVisitByAdmin,
  suspendFarmerFromVisits,
  liftFarmerVisitSuspension,
} from "../controllers/adminVisitController.js";
import {
  getAllReviewsForAdmin,
  hideReview,
  getLowRatedFarmers,
} from "../controllers/adminReviewController.js";
import {
  createNotification,
  getNotificationsForAdmin,
  deactivateNotification,
} from "../controllers/adminNotificationController.js";
import {
  getSalesOverview,
  getTopProducts,
  getMonthlyRevenue,
  getProductsAnalyticsTable,
  exportProductsAnalyticsCsv,
} from "../controllers/adminAnalyticsController.js";
import {
  getPlatformSettings,
  updatePlatformSettings,
} from "../controllers/adminSettingsController.js";
import { getActivityLogs } from "../controllers/adminActivityController.js";
import {
  getAdminOrders,
  getAdminOrderById,
  flagOrder,
  addOrderNote,
} from "../controllers/adminOrderController.js";
import {
  getAllCustomersForAdmin,
  updateCustomerBlockStatus,
  getCustomerOrderHistory,
} from "../controllers/adminCustomerController.js";
import {
  getFarmerSettlementDetails,
  getSettlementLedger,
  getSettlementSummary,
} from "../controllers/adminSettlementController.js";

const router = express.Router();

// All routes below require authenticated admin
router.use(verifyToken, isAdmin);

// Dashboard
router.get("/dashboard", getAdminDashboard);

// Farmer management
router.get("/farmers", getAllFarmersForAdmin);
router.patch("/farmers/:id/status", updateFarmerStatus);
router.patch("/farmers/:id/lift-suspension", liftFarmerSuspension);
router.patch("/farmers/:id/verification", updateFarmerVerification);

// Product monitoring
router.get("/products", getAllProductsForAdmin);
router.patch("/products/:id/hide", hideProductAsInappropriate);

// Order monitoring
router.get("/orders", getAdminOrders);
router.get("/orders/:id", getAdminOrderById);
router.post("/orders/:id/flag", flagOrder);
router.post("/orders/:id/note", addOrderNote);
router.get("/settlements/summary", getSettlementSummary);
router.get("/settlements/ledger", getSettlementLedger);
router.get("/settlements/farmer/:farmerId", getFarmerSettlementDetails);

// Complaint center
router.get("/complaints", getAllComplaints);
router.patch("/complaints/:id", updateComplaint);
router.post("/complaints/:id/suspend-user", suspendComplaintUser);
router.post("/complaints/:id/send-warning", sendComplaintWarning);

// Visit logs
router.get("/visits", getAllVisitsForAdmin);
router.patch("/visits/:id/cancel", cancelVisitByAdmin);
router.patch("/visits/farmers/:farmerId/suspend", suspendFarmerFromVisits);
router.patch("/visits/farmers/:farmerId/lift", liftFarmerVisitSuspension);

// Customer management
router.get("/customers", getAllCustomersForAdmin);
router.patch("/customers/:id/status", updateCustomerBlockStatus);
router.get("/customers/:id/orders", getCustomerOrderHistory);

// Reviews & ratings
router.get("/reviews", getAllReviewsForAdmin);
router.delete("/reviews/:id", hideReview);
router.get("/farmers/low-rated", getLowRatedFarmers);

// Notifications
router.post("/notifications", createNotification);
router.get("/notifications", getNotificationsForAdmin);
router.patch("/notifications/:id/deactivate", deactivateNotification);

// Analytics & reports
router.get("/analytics/sales", getSalesOverview);
router.get("/analytics/top-products", getTopProducts);
router.get("/analytics/products-table", getProductsAnalyticsTable);
router.get("/analytics/products-export", exportProductsAnalyticsCsv);
router.get("/analytics/monthly-revenue", getMonthlyRevenue);

// Settings
router.get("/settings", getPlatformSettings);
router.put("/settings", updatePlatformSettings);

// Activity logs
router.get("/activity-logs", getActivityLogs);

export default router;

