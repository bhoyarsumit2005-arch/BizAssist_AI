/**
 * JSON-only fallbacks so an unknown route or an unhandled rejection never
 * leaks an HTML error page (or a stack trace) to the client.
 */

export const notFound = (req, res) =>
  res.status(404).json({
    success: false,
    message: "Route not found"
  });

const statusOf = (error) => {
  const explicit = Number(error?.status || error?.statusCode);
  if (Number.isInteger(explicit) && explicit >= 400 && explicit <= 599) return explicit;

  if (error?.type === "entity.parse.failed") return 400;
  if (error?.type === "entity.too.large") return 413;
  if (error?.name === "ValidationError" || error?.name === "CastError") return 400;
  if (error?.code === 11000) return 409;
  if (error?.name === "JsonWebTokenError" || error?.name === "TokenExpiredError") return 401;

  return 500;
};

const messageOf = (error, status) => {
  if (error?.type === "entity.parse.failed") return "Request body must be valid JSON";
  if (error?.type === "entity.too.large") return "Request body is too large";
  if (error?.name === "ValidationError") {
    return Object.values(error.errors || {})
      .map((item) => item.message)
      .filter(Boolean)
      .join(", ") || "Request validation failed";
  }
  if (error?.name === "CastError") return "Invalid identifier";
  if (error?.code === 11000) return "That value is already in use";

  if (status >= 500) {
    return process.env.NODE_ENV === "production"
      ? "Something went wrong"
      : error?.message || "Something went wrong";
  }

  return error?.message || "Request failed";
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const status = statusOf(error);

  if (status >= 500) {
    console.error(`${req.method} ${req.originalUrl} failed:`, error);
  }

  return res.status(status).json({
    success: false,
    message: messageOf(error, status)
  });
};
