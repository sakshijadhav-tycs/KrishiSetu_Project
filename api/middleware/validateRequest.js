import { ZodError } from "zod";
import { AppError } from "./errorHandler.js";

const applyValidation = (schema, value, label) => {
  if (!schema) return value;
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    throw new AppError(`Invalid ${label}`, 400, { issues });
  }
  return parsed.data;
};

export const validateRequest = ({ body, params, query } = {}) => (req, _res, next) => {
  try {
    if (body) req.body = applyValidation(body, req.body || {}, "request body");
    if (params) req.params = applyValidation(params, req.params || {}, "request params");
    if (query) req.query = applyValidation(query, req.query || {}, "request query");
    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      return next(new AppError("Validation failed", 400, { issues: error.issues }));
    }
    return next(error);
  }
};
