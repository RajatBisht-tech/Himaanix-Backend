import crypto from "crypto";
import Razorpay from "razorpay";
import { Cashfree, CFEnvironment } from "cashfree-pg";
import { generatePayUPaymentHash } from "../lib/payu.js";
import {
  Env,
  StandardCheckoutClient,
  StandardCheckoutPayRequest,
} from "@phonepe-pg/pg-sdk-node";

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.status = 503;
    throw error;
  }
  return value;
};

const publicBaseUrl = () => {
  return required("PUBLIC_BASE_URL").replace(/\/+$/, "");
};

const phonePePublicBaseUrl = () => {
  const url = publicBaseUrl();
  if (!url.startsWith("https://")) {
    const error = new Error("PUBLIC_BASE_URL must be a public HTTPS URL for PhonePe Checkout");
    error.status = 503;
    throw error;
  }
  return url;
};

const phonePeClient = () => {
  const environment = String(process.env.PHONEPE_ENV || "sandbox").toLowerCase();
  return StandardCheckoutClient.getInstance(
    required("PHONEPE_CLIENT_ID"),
    required("PHONEPE_CLIENT_SECRET"),
    Number(process.env.PHONEPE_CLIENT_VERSION || 1),
    environment === "production" ? Env.PRODUCTION : Env.SANDBOX
  );
};

const razorpayClient = () =>
  new Razorpay({
    key_id: required("RAZORPAY_KEY_ID"),
    key_secret: required("RAZORPAY_KEY_SECRET"),
  });

export const createRazorpayPaymentLink = async ({ keyId, keySecret, amount, referenceId, name, email, mobile, callbackUrl }) => {
  const client = new Razorpay({
    key_id: keyId || required("RAZORPAY_KEY_ID"),
    key_secret: keySecret || required("RAZORPAY_KEY_SECRET"),
  });
  const paymentLink = await client.paymentLink.create({
    amount: Math.round(Number(amount) * 100),
    currency: "INR",
    accept_partial: false,
    reference_id: String(referenceId).slice(0, 40),
    description: `Himaanix order ${String(referenceId).slice(0, 40)}`,
    customer: {
      name: String(name || "Customer").slice(0, 50),
      email: String(email || "").slice(0, 50),
      contact: String(mobile || "").replace(/\D/g, "").slice(-15),
    },
    notify: { sms: false, email: false, whatsapp: false },
    ...(callbackUrl ? { callback_url: callbackUrl, callback_method: "get" } : {}),
  });
  if (!paymentLink?.short_url) throw new Error("Razorpay did not return a payment link");
  return paymentLink;
};

export const fetchRazorpayPaymentLink = async ({ keyId, keySecret, paymentLinkId }) => {
  if (!paymentLinkId) return null;
  const client = new Razorpay({
    key_id: keyId || required("RAZORPAY_KEY_ID"),
    key_secret: keySecret || required("RAZORPAY_KEY_SECRET"),
  });
  return client.paymentLink.fetch(paymentLinkId);
};

export const createCashfreePaymentSession = async ({ appId, secretKey, orderId, amount, customerId, phone, email, returnUrl }) => {
  const client = new Cashfree(
    String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    appId || required("CASHFREE_APP_ID"),
    secretKey || required("CASHFREE_SECRET_KEY")
  );
  const response = await client.PGCreateOrder({
    order_id: String(orderId).slice(0, 45),
    order_amount: Number(amount),
    order_currency: "INR",
    customer_details: {
      customer_id: String(customerId).slice(0, 50),
      customer_phone: String(phone).replace(/\D/g, "").slice(-15),
      customer_email: String(email || "customer@himaanix.local").slice(0, 100),
    },
    order_meta: { return_url: returnUrl },
  });
  const sessionId = response?.data?.payment_session_id;
  if (!sessionId) throw new Error("Cashfree did not return a payment session");
  return { sessionId, gatewayOrderId: String(orderId).slice(0, 45), raw: response.data };
};

export const getAvailablePaymentMethods = () => ({
  cod: true,
  razorpay: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
  // Temporarily paused at product request; retain integration code for later re-enable.
  phonepe: false,
  payu: Boolean(process.env.PAYU_KEY && process.env.PAYU_SALT),
  cashfree: Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY),
});

