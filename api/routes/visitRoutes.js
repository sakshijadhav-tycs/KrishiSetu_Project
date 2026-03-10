import express from "express";
import {
    createVisit,
    getMyVisits,
    getVisitRequests,
    updateVisitStatus,
} from "../controllers/visitController.js";
import { verifyToken, isFarmer } from "../utils/authMiddleware.js";

const router = express.Router();

router.route("/").post(verifyToken, createVisit);
router.route("/my-visits").get(verifyToken, getMyVisits);
router.route("/requests").get(verifyToken, isFarmer, getVisitRequests);
router.route("/:id").put(verifyToken, updateVisitStatus);

export default router;
