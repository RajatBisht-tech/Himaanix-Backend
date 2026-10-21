import { Router } from "express";
import {
  createPayinOrder,
  checkPayinStatus,
  handlePayUCallback,
  getPayUCallback,
  getPayinOrders,
} from "../controllers/payinController.js";

const router = Router();

router.post("/create-order", createPayinOrder);
router.post("/check-status", checkPayinStatus);
router.post("/payu-callback", handlePayUCallback);
router.get("/payu-callback", getPayUCallback);
router.get("/orders", getPayinOrders);

export default router;
