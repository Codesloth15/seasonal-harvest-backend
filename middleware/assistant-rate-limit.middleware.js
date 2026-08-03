import { AI_RATE_LIMIT_MAX, AI_RATE_LIMIT_WINDOW_MS } from "../config/env.js";

const DEFAULT_MAX = 10;
const DEFAULT_WINDOW_MS = 60_000;

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const createAssistantRateLimit = ({
  max = positiveInteger(AI_RATE_LIMIT_MAX, DEFAULT_MAX),
  windowMs = positiveInteger(AI_RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS),
  now = Date.now,
} = {}) => {
  const buckets = new Map();

  return (req, res, next) => {
    const key = req.user?.id || req.ip;
    const currentTime = now();
    let bucket = buckets.get(key);

    if (!bucket || currentTime >= bucket.resetAt) {
      bucket = { count: 0, resetAt: currentTime + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))));
      return res.status(429).json({
        success: false,
        error: "Too many AI requests. Please try again later.",
        code: "AI_RATE_LIMITED",
      });
    }

    next();
  };
};

export default createAssistantRateLimit();