export const createGatewayCheckout = async (order) => {
  if (order.paymentMethod === "razorpay") {
    const razorpayOrder = await razorpayClient().orders.create({
      amount: Math.round(Number(order.total) * 100),
      currency: "INR",
      receipt: order.orderNumber.slice(0, 40),
      notes: { himaanixOrderId: String(order._id) },
    });

    order.provider = "razorpay";
    order.gatewayOrderId = razorpayOrder.id;
    order.paymentReference = razorpayOrder.id;
    await order.save();

    return {
      provider: "razorpay",
      keyId: required("RAZORPAY_KEY_ID"),
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
    };
  }

  if (order.paymentMethod === "phonepe") {
    const merchantOrderId = `HIM${String(order._id)}`;
    const redirectUrl = `${phonePePublicBaseUrl()}/api/payments/phonepe/return/${order._id}`;
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(Math.round(Number(order.total) * 100))
      .redirectUrl(redirectUrl)
      .build();
    const response = await phonePeClient().pay(request);

    order.provider = "phonepe";
    order.paymentReference = merchantOrderId;
    await order.save();

    return { provider: "phonepe", redirectUrl: response.redirectUrl };
  }

  if (order.paymentMethod === "payu") {
    const txnid = `HIM${String(order._id)}`.slice(0, 25);
    const amount = Number(order.total).toFixed(2);
    const firstname = order.shippingAddress.fullName.split(/\s+/)[0] || "Customer";
    const email = "customer@himaanix.local";
    const callbackUrl = `${publicBaseUrl()}/api/payin/payu-callback`;
    const fields = { key: required("PAYU_KEY"), txnid, amount, productinfo: `Himaanix ${order.orderNumber}`, firstname, email, phone: order.shippingAddress.phone, surl: callbackUrl, furl: callbackUrl };
    fields.hash = generatePayUPaymentHash({ ...fields, salt: required("PAYU_SALT") });
    order.provider = "payu";
    order.transactionId = txnid;
    order.gatewayOrderId = txnid;
    await order.save();
    return { provider: "payu", formAction: process.env.PAYU_ENV === "production" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment", formFields: fields };
  }

  if (order.paymentMethod === "cashfree") {
    const client = new Cashfree(
      String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
      required("CASHFREE_APP_ID"),
      required("CASHFREE_SECRET_KEY")
    );
    const gatewayOrderId = `HIM${String(order._id)}`;
    const response = await client.PGCreateOrder({
      order_id: gatewayOrderId,
      order_amount: Number(order.total),
      order_currency: "INR",
      customer_details: { customer_id: String(order.user), customer_phone: order.shippingAddress.phone, customer_email: "customer@himaanix.local" },
      order_meta: { return_url: `${publicBaseUrl()}/api/payments/cashfree/return/${order._id}` },
    });
    order.provider = "cashfree";
    order.gatewayOrderId = gatewayOrderId;
    await order.save();
    return { provider: "cashfree", paymentSessionId: response.data.payment_session_id, environment: String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() };
  }

  return null;
};

export const verifyRazorpayPayment = async ({ order, razorpayOrderId, paymentId, signature }) => {
  if (order.provider !== "razorpay" || !order.paymentReference) {
    const error = new Error("This is not a Razorpay order");
    error.status = 400;
    throw error;
  }
  if (razorpayOrderId !== order.gatewayOrderId) {
    const error = new Error("Razorpay order reference does not match");
    error.status = 400;
    throw error;
  }

  const expected = crypto
    .createHmac("sha256", required("RAZORPAY_KEY_SECRET"))
    .update(`${razorpayOrderId}|${paymentId}`)
    .digest("hex");
  const received = Buffer.from(signature || "");
  if (received.length !== Buffer.byteLength(expected) || !crypto.timingSafeEqual(Buffer.from(expected), received)) {
    const error = new Error("Invalid Razorpay payment signature");
    error.status = 400;
    throw error;
  }

  const payment = await razorpayClient().payments.fetch(paymentId);
  if (
    payment.order_id !== razorpayOrderId ||
    Number(payment.amount) !== Math.round(Number(order.total) * 100) ||
    payment.status !== "captured"
  ) {
    const error = new Error("Razorpay payment could not be verified as captured");
    error.status = 409;
    throw error;
  }

  order.paymentStatus = "paid";
  order.paidAt = new Date();
  order.paymentReference = paymentId;
  await order.save();
  return order;
};

export const refreshPhonePePayment = async (order) => {
  if (order.provider !== "phonepe" || !order.paymentReference) return order;
  const status = await phonePeClient().getOrderStatus(order.paymentReference);
  const state = String(status.state || "").toUpperCase();

  if (state === "COMPLETED") {
    order.paymentStatus = "paid";
    order.paidAt ||= new Date();
  } else if (["FAILED", "CANCELLED", "EXPIRED"].includes(state)) {
    order.paymentStatus = "failed";
  }
  await order.save();
  return order;
};

export const refreshCashfreePayment = async (order) => {
  if (order.provider !== "cashfree" || !order.gatewayOrderId) return order;
  const client = new Cashfree(
    String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX,
    required("CASHFREE_APP_ID"),
    required("CASHFREE_SECRET_KEY")
  );
  const response = await client.PGFetchOrder(order.gatewayOrderId);
  const state = String(response.data?.order_status || "").toUpperCase();
  if (state === "PAID") { order.paymentStatus = "paid"; order.paidAt ||= new Date(); }
  else if (["EXPIRED", "TERMINATED", "FAILED"].includes(state)) order.paymentStatus = "failed";
  await order.save();
  return order;
};

export const validatePhonePeCallback = (authorization, rawBody) =>
  phonePeClient().validateCallback(
    required("PHONEPE_WEBHOOK_USERNAME"),
    required("PHONEPE_WEBHOOK_PASSWORD"),
    authorization,
    rawBody
  );
