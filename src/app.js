
import express from "express";
import cors from "cors";
import connectDB from "./config/database.js";
import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import shoeRoutes from "./routes/shoeRoutes.js";
import watchRoutes from "./routes/watchRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

import {
  notFound,
} from "./middleware/errorHandler.js";

const app = express();

// ---------------------------------------------
// SECURITY
// ---------------------------------------------

app.disable("x-powered-by");

// ---------------------------------------------
// CORS - ALLOW ALL ORIGINS
// ---------------------------------------------

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
    optionsSuccessStatus: 204,
  })
);

// ---------------------------------------------
// REQUEST LOGGING
// ---------------------------------------------

app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`
  );
  next();
});

// ---------------------------------------------
// BODY PARSERS
// ---------------------------------------------

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// ---------------------------------------------
// ROOT ROUTE
// ---------------------------------------------


app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    console.error("MongoDB connection failed:", {
      name: error.name,
      message: error.message,
      reason: error.reason?.message,
      code: error.code,
    });

    return res.status(503).json({
      success: false,
      message: "Database unavailable. Please try again later.",
    });
  }
});


app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Himaanix Backend API is running successfully",
    health: "/api/health",
    endpoints: [
      "/api/auth",
      "/api/products",
      "/api/categories",
      "/api/shoes",
      "/api/watches",
      "/api/cart",
      "/api/orders",
      "/api/coupons",
      "/api/reviews",
    ],
  });
});

// ---------------------------------------------
// HEALTH CHECK
// ---------------------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Himaanix API is running",
  });
});

// ---------------------------------------------
// API ROUTES
// ---------------------------------------------

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/shoes", shoeRoutes);
app.use("/api/watches", watchRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);

// ---------------------------------------------
// 404 HANDLER
// ---------------------------------------------

app.use(notFound);

// ---------------------------------------------
// GLOBAL ERROR HANDLER
// ---------------------------------------------

app.use((err, req, res, next) => {
  console.error("API Error:", {
    method: req.method,
    url: req.originalUrl,
    message: err.message,
    stack: err.stack,
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode =
    err.statusCode || err.status || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : err.message || "Internal server error",
  });
});

export default app;