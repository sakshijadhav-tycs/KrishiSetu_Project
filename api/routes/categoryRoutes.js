import express from "express";
import {
  createCategory,
  getAllCategories,
  getCategory,
  updateCategory,
  deleteCategory,
} from "../controllers/categoryController.js";

import { verifyToken, isAdmin } from "../utils/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCategories);
router.get("/:id", getCategory);

// Admin routes
router.post("/", verifyToken, isAdmin, createCategory);
router.put("/:id", verifyToken, isAdmin, updateCategory);
router.delete("/:id", verifyToken, isAdmin, deleteCategory);

export default router;
