export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  console.error(err);

  if (err.name === "ValidationError") {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ success: false, message: "Invalid resource ID" });
  }
  if (err.code === 11000) {
    return res.status(409).json({ success: false, message: "A record with this value already exists" });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === "production" ? "Internal server error" : (err.message || "Internal server error")
  });
};
