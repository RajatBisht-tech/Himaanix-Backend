
import express from "express";
import {
    getProducts,
    getProductTags,
    getProductBySlug,
    createProduct,
    updateProduct,
    deleteProduct,
} from "../controllers/productController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

// Public routes
router.get("/", getProducts);
router.get("/tags", getProductTags);
router.get("/slug/:slug", getProductBySlug);

// Admin routes
router.post("/", protect, adminOnly, createProduct);
router.patch("/:id", protect, adminOnly, updateProduct);
router.delete("/:id", protect, adminOnly, deleteProduct);

export default router;
