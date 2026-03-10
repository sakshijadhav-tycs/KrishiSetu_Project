import express from "express";
import {
  createDeal,
  disableDealByAdmin,
  getAdminDeals,
  getMyDeals,
  getPublicActiveDeals,
  updateDeal,
} from "../controllers/dealController.js";
import { isAdmin, isFarmer, verifyToken } from "../utils/authMiddleware.js";

const router = express.Router();

router.get("/public/active", getPublicActiveDeals);

router.use(verifyToken);

router.get("/farmer/me", isFarmer, getMyDeals);
router.post("/", isFarmer, createDeal);
router.put("/:id", isFarmer, updateDeal);

router.get("/admin", isAdmin, getAdminDeals);
router.patch("/:id/admin-disable", isAdmin, disableDealByAdmin);

export default router;
