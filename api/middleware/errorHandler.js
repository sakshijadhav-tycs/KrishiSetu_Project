import crypto from "crypto";
import { logError } from "../utils/safeLogger.js";

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const requestIdMiddleware = (req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader("x-request-id", req.requestId);
  next();
};

export const notFoundHandler = (req, res, next) => {
  return next(new AppError(`Not Found - ${req.originalUrl}`, 404));
};

export const errorHandler = (err, req, res, _next) => {
  const statusCode =
    Number(err?.statusCode) ||
    (res.statusCode && res.statusCode !== 200 ? res.statusCode : 500);

  logError("API_ERROR", {
    requestId: req.requestId || "",
    method: req.method,
    url: req.originalUrl,
    statusCode,
    message: err?.message || "Unhandled error",
    details: err?.details || null,
    body: req.body || {},
    query: req.query || {},
  });

  return res.status(statusCode).json({
    success: false,
    message: err?.message || "Internal server error",
    data: null,
    meta: {
      requestId: req.requestId || "",
      ...(err?.details ? { details: err.details } : {}),
    },
  });
};
