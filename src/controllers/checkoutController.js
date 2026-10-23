import crypto from "crypto";
import Order from "../models/Order.js";
import {
  getAvailablePaymentMethods,
  refreshCashfreePayment,
  refreshPhonePePayment,
  validatePhonePeCallback,
  verifyRazorpayPayment,
} from "../services/checkoutGateway.service.js";

export const getPaymentMethods = (_req, res) =>
  res
    .status(200)
    .json({ success: true, methods: getAvailablePaymentMethods() });

export const verifyRazorpayCheckout = async (req, res, next) => {
  try {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
      req.body || {};
    const order = await Order.findOne({ _id: orderId, user: req.user.id });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    await verifyRazorpayPayment({
      order,
      razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
    return res.status(200).json({ success: true, order });
  } catch (error) {
    if (error.status)
      return res
        .status(error.status)
        .json({ success: false, message: error.message });
    return next(error);
  }
};

export const phonePeReturn = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || order.provider !== "phonepe")
    return res.status(404).send("Order not found");

  try {
    await refreshPhonePePayment(order);
  } catch (error) {
    console.error("PhonePe return status check failed:", error.message);
  }

  const frontend = String(process.env.FRONTEND_URL || "/").replace(/\/+$/, "");
  return res.redirect(`${frontend}/orders/${order._id}/tracking`);
};

export const cashfreeReturn = async (req, res) => {
  const order = await Order.findById(req.params.orderId);
  if (!order || order.provider !== "cashfree")
    return res.status(404).send("Order not found");
  try {
    await refreshCashfreePayment(order);
  } catch (error) {
    console.error("Cashfree return status check failed:", error.message);
  }
  const frontend = String(process.env.FRONTEND_URL || "/").replace(/\/+$/, "");
  return res.redirect(`${frontend}/orders/${order._id}/tracking`);
};

export const phonePeWebhook = async (req, res) => {
  try {
    const callback = validatePhonePeCallback(
      req.get("authorization") || "",
      req.rawBody || JSON.stringify(req.body || {}),
    );
    const orderId = callback?.payload?.orderId;
    const state = String(callback?.payload?.state || "").toUpperCase();
    const order = await Order.findOne({
      provider: "phonepe",
      paymentReference: orderId,
    });
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });

    if (state === "COMPLETED") {
      order.paymentStatus = "paid";
      order.paidAt ||= new Date();
    } else if (["FAILED", "CANCELLED", "EXPIRED"].includes(state)) {
      order.paymentStatus = "failed";
    }
    await order.save();
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("PhonePe webhook validation failed:", error.message);
    return res
      .status(400)
      .json({ success: false, message: "Invalid PhonePe callback" });
  }
};

export const razorpayWebhook = async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.get("x-razorpay-signature") || "";
  const rawBody = req.rawBody || "";
  if (!secret || !rawBody) return res.status(503).json({ success: false });

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const received = Buffer.from(signature);
  if (
    received.length !== Buffer.byteLength(expected) ||
    !crypto.timingSafeEqual(Buffer.from(expected), received)
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid Razorpay webhook signature" });
  }

  const payment = req.body?.payload?.payment?.entity;
  if (req.body?.event === "payment.captured" && payment?.order_id) {
    const order = await Order.findOne({
      provider: "razorpay",
      gatewayOrderId: payment.order_id,
    });
    if (
      order &&
      Number(payment.amount) === Math.round(Number(order.total) * 100)
    ) {
      order.paymentStatus = "paid";
      order.paidAt ||= new Date();
      order.paymentReference = payment.id;
      await order.save();
    }
  }
  return res.status(200).json({ success: true });
};
