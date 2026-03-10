const bucketStore = new Map();

const nowMs = () => Date.now();

const cleanExpired = (windowMs) => {
  const threshold = nowMs() - windowMs;
  for (const [key, value] of bucketStore.entries()) {
    if (value.windowStart < threshold) bucketStore.delete(key);
  }
};

export const createRateLimiter = ({
  windowMs = 60 * 1000,
  max = 60,
  keyPrefix = "global",
  keyFn = (req) => req.ip || "unknown",
  message = "Too many requests. Please try again later.",
}) => {
  return (req, res, next) => {
    cleanExpired(windowMs);
    const key = `${keyPrefix}:${keyFn(req)}`;
    const current = bucketStore.get(key);
    const currentTime = nowMs();

    if (!current || current.windowStart + windowMs <= currentTime) {
      bucketStore.set(key, { count: 1, windowStart: currentTime });
      return next();
    }

    if (current.count >= max) {
      return res.status(429).json({
        success: false,
        message,
        data: null,
        meta: {
          retryAfterMs: Math.max(0, current.windowStart + windowMs - currentTime),
        },
      });
    }

    current.count += 1;
    bucketStore.set(key, current);
    return next();
  };
};

export const authRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 100,
  keyPrefix: "auth",
  message: "Too many authentication attempts. Please try again later.",
});

export const paymentRateLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  max: 120,
  keyPrefix: "payment",
  message: "Too many payment requests. Please retry in a few minutes.",
});

export const sensitiveRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 80,
  keyPrefix: "sensitive",
  message: "Too many sensitive operations. Please try again later.",
});
