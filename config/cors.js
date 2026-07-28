import { CORS_ORIGINS } from "./env.js";

export const parseAllowedOrigins = (value) => {
  if (!value || !value.trim()) {
    throw new Error(
      "CORS_ORIGINS is required and must contain a comma-separated list of trusted frontend origins.",
    );
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      if (origin === "*") {
        throw new Error("CORS_ORIGINS cannot contain '*' when credentials are enabled.");
      }

      let url;
      try {
        url = new URL(origin);
      } catch {
        throw new Error(`Invalid CORS origin: ${origin}`);
      }

      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error(`CORS origin must use http or https: ${origin}`);
      }

      if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
        throw new Error(`CORS origin must not contain credentials, a path, query, or fragment: ${origin}`);
      }

      return url.origin;
    });

  if (origins.length === 0) {
    throw new Error("CORS_ORIGINS must contain at least one trusted frontend origin.");
  }

  return [...new Set(origins)];
};

export const allowedOrigins = parseAllowedOrigins(CORS_ORIGINS);

export const corsOptions = {
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"],
  origin(origin, callback) {
    // Requests from server-side clients, health checks, and CLI tools may not
    // include an Origin header. CORS is a browser-enforced control.
    if (!origin) return callback(null, true);

    let requestUrl;
    try {
      requestUrl = new URL(origin);
    } catch {
      const error = new Error("Request origin is invalid.");
      error.statusCode = 403;
      return callback(error);
    }

    if (
      requestUrl.username ||
      requestUrl.password ||
      requestUrl.pathname !== "/" ||
      requestUrl.search ||
      requestUrl.hash ||
      !allowedOrigins.includes(requestUrl.origin)
    ) {
      const error = new Error("Request origin is not allowed.");
      error.statusCode = 403;
      return callback(error);
    }

    return callback(null, true);
  },
};
