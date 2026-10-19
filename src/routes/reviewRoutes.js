
import express from "express";
import {
    getProductReviews,
    createReview,
    moderateReview,
} from "../controllers/reviewController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

// Public: approved reviews for a product
router.get("/product/:productId", getProductReviews);

// Logged-in user: submit a review
router.post("/product/:productId", protect, createReview);

// Admin: approve or reject a review
router.patch("/:id/moderate", protect, adminOnly, moderateReview);

export default router;
