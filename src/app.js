
import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import couponRoutes from "./routes/couponRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";

import {
  notFound,
  errorHandler,
} from "./middleware/errorHandler.js";

const app = express();

// ---------------------------------------------
// CORS CONFIGURATION
// ---------------------------------------------

const allowedOrigins = (
  process.env.FRONTEND_URL ||
  "http://localhost:5173,https://himaanix.com,https://www.himaanix.com"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.disable("x-powered-by");

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header.
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`Origin not allowed by CORS: ${origin}`)
      );
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
  })
);

// ---------------------------------------------
// BODY PARSERS
// ---------------------------------------------

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ---------------------------------------------
// ROOT ROUTE
// ---------------------------------------------

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Himaanix Backend API is running successfully",
    health: "/api/health",
    endpoints: [
      "/api/auth",
      "/api/products",
      "/api/categories",
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

app.use(errorHandler);

export default app;
