import { Router } from "express";
import { cashfreeReturn, getPaymentMethods, phonePeReturn, phonePeWebhook, razorpayWebhook, verifyRazorpayCheckout } from "../controllers/checkoutController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/methods", getPaymentMethods);
router.post("/razorpay/verify", protect, verifyRazorpayCheckout);
router.post("/razorpay/webhook", razorpayWebhook);
router.get("/phonepe/return/:orderId", phonePeReturn);
router.get("/cashfree/return/:orderId", cashfreeReturn);
router.post("/phonepe/webhook", phonePeWebhook);

export default router;
