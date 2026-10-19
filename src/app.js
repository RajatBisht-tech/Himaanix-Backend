
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

app.disable("x-powered-by");

// CORS configuration
const allowedOrigins = [
  "https://himaanix.com",
  "https://www.himaanix.com",
  "http://localhost:5173",
];

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without an Origin header (e.g. Postman/server calls).
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked this origin: ${origin}`)
      );
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

// Body parsers
app.use(express.json({ limit: "1mb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// Root route
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

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Himaanix API is running",
  });
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/reviews", reviewRoutes);

// Error handlers
app.use(notFound);
app.use(errorHandler);

export default app;
