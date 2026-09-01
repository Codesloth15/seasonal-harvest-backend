const POSTGRES_ERROR_MAP = {
  "23505": { statusCode: 409, message: "A record with the same unique value already exists" },
  "23503": { statusCode: 409, message: "This record is still referenced by another resource" },
  "22P02": { statusCode: 400, message: "Invalid identifier or field value" },
};

const UPLOAD_ERROR_MAP = {
  LIMIT_FILE_SIZE: {
    statusCode: 413,
    message: "Product image must not exceed 5 MB.",
  },
  LIMIT_FILE_COUNT: {
    statusCode: 400,
    message: "Only one product image may be uploaded.",
  },
  LIMIT_UNEXPECTED_FILE: {
    statusCode: 400,
    message: "Upload the product image using the multipart field named 'image'; only one image is allowed.",
  },
  INVALID_PRODUCT_IMAGE_TYPE: {
    statusCode: 400,
    message: "Unsupported product image type. Accepted formats: JPEG, PNG, WebP, and AVIF.",
  },
};

const AI_ERROR_MAP = {
  insufficient_quota: {
    statusCode: 503,
    message: "The AI assistant is temporarily unavailable because its usage quota is exhausted.",
    responseCode: "AI_UNAVAILABLE",
  },
  rate_limit_exceeded: {
    statusCode: 429,
    message: "The AI provider is busy. Please try again later.",
    responseCode: "AI_PROVIDER_RATE_LIMITED",
  },
};

const mapAiProviderError = (error) => {
  if (AI_ERROR_MAP[error.code]) return AI_ERROR_MAP[error.code];
  if (!error.isAiProviderError) return undefined;
  const status = Number(error.status || error.statusCode);
  if (status === 404) {
    return {
      statusCode: 503,
      message: "The configured AI model is unavailable. Please contact an administrator.",
      responseCode: "AI_MODEL_UNAVAILABLE",
    };
  }
  if (status === 429) return AI_ERROR_MAP.rate_limit_exceeded;
  if (status === 403) {
    return {
      statusCode: 503,
      message: "The AI assistant is not available with the configured provider credentials.",
      responseCode: "AI_UNAVAILABLE",
    };
  }
  return undefined;
};

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const mapped = POSTGRES_ERROR_MAP[err.code];
  const uploadError = UPLOAD_ERROR_MAP[err.code];
  const aiError = mapAiProviderError(err);
  const statusCode =
    aiError?.statusCode ||
    uploadError?.statusCode ||
    mapped?.statusCode ||
    err.statusCode ||
    Number(err.status) ||
    500;
  // Preserve detailed upstream errors (including Supabase Storage messages)
  // unless a known upload/parser error needs a safer, actionable message.
  const message = aiError?.message || uploadError?.message || mapped?.message || err.message || "Server Error";
  const responseCode = aiError?.responseCode || err.code;

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(responseCode ? { code: responseCode } : {}),
  });
};

export default errorMiddleware;
