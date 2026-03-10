import express from "express";
import {
  createProduct,
  getAllProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  getFarmerProducts,
} from "../controllers/productController.js";
import { verifyToken, isFarmer } from "../utils/authMiddleware.js";
import { createUpload, uploadMiddleware } from "../utils/multer.js";

const router = express.Router();

const productUpload = createUpload({ folder: "krishisetu/products" });
const productUploadMiddleware = uploadMiddleware(productUpload.array("images", 5));

/* ==========================================
    ROUTES
========================================== */

// Public Routes
router.get("/", getAllProducts);
router.get("/:id", getProduct);

// Protected Routes (Required Login & Farmer Role)
// CREATE PRODUCT: Matches frontend 'images' key
router.post("/", verifyToken, isFarmer, productUploadMiddleware, createProduct);

// UPDATE PRODUCT: Allows image updates
router.put("/:id", verifyToken, isFarmer, productUploadMiddleware, updateProduct);

// GET FARMER'S OWN PRODUCTS
router.get("/farmer/me", verifyToken, isFarmer, getFarmerProducts);

// DELETE PRODUCT
router.delete("/:id", verifyToken, isFarmer, deleteProduct);

export default router;
