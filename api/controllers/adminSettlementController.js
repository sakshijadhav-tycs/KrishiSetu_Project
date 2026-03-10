import mongoose from "mongoose";
import Order from "../models/OrderModel.js";
import SubOrder from "../models/SubOrderModel.js";
import User from "../models/UserModel.js";
import SettlementJobRun from "../models/SettlementJobRunModel.js";

const toObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || ""))
    ? new mongoose.Types.ObjectId(String(value))
    : null;

const parseDateStart = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDateEnd = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
};

const normalizeStatus = (value) => {
  const v = String(value || "all").trim();
  if (["Pending", "Eligible", "Transferred", "OnHold"].includes(v)) return v;
  return "all";
};

const normalizeType = (value) => {
  const v = String(value || "all").toLowerCase().trim();
  if (v === "regular") return "regular";
  if (v === "transparent") return "transparent";
  return "all";
};

const normalizeOverdueOnly = (value) =>
  String(value || "false").toLowerCase() === "true";

const getRegularPipeline = ({
  farmerObjectId,
  status,
  from,
  to,
  overdueOnly,
}) => {
  const now = new Date();
  const match = {
    payoutStatus: { $in: ["Pending", "Eligible", "Transferred", "OnHold"] },
  };
  if (status !== "all") match.payoutStatus = status;

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        farmerCandidates: {
          $setUnion: [
            {
              $map: {
                input: { $ifNull: ["$items", []] },
                as: "it",
                in: "$$it.farmer",
              },
            },
            [],
          ],
        },
      },
    },
    {
      $addFields: {
        farmerId: { $arrayElemAt: ["$farmerCandidates", 0] },
        transferDate: {
          $cond: [
            { $eq: ["$payoutStatus", "Transferred"] },
            { $ifNull: ["$payoutAttemptedAt", null] },
            null,
          ],
        },
      },
    },
  ];

  if (farmerObjectId) {
    pipeline.push({ $match: { farmerId: farmerObjectId } });
  }

  if (from || to) {
    const dateMatch = {};
    if (from) dateMatch.$gte = from;
    if (to) dateMatch.$lte = to;
    pipeline.push({ $match: { transferDate: dateMatch } });
  }

  if (overdueOnly) {
    pipeline.push({
      $match: {
        payoutStatus: "Eligible",
        autoSettleAt: { $lte: now },
        status: { $nin: ["cancelled", "rejected", "CANCELLED_BY_FARMER"] },
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "farmerId",
        foreignField: "_id",
        as: "farmer",
      },
    },
    {
      $addFields: {
        farmerName: {
          $ifNull: [{ $arrayElemAt: ["$farmer.name", 0] }, "Unknown Farmer"],
        },
      },
    },
    {
      $project: {
        _id: 0,
        rowId: { $toString: "$_id" },
        farmerId: { $ifNull: [{ $toString: "$farmerId" }, ""] },
        farmerName: 1,
        orderOrSubOrderId: { $toString: "$_id" },
        settlementType: { $literal: "Regular" },
        amountTransferred: { $ifNull: ["$payoutAmount", 0] },
        payoutStatus: 1,
        transferDate: 1,
        autoSettleAt: 1,
        settlementTrigger: {
          $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "auto", ""],
        },
      },
    }
  );

  return pipeline;
};

const getTransparentPipeline = ({
  farmerObjectId,
  status,
  from,
  to,
  overdueOnly,
}) => {
  const now = new Date();
  const match = {
    payoutStatus: { $in: ["Pending", "Eligible", "Transferred", "OnHold"] },
  };
  if (status !== "all") match.payoutStatus = status;
  if (farmerObjectId) match.farmerId = farmerObjectId;

  const pipeline = [
    { $match: match },
    {
      $addFields: {
        transferDate: {
          $cond: [
            { $eq: ["$payoutStatus", "Transferred"] },
            { $ifNull: ["$payoutDate", null] },
            null,
          ],
        },
      },
    },
  ];

  if (from || to) {
    const dateMatch = {};
    if (from) dateMatch.$gte = from;
    if (to) dateMatch.$lte = to;
    pipeline.push({ $match: { transferDate: dateMatch } });
  }

  if (overdueOnly) {
    pipeline.push({
      $match: {
        payoutStatus: "Eligible",
        autoSettleAt: { $lte: now },
        fulfillmentStatus: "Delivered",
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "farmerId",
        foreignField: "_id",
        as: "farmer",
      },
    },
    {
      $addFields: {
        farmerName: {
          $ifNull: [{ $arrayElemAt: ["$farmer.name", 0] }, "Unknown Farmer"],
        },
      },
    },
    {
      $project: {
        _id: 0,
        rowId: { $toString: "$_id" },
        farmerId: { $ifNull: [{ $toString: "$farmerId" }, ""] },
        farmerName: 1,
        orderOrSubOrderId: { $toString: "$_id" },
        settlementType: { $literal: "Transparent" },
        amountTransferred: { $ifNull: ["$payoutAmount", 0] },
        payoutStatus: 1,
        transferDate: 1,
        autoSettleAt: 1,
        settlementTrigger: { $ifNull: ["$settlementTrigger", ""] },
      },
    }
  );

  return pipeline;
};

const getSummaryTotals = async () => {
  const now = new Date();
  const [regular, transparent, overdueRegular, overdueTransparent, lastRun] =
    await Promise.all([
      Order.aggregate([
        {
          $group: {
            _id: null,
            pending: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Pending"] }, "$payoutAmount", 0],
              },
            },
            eligible: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Eligible"] }, "$payoutAmount", 0],
              },
            },
            transferred: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "$payoutAmount", 0],
              },
            },
          },
        },
      ]),
      SubOrder.aggregate([
        {
          $group: {
            _id: null,
            pending: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Pending"] }, "$payoutAmount", 0],
              },
            },
            eligible: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Eligible"] }, "$payoutAmount", 0],
              },
            },
            transferred: {
              $sum: {
                $cond: [{ $eq: ["$payoutStatus", "Transferred"] }, "$payoutAmount", 0],
              },
            },
          },
        },
      ]),
      Order.aggregate([
        {
          $match: {
            payoutStatus: "Eligible",
            autoSettleAt: { $lte: now },
            status: { $nin: ["cancelled", "rejected", "CANCELLED_BY_FARMER"] },
          },
        },
        { $group: { _id: null, amount: { $sum: "$payoutAmount" } } },
      ]),
      SubOrder.aggregate([
        {
          $match: {
            payoutStatus: "Eligible",
            autoSettleAt: { $lte: now },
            fulfillmentStatus: "Delivered",
          },
        },
        { $group: { _id: null, amount: { $sum: "$payoutAmount" } } },
      ]),
      SettlementJobRun.findOne({ status: "success" })
        .sort({ startedAt: -1 })
        .select("jobName source startedAt finishedAt")
        .lean(),
    ]);

  const reg = regular[0] || {};
  const tr = transparent[0] || {};
  return {
    totalPendingAmount: Number(reg.pending || 0) + Number(tr.pending || 0),
    totalEligibleAmount: Number(reg.eligible || 0) + Number(tr.eligible || 0),
    totalTransferredAmount: Number(reg.transferred || 0) + Number(tr.transferred || 0),
    overdueEligibleAmount:
      Number(overdueRegular[0]?.amount || 0) + Number(overdueTransparent[0]?.amount || 0),
    lastSuccessfulSettlementRun: lastRun
      ? {
          jobName: lastRun.jobName || "",
          source: lastRun.source || "",
          startedAt: lastRun.startedAt || null,
          finishedAt: lastRun.finishedAt || null,
        }
      : null,
  };
};

