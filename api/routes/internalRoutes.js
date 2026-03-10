import express from "express";
import {
  getSettlementRunHistoryInternal,
  runSettlementSweepInternal,
} from "../controllers/internalController.js";
import { verifyToken, isAdmin } from "../utils/authMiddleware.js";
import { sensitiveRateLimiter } from "../middleware/rateLimiter.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { settlementRunsQuerySchema } from "../validators/internalSchemas.js";

const router = express.Router();

router.post(
  "/run-settlement-sweep",
  verifyToken,
  isAdmin,
  sensitiveRateLimiter,
  runSettlementSweepInternal
);
router.get(
  "/settlement-runs",
  verifyToken,
  isAdmin,
  validateRequest({ query: settlementRunsQuerySchema }),
  getSettlementRunHistoryInternal
);

export default router;
