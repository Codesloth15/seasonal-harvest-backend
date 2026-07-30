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

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const mapped = POSTGRES_ERROR_MAP[err.code];
  const uploadError = UPLOAD_ERROR_MAP[err.code];
  const statusCode =
    uploadError?.statusCode || mapped?.statusCode || err.statusCode || Number(err.status) || 500;
  // Preserve detailed upstream errors (including Supabase Storage messages)
  // unless a known upload/parser error needs a safer, actionable message.
  const message = uploadError?.message || mapped?.message || err.message || "Server Error";

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.code ? { code: err.code } : {}),
  });
};

export default errorMiddleware;