// GET /api/admin/settlements/summary
export const getSettlementSummary = async (req, res) => {
  try {
    const summary = await getSummaryTotals();
    return res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Admin settlement summary error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load settlement summary" });
  }
};

// GET /api/admin/settlements/ledger
export const getSettlementLedger = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const settlementType = normalizeType(req.query.settlementType);
    const status = normalizeStatus(req.query.status);
    const overdueOnly = normalizeOverdueOnly(req.query.overdueOnly);
    const farmerObjectId = toObjectId(req.query.farmerId);
    const from = parseDateStart(req.query.from);
    const to = parseDateEnd(req.query.to);

    const pipelines = [];
    if (settlementType === "all" || settlementType === "regular") {
      pipelines.push(
        Order.aggregate(
          getRegularPipeline({
            farmerObjectId,
            status,
            from,
            to,
            overdueOnly,
          })
        )
      );
    } else {
      pipelines.push(Promise.resolve([]));
    }

    if (settlementType === "all" || settlementType === "transparent") {
      pipelines.push(
        SubOrder.aggregate(
          getTransparentPipeline({
            farmerObjectId,
            status,
            from,
            to,
            overdueOnly,
          })
        )
      );
    } else {
      pipelines.push(Promise.resolve([]));
    }

    const [regularRows, transparentRows, summary] = await Promise.all([
      pipelines[0],
      pipelines[1],
      getSummaryTotals(),
    ]);

    const merged = [...regularRows, ...transparentRows].sort(
      (a, b) => new Date(b.transferDate || 0) - new Date(a.transferDate || 0)
    );
    const total = merged.length;
    const start = (page - 1) * limit;
    const data = merged.slice(start, start + limit);

    return res.json({
      success: true,
      data,
      summary,
      pagination: {
        page,
        limit,
        total,
      },
    });
  } catch (error) {
    console.error("Admin settlement ledger error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load settlement ledger" });
  }
};

// GET /api/admin/settlements/farmer/:farmerId
export const getFarmerSettlementDetails = async (req, res) => {
  try {
    const farmerObjectId = toObjectId(req.params.farmerId);
    if (!farmerObjectId) {
      return res.status(400).json({ success: false, message: "Invalid farmer id" });
    }

    const [farmer, regularRows, transparentRows] = await Promise.all([
      User.findById(farmerObjectId).select("name email").lean(),
      Order.aggregate(
        getRegularPipeline({
          farmerObjectId,
          status: "all",
          from: null,
          to: null,
          overdueOnly: false,
        })
      ),
      SubOrder.aggregate(
        getTransparentPipeline({
          farmerObjectId,
          status: "all",
          from: null,
          to: null,
          overdueOnly: false,
        })
      ),
    ]);

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const timeline = [...regularRows, ...transparentRows].sort(
      (a, b) => new Date(b.transferDate || 0) - new Date(a.transferDate || 0)
    );

    const totalEarnings = timeline.reduce(
      (sum, row) => sum + Number(row.amountTransferred || 0),
      0
    );
    const totalTransferred = timeline
      .filter((row) => row.payoutStatus === "Transferred")
      .reduce((sum, row) => sum + Number(row.amountTransferred || 0), 0);
    const pendingAmount = timeline
      .filter((row) => ["Pending", "Eligible"].includes(row.payoutStatus))
      .reduce((sum, row) => sum + Number(row.amountTransferred || 0), 0);

    return res.json({
      success: true,
      data: {
        farmer: {
          _id: String(farmer._id),
          name: farmer.name || "Unknown Farmer",
          email: farmer.email || "",
        },
        totals: {
          totalEarnings,
          totalTransferred,
          pendingAmount,
        },
        timeline,
      },
    });
  } catch (error) {
    console.error("Admin farmer settlement detail error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to load farmer settlement details" });
  }
};
