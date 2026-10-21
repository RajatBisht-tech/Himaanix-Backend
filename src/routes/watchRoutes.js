import express from "express";
import {
  archiveWatch,
  createWatch,
  getWatchBySlug,
  getWatches,
  updateWatch,
} from "../controllers/watchController.js";
import { protect } from "../middleware/auth.js";
import { adminOnly } from "../middleware/admin.js";

const router = express.Router();

router.get("/:gender", getWatches);
router.get("/:gender/slug/:slug", getWatchBySlug);

router.post("/:gender", protect, adminOnly, createWatch);
router.patch("/:gender/:id", protect, adminOnly, updateWatch);
router.delete("/:gender/:id", protect, adminOnly, archiveWatch);

export default router;
