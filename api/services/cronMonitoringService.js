import CronRunMeta from "../models/CronRunMetaModel.js";
import { logError } from "../utils/safeLogger.js";

const toSafeFailureReason = (error) => {
  const reason = String(error?.message || "Unknown cron failure");
  return reason.slice(0, 500);
};

export const recordCronRunMeta = async ({
  jobName,
  source = "",
  status,
  startedAt,
  finishedAt,
  metadata = null,
  failureReason = "",
}) => {
  const durationMs = Math.max(0, finishedAt.getTime() - startedAt.getTime());
  try {
    await CronRunMeta.create({
      jobName,
      source,
      status,
      startedAt,
      finishedAt,
      durationMs,
      failureReason,
      metadata,
    });
  } catch (error) {
    logError("CRON_MONITOR_META_WRITE_FAILED", {
      jobName,
      source,
      status,
      failureReason: toSafeFailureReason(error),
    });
  }
};

export const runMonitoredCronJob = async ({
  jobName,
  source = "",
  run,
  metadataFromResult = (result) => result?.metadata || null,
}) => {
  const startedAt = new Date();
  try {
    const result = await run();
    const finishedAt = new Date();
    await recordCronRunMeta({
      jobName,
      source,
      status: "success",
      startedAt,
      finishedAt,
      metadata: metadataFromResult(result),
    });
    return result;
  } catch (error) {
    const finishedAt = new Date();
    await recordCronRunMeta({
      jobName,
      source,
      status: "failed",
      startedAt,
      finishedAt,
      failureReason: toSafeFailureReason(error),
    });
    throw error;
  }
};
