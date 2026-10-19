
import express from "express";
import {
    getMyOrders,
    getOrderById,
    getOrderTracking,
    getAllOrders,
    updateOrderStatus,
    createOrder,
} from "../controllers/orderController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

// Customer routes
router.get("/my-orders", protect, getMyOrders);
router.get("/:id/tracking", protect, getOrderTracking);
router.get("/:id", protect, getOrderById);
router.post("/", protect, createOrder);

// Admin routes
router.get("/", protect, adminOnly, getAllOrders);
router.patch("/:id/status", protect, adminOnly, updateOrderStatus);

export default router;
