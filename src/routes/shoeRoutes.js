import express from "express";
import {
  archiveShoe,
  createShoe,
  getShoeBySlug,
  getShoes,
  updateShoe,
} from "../controllers/shoeController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

router.get("/:gender", getShoes);
router.get("/:gender/slug/:slug", getShoeBySlug);

router.post("/:gender", protect, adminOnly, createShoe);
router.patch("/:gender/:id", protect, adminOnly, updateShoe);
router.delete("/:gender/:id", protect, adminOnly, archiveShoe);

export default router;
