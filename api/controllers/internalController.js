import { runRegularSettlementSweep } from "../services/settlementService.js";
import SettlementJobRun from "../models/SettlementJobRunModel.js";

export const runSettlementSweepInternal = async (req, res) => {
  try {
    const result = await runRegularSettlementSweep(new Date(), {
      source: "manual:internal_admin_endpoint",
    });
    return res.status(200).json({
      success: true,
      message: "Settlement sweep executed",
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Settlement sweep failed",
      error: error.message,
    });
  }
};

export const getSettlementRunHistoryInternal = async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, Number(req.query?.limit || 20)));
    const data = await SettlementJobRun.find({})
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();
    return res.status(200).json({
      success: true,
      count: data.length,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to load settlement run history",
      error: error.message,
    });
  }
};
