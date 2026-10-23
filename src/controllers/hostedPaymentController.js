const PAYMENT_PATH = /^\/pay(?:\/|$)/;

import connectDB from "../config/database.js";
import Order from "../models/Order.js";
import { refreshCashfreePayment } from "../services/checkoutGateway.service.js";

function payinBackendOrigin() {
  const value = String(
    process.env.PAYIN_BACKEND_API_ORIGIN || "http://localhost:8001"
  ).trim().replace(/\/+$/, "");

  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/") {
      throw new Error("invalid origin");
    }
    return url.origin;
  } catch (_) {
    const error = new Error("PAYIN_BACKEND_API_ORIGIN must be an HTTP(S) origin without a path");
    error.status = 503;
    throw error;
  }
}

// Keep the storefront host in merchant-facing links while Payin-Backend remains
// the authority for the hosted page, status polling, receipts, and redirects.
export async function proxyHostedPayment(req, res, next) {
  try {
    const path = req.originalUrl || req.url || "";
    if (!PAYMENT_PATH.test(path)) return res.status(404).end();

    const upstream = `${payinBackendOrigin()}${path}`;
    const method = req.method.toUpperCase();
    const hasBody = !["GET", "HEAD"].includes(method);
    const response = await fetch(upstream, {
      method,
      headers: {
        accept: req.get("accept") || "*/*",
        ...(hasBody && req.get("content-type") ? { "content-type": req.get("content-type") } : {}),
        "user-agent": req.get("user-agent") || "Himaanix-Hosted-Payment-Proxy",
        // The browser speaks to the Himaanix link; the trusted server-side
        // proxy performs the same-origin request against Payin Backend.
        ...(hasBody ? { origin: payinBackendOrigin() } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(req.body || {}) } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });

    const passthroughHeaders = ["cache-control", "content-type", "content-disposition"];
    for (const header of passthroughHeaders) {
      const value = response.headers.get(header);
      if (value) res.set(header, value);
    }

    const location = response.headers.get("location");
    if (location && response.status >= 300 && response.status < 400) {
      return res.redirect(response.status, location);
    }

    return res.status(response.status).send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    return next(error);
  }
}

// Cashfree Checkout is opened from its signed payment-session ID through the
// official JS SDK. This lets the public Himaanix link remain stable instead of
// exposing a provider-specific URL to the merchant.
export async function renderCashfreeHostedCheckout(req, res, next) {
  try {
    await connectDB();
    const order = await Order.findOne({ orderId: String(req.params.transactionId), provider: "cashfree" });
    if (!order || !order.paymentReference) return next();

    if (req.query.cashfree_return === "1") await refreshCashfreePayment(order);
    if (order.paymentStatus !== "pending") return next();

    const mode = String(process.env.CASHFREE_ENV || "sandbox").toLowerCase() === "production" ? "production" : "sandbox";
    const session = JSON.stringify(order.paymentReference).replace(/</g, "\\u003c");
    return res.status(200).type("html").send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Redirecting to Cashfree</title><script src="https://sdk.cashfree.com/js/v3/cashfree.js"></script></head><body><p>Opening secure Cashfree checkout…</p><script>Cashfree({mode:${JSON.stringify(mode)}}).checkout({paymentSessionId:${session},redirectTarget:"_self"});</script></body></html>`);
  } catch (error) {
    return next(error);
  }
}
