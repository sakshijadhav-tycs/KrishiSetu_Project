export const responseEnvelopeMiddleware = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    if (
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      Object.prototype.hasOwnProperty.call(payload, "success")
    ) {
      const normalized = { ...payload };
      if (typeof normalized.message !== "string") {
        normalized.message = normalized.success ? "OK" : "Request failed";
      }
      if (!Object.prototype.hasOwnProperty.call(normalized, "data")) {
        normalized.data = null;
      }
      return originalJson(normalized);
    }
    return originalJson(payload);
  };

  next();
};
