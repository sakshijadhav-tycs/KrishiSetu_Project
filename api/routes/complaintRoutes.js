import express from "express";
import { verifyToken } from "../utils/authMiddleware.js";
import upload from "../utils/multer.js";
import {
  getMyComplaints,
  raiseComplaint,
} from "../controllers/complaintController.js";

const router = express.Router();

router.post("/", verifyToken, upload.single("image"), raiseComplaint);
router.get("/my", verifyToken, getMyComplaints);

export default router;
