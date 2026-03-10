import os from "os";
import SettlementLock from "../models/SettlementLockModel.js";
import SettlementJobRun from "../models/SettlementJobRunModel.js";

const DEFAULT_LOCK_TTL_MS = 4 * 60 * 1000;

const buildOwner = () =>
  `${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;

const toIso = (value) => {
  try {
    return new Date(value).toISOString();
  } catch {
    return "";
  }
};

export const withSettlementJobLock = async ({
  lockName,
  ttlMs = DEFAULT_LOCK_TTL_MS,
  owner = buildOwner(),
  fn,
}) => {
  const now = new Date();
  const nextExpiry = new Date(now.getTime() + Number(ttlMs || DEFAULT_LOCK_TTL_MS));

  let lock = null;
  try {
    lock = await SettlementLock.findOneAndUpdate(
      {
        lockName,
        $or: [{ lockedUntil: { $lte: now } }, { owner }],
      },
      {
        $set: {
          owner,
          lockedUntil: nextExpiry,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    if (error?.code === 11000) {
      return { locked: false, owner, lockName };
    }
    throw error;
  }

  if (!lock || lock.owner !== owner) {
    return { locked: false, owner, lockName };
  }

  try {
    const result = await fn({
      owner,
      extend: async () => {
        const renewedUntil = new Date(Date.now() + Number(ttlMs || DEFAULT_LOCK_TTL_MS));
        await SettlementLock.updateOne(
          { lockName, owner },
          { $set: { lockedUntil: renewedUntil } }
        );
      },
    });
    return { locked: true, owner, lockName, result };
  } finally {
    await SettlementLock.deleteOne({ lockName, owner });
  }
};

export const executeSettlementJob = async ({
  jobName,
  source = "",
  lockName,
  ttlMs = DEFAULT_LOCK_TTL_MS,
  run,
}) => {
  const startedAt = new Date();
  const runDoc = await SettlementJobRun.create({
    jobName,
    source,
    startedAt,
    status: "running",
  });

  const finalized = async (patch = {}) => {
    const finishedAt = new Date();
    const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
    await SettlementJobRun.findByIdAndUpdate(runDoc._id, {
      $set: {
        finishedAt,
        durationMs,
        ...patch,
      },
    });
  };

  try {
    const lockResult = await withSettlementJobLock({
      lockName,
      ttlMs,
      fn: run,
    });

    if (!lockResult.locked) {
      await finalized({
        status: "skipped_locked",
        metadata: {
          lockName,
          skippedAtUtc: toIso(new Date()),
        },
      });
      return {
        locked: false,
        skipped: true,
        reason: "lock_not_acquired",
      };
    }

    const result = lockResult.result || {};
    await finalized({
      status: "success",
      scanned: Number(result.scanned || 0),
      promoted: Number(result.promoted || 0),
      transferred: Number(result.transferred || 0),
      skipped: Number(result.skipped || 0),
      overdueEligibleCount: Number(result.overdueEligibleCount || 0),
      overdueEligibleAmount: Number(result.overdueEligibleAmount || 0),
      skippedReasons: result.skippedReasons || {},
      metadata: result.metadata || {},
    });

    return {
      locked: true,
      skipped: false,
      ...result,
    };
  } catch (error) {
    await finalized({
      status: "failed",
      errorMessage: String(error?.message || "Settlement job failed"),
    });
    throw error;
  }
};
