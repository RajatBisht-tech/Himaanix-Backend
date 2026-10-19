import express from "express";
import {
    validateCoupon,
    createCoupon,
} from "../controllers/couponController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

router.post("/validate", protect, validateCoupon);
router.post("/", protect, adminOnly, createCoupon);

export default router;