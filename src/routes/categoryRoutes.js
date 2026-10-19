
import express from "express";
import {
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
} from "../controllers/categoryController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

router.get("/", getCategories);

router.post("/", protect, adminOnly, createCategory);
router.patch("/:id", protect, adminOnly, updateCategory);
router.delete("/:id", protect, adminOnly, deleteCategory);

export default router;
