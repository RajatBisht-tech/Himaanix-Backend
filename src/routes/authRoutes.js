import { Router } from "express";
import { register, login, getProfile, updateProfile } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.get("/me", protect, getProfile);
router.patch("/me", protect, updateProfile);
export default router;
