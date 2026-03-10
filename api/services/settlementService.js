import Order from "../models/OrderModel.js";
import { executeSettlementJob } from "./settlementReliabilityService.js";

const toIso = (value) => {
  try {
    return new Date(value).toISOString();
  } catch {
    return "";
  }
};

const isTerminalOrderStatus = (status = "") => {
  const s = String(status || "").toLowerCase().trim();
  return ["cancelled", "cancelled_by_farmer", "rejected"].includes(s);
};

export const evaluateEligibility = (order, now = new Date()) => {
  if (!order) return { canPromote: false, canTransfer: false, reason: "order_missing" };
  if (isTerminalOrderStatus(order.status)) {
    return { canPromote: false, canTransfer: false, reason: "terminal_order_status" };
  }

  const payoutStatus = String(order.payoutStatus || "").trim();
  const autoSettleAt = order.autoSettleAt ? new Date(order.autoSettleAt) : null;
  const dueForSettlement = autoSettleAt && autoSettleAt <= now;

  return {
    canPromote: payoutStatus === "Pending" && Boolean(dueForSettlement),
    canTransfer: payoutStatus === "Eligible" && Boolean(dueForSettlement),
    reason: dueForSettlement ? "due" : "not_due",
  };
};

export const promoteToEligible = async (order, now = new Date()) => {
  const eligibility = evaluateEligibility(order, now);
  if (!eligibility.canPromote) return { updated: false, order };
  order.payoutStatus = "Eligible";
  order.payoutError = "";
  await order.save();
  return { updated: true, order };
};

export const executeProviderPayout = async (order) => {
  // Placeholder for provider payout integration.
  return {
    success: true,
    providerPayoutId: order?.providerPayoutId || "",
    error: "",
  };
};

export const markTransferred = async (order, now = new Date()) => {
  const eligibility = evaluateEligibility(order, now);
  if (!eligibility.canTransfer) return { updated: false, order };

  const payoutResult = await executeProviderPayout(order);
  order.payoutAttemptedAt = now;

  if (!payoutResult.success) {
    order.payoutError = payoutResult.error || "Provider payout failed";
    await order.save();
    return { updated: false, order, error: order.payoutError };
  }

  order.providerPayoutId = payoutResult.providerPayoutId || order.providerPayoutId || "";
  order.payoutStatus = "Transferred";
  order.payoutError = "";
  await order.save();
  return { updated: true, order };
};

export const runRegularSettlementSweep = async (now = new Date(), options = {}) => {
  const source = String(options?.source || "service");
  return executeSettlementJob({
    jobName: "regular_settlement_sweep",
    source,
    lockName: "regular_settlement_sweep",
    ttlMs: 4 * 60 * 1000,
    run: async () => {
      const candidates = await Order.find({
        payoutStatus: { $in: ["Pending", "Eligible"] },
        autoSettleAt: { $lte: now },
        status: { $nin: ["cancelled", "rejected", "CANCELLED_BY_FARMER"] },
      });

      let promoted = 0;
      let transferred = 0;
      let skipped = 0;
      const skippedReasons = {
        transfer_not_updated: 0,
      };

      for (const order of candidates) {
        if (order.payoutStatus === "Pending") {
          const promotedResult = await promoteToEligible(order, now);
          if (promotedResult.updated) promoted += 1;
        }

        if (order.payoutStatus === "Eligible") {
          const transferredResult = await markTransferred(order, now);
          if (transferredResult.updated) transferred += 1;
          if (!transferredResult.updated) {
            skipped += 1;
            skippedReasons.transfer_not_updated += 1;
          }
        }
      }

      const [overdue] = await Order.aggregate([
        {
          $match: {
            payoutStatus: "Eligible",
            autoSettleAt: { $lte: now },
            status: { $nin: ["cancelled", "rejected", "CANCELLED_BY_FARMER"] },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            amount: { $sum: "$payoutAmount" },
          },
        },
      ]);

      return {
        scanned: candidates.length,
        promoted,
        transferred,
        skipped,
        skippedReasons,
        overdueEligibleCount: Number(overdue?.count || 0),
        overdueEligibleAmount: Number(overdue?.amount || 0),
        executedAt: now,
        metadata: {
          nowUtc: toIso(now),
          timezoneOffsetMinutes: now.getTimezoneOffset(),
        },
      };
    },
  });
};
