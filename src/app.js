
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
import payinRoutes from "./routes/payinRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import { proxyHostedPayment, renderCashfreeHostedCheckout } from "./controllers/hostedPaymentController.js";

import {
  notFound,
} from "./middleware/errorHandler.js";

const app = express();

// ---------------------------------------------
// SECURITY
// ---------------------------------------------

app.disable("x-powered-by");

// ---------------------------------------------
// CORS
// ---------------------------------------------

const corsOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header (for example, curl and health checks).
      if (!origin || corsOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
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

app.use(express.json({
  limit: "1mb",
  verify: (req, _res, buffer) => {
    req.rawBody = buffer.toString("utf8");
  },
}));

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

// Merchant-facing links generated for a Himaanix gateway use this host, for
// example http://localhost:5000/pay/SE....  The Payin service owns the actual
// hosted page and provider redirect, so proxy the complete /pay surface.
app.get("/pay/:transactionId", renderCashfreeHostedCheckout);
app.use("/pay", proxyHostedPayment);

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
app.use("/api/payments", checkoutRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/v1/payin", payinRoutes);
app.use("/api/payin", payinRoutes);

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
