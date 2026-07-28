const POSTGRES_ERROR_MAP = {
  "23505": { statusCode: 409, message: "A record with the same unique value already exists" },
  "23503": { statusCode: 409, message: "This record is still referenced by another resource" },
  "22P02": { statusCode: 400, message: "Invalid identifier or field value" },
};

const errorMiddleware = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  const mapped = POSTGRES_ERROR_MAP[err.code];
  const statusCode = mapped?.statusCode || err.statusCode || Number(err.status) || 500;
  const message = mapped?.message || err.message || "Server Error";

  if (statusCode >= 500) {
    console.error(err);
  }

  return res.status(statusCode).json({ success: false, error: message });
};

export default errorMiddleware;
