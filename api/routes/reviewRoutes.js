import express from "express";
import {
  addReview,
  getFarmerRatingSummary,
  getFarmerReviews,
} from "../controllers/reviewController.js";
import { verifyToken } from "../utils/authMiddleware.js"; // Aapka existing middleware use karein

const router = express.Router();

// POST: /api/reviews
router.post("/", verifyToken, addReview);

// GET: /api/reviews/summary/:farmerId
router.get("/summary/:farmerId", getFarmerRatingSummary);

// GET: /api/reviews/:farmerId
router.get("/:farmerId", getFarmerReviews);

export default router;
