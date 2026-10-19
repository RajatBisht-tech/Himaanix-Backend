
import express from "express";
import {
    getCart,
    addToCart,
    updateCartItem,
    removeCartItem,
    clearCart,
} from "../controllers/cartController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", getCart);
router.post("/items", addToCart);
router.patch("/items/:itemId", updateCartItem);
router.delete("/items/:itemId", removeCartItem);
router.delete("/", clearCart);

export default router;
