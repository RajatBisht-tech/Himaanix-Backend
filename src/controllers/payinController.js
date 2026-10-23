import crypto from "crypto";
import Order from "../models/Order.js";
import {
  createPayUIntent,
  verifyPayUPayment,
  verifyPayUCallbackHash,
} from "../lib/payu.js";
import { synthesizeStorefrontCart } from "../lib/cartSynthesizer.js";
import {
  createCashfreePaymentSession,
  createRazorpayPaymentLink,
  fetchRazorpayPaymentLink,
  refreshCashfreePayment,
} from "../services/checkoutGateway.service.js";

function getBearerToken(req) {
  const auth = req.headers["authorization"] || "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

function makeOrderId() {
  return `HP${Date.now()}${crypto.randomBytes(4).toString("hex")}`;
}

const formatOrderNumber = (orderId, date = new Date()) => {
  const d = date.toISOString().slice(0, 10).replace(/-/g, "");
  return `HIM-${d}-${String(orderId).slice(-8).toUpperCase()}`;
};

/**
 * POST /api/v1/payin/create-order
 * MoR Bridge endpoint for SuryaPe to create an order on Himaanix
 */
export async function createPayinOrder(req, res) {
  try {
    // Keep compatibility with the existing Himaanix deployment variable while
    // allowing the shared PAYIN_API_TOKEN convention used by other storefronts.
    const expectedToken = process.env.PAYIN_API_TOKEN || process.env.HIMAANIX_API_TOKEN;
    const token = getBearerToken(req);

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({
        status: "error",
        error: "Unauthorized",
      });
    }

    const {
      order_id,
      amount,
      name,
      email,
      mobile,
      productinfo = "Himaanix E-Commerce Purchase",
      customer_ip,
      device_info,
      expiry_seconds = 1800,
      provider = "payu",
      gateway_key,
      gateway_salt,
      gateway_credential_provider,
      merchant_vpa,
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        status: "error",
        error: "amount must be greater than 0",
      });
    }

    if (!name || !email || !mobile) {
      return res.status(400).json({
        status: "error",
        error: "name, email and mobile are required",
      });
    }

    const finalOrderId = String(order_id || makeOrderId());
    // PayU txnId max length is 25 chars
    const transactionId = `HP${Date.now()}${crypto.randomBytes(4).toString("hex")}`.slice(0, 25);

    // Duplicate check
    const existing = await Order.findOne({ orderId: finalOrderId });
    if (existing) {
      return res.status(409).json({
        status: "error",
        error: "order_id already exists",
      });
    }

    const [firstName, ...lastParts] = String(name).trim().split(/\s+/);
    const lastName = lastParts.join(" ") || "Customer";
    const customerEmail = String(email).trim().toLowerCase();
    const customerMobile = String(mobile).trim();

    const baseUrl = String(
      process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 5000}`
    ).replace(/\/+$/, "");

    const callbackUrl = `${baseUrl}/api/payin/payu-callback`;
    const requestedProvider = String(provider || "payu").toLowerCase().trim();
    const credentialProvider = String(gateway_credential_provider || "").toLowerCase().trim();
    const credentialsMatchProvider = !credentialProvider || credentialProvider === requestedProvider;
    const providerKey = credentialsMatchProvider ? gateway_key : undefined;
    const providerSalt = credentialsMatchProvider ? gateway_salt : undefined;

    if (["phonepe", "ccavenue"].includes(requestedProvider)) {
      return res.status(501).json({
        status: "error",
        error: `${requestedProvider === "phonepe" ? "PhonePe" : "CCAvenue"} Payin bridge is not enabled for Himaanix yet`,
      });
    }
    if (!["payu", "razorpay", "cashfree"].includes(requestedProvider)) {
      return res.status(400).json({ status: "error", error: "Unsupported payment provider" });
    }

    // Synthesize authentic cart items and shipping info
    const cart = await synthesizeStorefrontCart({
      amount: numericAmount,
      customer: { name, mobile: customerMobile, email: customerEmail },
    });

    const createProviderOrder = (extra = {}) => Order.create({
      orderId: finalOrderId,
      transactionId,
      orderNumber: formatOrderNumber(finalOrderId, new Date()),
      orderSource: "gateway",
      customer: {
        name: String(name).trim(), firstName, lastName, email: customerEmail, phone: customerMobile,
        ip: customer_ip || req.ip || "127.0.0.1", deviceInfo: device_info || req.headers["user-agent"] || "",
      },
      items: cart.items, shippingAddress: cart.shippingAddress,
      subtotal: numericAmount, discount: 0, shippingFee: 0, total: numericAmount,
      status: "pending", paymentStatus: "pending",
      gatewayKey: providerKey || null, gatewaySalt: providerSalt || null,
      ...extra,
    });

    if (requestedProvider === "razorpay") {
      try {
        const link = await createRazorpayPaymentLink({
          keyId: providerKey, keySecret: providerSalt, amount: numericAmount,
          referenceId: transactionId, name: `${firstName} ${lastName}`.trim(), email: customerEmail, mobile: customerMobile,
          callbackUrl: `${baseUrl}/pay/${encodeURIComponent(finalOrderId)}`,
        });
        await createProviderOrder({
          paymentMethod: "razorpay_dynamic_link", provider: "razorpay",
          gatewayOrderId: link.id, paymentReference: link.id, payuResponse: link,
        });
        return res.status(200).json({ status: "success", data: {
          transaction_id: transactionId, order_id: finalOrderId, amount: numericAmount, currency: "INR",
          payment_status: "pending", payment_id: link.id, checkout_url: link.short_url,
          deep_link: link.short_url, intent_data: link.short_url, expires_in: Number(expiry_seconds) || 1800,
        }, error: null });
      } catch (error) {
        return res.status(502).json({ status: "error", error: error.message || "Failed to create Razorpay payment link" });
      }
    }

    if (requestedProvider === "cashfree") {
      try {
        const gatewayOrderId = `HIM${transactionId}`.slice(0, 45);
        const cashfree = await createCashfreePaymentSession({
          appId: providerKey, secretKey: providerSalt, orderId: gatewayOrderId, amount: numericAmount,
          customerId: finalOrderId, phone: customerMobile, email: customerEmail,
          returnUrl: `${baseUrl}/pay/${encodeURIComponent(finalOrderId)}?cashfree_return=1`,
        });
        await createProviderOrder({
          paymentMethod: "cashfree_dynamic_checkout", provider: "cashfree",
          gatewayOrderId: cashfree.gatewayOrderId, paymentReference: cashfree.sessionId, payuResponse: cashfree.raw,
        });
        return res.status(200).json({ status: "success", data: {
          transaction_id: transactionId, order_id: finalOrderId, amount: numericAmount, currency: "INR",
          payment_status: "pending", payment_id: cashfree.gatewayOrderId,
          // The signed session is consumed only by Himaanix's /pay/:transactionId page.
          deep_link: `cashfree:${cashfree.gatewayOrderId}`, intent_data: cashfree.sessionId,
          expires_in: Number(expiry_seconds) || 1800,
        }, error: null });
      } catch (error) {
        return res.status(502).json({ status: "error", error: error.message || "Failed to create Cashfree checkout" });
      }
    }

    // Invoke PayU S2S Intent
    let payuResult;
    try {
      payuResult = await createPayUIntent({
        txnid: transactionId,
        amount: numericAmount,
        productinfo: String(productinfo || "Himaanix Purchase").slice(0, 255),
        firstname: firstName || "Customer",
        email: customerEmail,
        phone: customerMobile,
        successUrl: callbackUrl,
        failureUrl: callbackUrl,
        clientIp: customer_ip || req.ip || "127.0.0.1",
        deviceInfo: device_info || req.headers["user-agent"] || "Himaanix-Payin",
        key: providerKey || process.env.PAYU_KEY,
        salt: providerSalt || process.env.PAYU_SALT,
      });
    } catch (payuErr) {
      console.error("[Himaanix PayU] Intent creation error:", payuErr);
      return res.status(payuErr.code === "PAYMENT_PROVIDER_RATE_LIMITED" ? 429 : 502).json({
        status: "error",
        error: payuErr.message || "Failed to initiate PayU payment",
        code: payuErr.code || "PAYMENT_GATEWAY_ERROR",
      });
    }

    // Persist order in Himaanix DB
    const now = new Date();
    const order = await Order.create({
      orderId: finalOrderId,
      transactionId,
      orderNumber: formatOrderNumber(finalOrderId, now),
      orderSource: "gateway",
      customer: {
        name: String(name).trim(),
        firstName,
        lastName,
        email: customerEmail,
        phone: customerMobile,
        ip: customer_ip || req.ip || "127.0.0.1",
        deviceInfo: device_info || req.headers["user-agent"] || "",
      },
      items: cart.items,
      shippingAddress: cart.shippingAddress,
      subtotal: numericAmount,
      discount: 0,
      shippingFee: 0,
      total: numericAmount,
      status: "pending",
      paymentMethod: "payu_dynamic_qr",
      paymentStatus: "pending",
      provider: "payu",
      payuTxnId: transactionId,
      payuPaymentId: payuResult.paymentId || null,
      payuMerchantVpa: payuResult.merchantVpa || merchant_vpa || null,
      payuQrString: payuResult.intentUri || null,
      payuKey: providerKey || process.env.PAYU_KEY || null,
      payuSalt: providerSalt || process.env.PAYU_SALT || null,
      payuResponse: payuResult.raw || null,
      upiIntent: payuResult.intentUri,
      upiString: payuResult.intentUri,
      gatewayKey: providerKey || process.env.PAYU_KEY || null,
      gatewaySalt: providerSalt || process.env.PAYU_SALT || null,
      merchantVpa: merchant_vpa || payuResult.merchantVpa || null,
    });

    return res.status(200).json({
      status: "success",
      data: {
        transaction_id: transactionId,
        order_id: finalOrderId,
        amount: numericAmount,
        currency: "INR",
        payment_status: "pending",
        payment_id: payuResult.paymentId || transactionId,
        merchant_vpa: payuResult.merchantVpa || merchant_vpa || "himaanix@axisbank",
        merchant_name: payuResult.merchantName || "Himaanix",
        deep_link: payuResult.intentUri,
        upi_intent: payuResult.intentUri,
        qr_string: payuResult.intentUri,
        intent_data: payuResult.intentURIData,
        expires_in: Number(expiry_seconds) || 1800,
      },
      error: null,
    });
  } catch (error) {
    console.error("[Himaanix] createPayinOrder unexpected error:", error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Internal server error during order creation",
    });
  }
}

/**
 * POST /api/v1/payin/check-status
 * Status check endpoint for SuryaPe durable reconciliation
 */
export async function checkPayinStatus(req, res) {
  try {
    const expectedToken = process.env.PAYIN_API_TOKEN || process.env.HIMAANIX_API_TOKEN;
    const token = getBearerToken(req);

    if (!expectedToken || token !== expectedToken) {
      return res.status(401).json({
        status: "error",
        error: "Unauthorized",
      });
    }

    const { order_id } = req.body || {};
    if (!order_id) {
      return res.status(400).json({
        status: "error",
        error: "order_id is required",
      });
    }

    const order = await Order.findOne({
      $or: [{ orderId: String(order_id) }, { transactionId: String(order_id) }],
    });

    if (!order) {
      return res.status(404).json({
        status: "error",
        error: "Order not found",
      });
    }

    // Reconcile the selected provider server-side. A browser return is never
    // considered proof of payment.
    if (order.paymentStatus !== "paid" && order.provider === "cashfree") {
      try {
        await refreshCashfreePayment(order);
      } catch (error) {
        console.warn("[Himaanix] Cashfree status query failed:", error.message);
      }
    } else if (order.paymentStatus !== "paid" && order.provider === "razorpay" && order.paymentReference) {
      try {
        const link = await fetchRazorpayPaymentLink({
          keyId: order.gatewayKey || undefined,
          keySecret: order.gatewaySalt || undefined,
          paymentLinkId: order.paymentReference,
        });
        const state = String(link?.status || "").toLowerCase();
        if (state === "paid") {
          order.paymentStatus = "paid";
          order.paidAt ||= new Date();
          order.payuResponse = link;
          await order.save();
        } else if (["cancelled", "expired", "failed"].includes(state)) {
          order.paymentStatus = "failed";
          order.payuResponse = link;
          await order.save();
        }
      } catch (error) {
        console.warn("[Himaanix] Razorpay payment-link status query failed:", error.message);
      }
    } else if (order.paymentStatus !== "paid" && order.transactionId) {
      try {
        const verifyRes = await verifyPayUPayment(order.transactionId, {
          key: order.gatewayKey || order.payuKey || process.env.PAYU_KEY,
          salt: order.gatewaySalt || order.payuSalt || process.env.PAYU_SALT,
        });

        const txnDetails =
          verifyRes?.transaction_details?.[order.transactionId] ||
          verifyRes?.result ||
          {};

        const payuStatus = String(txnDetails.status || "").toLowerCase();
        const utr =
          txnDetails.bank_ref_num ||
          txnDetails.bank_ref_no ||
          txnDetails.field9 ||
          txnDetails.mihpayid;

        if (["success", "captured", "paid", "completed"].includes(payuStatus)) {
          order.paymentStatus = "paid";
          order.paidAt = new Date();
          if (txnDetails.mihpayid) order.payuPaymentId = String(txnDetails.mihpayid);
          if (utr) order.payuBankRefNum = String(utr);
          order.payuResponse = verifyRes;
          await order.save();
        } else if (["failure", "failed", "usercancelled"].includes(payuStatus)) {
          order.paymentStatus = "failed";
          order.payuResponse = verifyRes;
          await order.save();
        }
      } catch (verifyErr) {
        console.warn("[Himaanix] PayU verify_payment query failed:", verifyErr.message);
      }
    }

    const utr = order.payuBankRefNum || order.paymentReference || null;
    const paymentId = order.payuPaymentId || order.transactionId;

    return res.status(200).json({
      status: "success",
      data: {
        order_id: order.orderId,
        transaction_id: order.transactionId,
        payment_status: order.paymentStatus,
        amount: order.subtotal,
        currency: "INR",
        provider: order.provider || "payu",
        payment_id: paymentId,
        payu_payment_id: paymentId,
        utr: utr,
        deep_link: order.upiIntent,
        qr_string: order.upiIntent,
      },
      error: null,
    });
  } catch (error) {
    console.error("[Himaanix] checkPayinStatus error:", error);
    return res.status(500).json({
      status: "error",
      error: error.message || "Failed to check payment status",
    });
  }
}

/**
 * Forward verified callback payload to SuryaPe webhook
 */
async function forwardToPayinBackend(rawBody) {
  const target = process.env.PAYIN_BACKEND_WEBHOOK_URL;
  if (!target) return true;

  try {
    const response = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: rawBody,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`Payin Backend webhook returned HTTP ${response.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("Payin Backend webhook forward error:", err.message);
    return false;
  }
}

/**
 * POST /api/payin/payu-callback
 * Handles PayU callback, verifies reverse hash, fetches UTR, and forwards to SuryaPe
 */
export async function handlePayUCallback(req, res) {
  try {
    const data = req.body || {};
    const txnid = data.txnid;

    if (!txnid) {
      return res.status(400).json({ success: false, error: "Missing txnid in callback" });
    }

    const order = await Order.findOne({ transactionId: txnid });
    if (!order) {
      return res.status(404).json({ success: false, error: "Order not found" });
    }

    const activeSalt = order.gatewaySalt || order.payuSalt || process.env.PAYU_SALT;
    if (!verifyPayUCallbackHash(data, activeSalt)) {
      return res.status(400).json({ success: false, error: "Invalid PayU callback hash" });
    }

    const expectedAmount = Number(order.subtotal || 0).toFixed(2);
    const receivedAmount = Number(data.amount || 0).toFixed(2);
    if (expectedAmount !== receivedAmount) {
      return res.status(400).json({ success: false, error: "Amount mismatch" });
    }

    // Verify directly with PayU for bank reference
    let verifiedUtr = data.bank_ref_num || data.bank_ref_no || null;
    try {
      const verifyRes = await verifyPayUPayment(order.transactionId, {
        key: order.gatewayKey || order.payuKey || process.env.PAYU_KEY,
        salt: activeSalt,
      });
      const txnDetails = verifyRes?.transaction_details?.[order.transactionId] || {};
      verifiedUtr = txnDetails.bank_ref_num || txnDetails.bank_ref_no || verifiedUtr;
    } catch (_) {}

    const isSuccess = ["success", "captured", "paid", "completed"].includes(
      String(data.status || "").toLowerCase()
    );

    if (isSuccess) {
      order.paymentStatus = "paid";
      order.paidAt = new Date();
      if (data.mihpayid) order.payuPaymentId = String(data.mihpayid);
      if (verifiedUtr) order.payuBankRefNum = String(verifiedUtr);
      order.payuResponse = data;
      await order.save();
    } else {
      order.paymentStatus = "failed";
      order.payuResponse = data;
      await order.save();
    }

    // Prepare payload to forward to SuryaPe
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(data)) {
      params.set(k, String(v));
    }
    if (verifiedUtr && !params.has("bank_ref_num")) {
      params.set("bank_ref_num", verifiedUtr);
    }

    await forwardToPayinBackend(params.toString());

    return res.status(200).json({
      success: true,
      order_id: order.orderId,
      payment_status: order.paymentStatus,
    });
  } catch (error) {
    console.error("[Himaanix] PayU callback handler error:", error);
    return res.status(500).json({ success: false, error: "Callback processing failed" });
  }
}

/**
 * GET /api/payin/payu-callback
 * Browser redirect landing page
 */
export function getPayUCallback(req, res) {
  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Himaanix Payment Status</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
          .card { background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); max-width: 400px; text-align: center; }
          h2 { color: #0f172a; margin-top: 0; }
          p { color: #64748b; font-size: 14px; }
          .btn { display: inline-block; background: #0f172a; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Payment Processed</h2>
          <p>Your transaction has been processed by Himaanix. You may now safely return to the application.</p>
          <a class="btn" href="${process.env.FRONTEND_URL || "/"}">Return to Store</a>
        </div>
      </body>
    </html>
  `);
}

/**
 * GET /api/v1/payin/orders
 * Returns list of recent orders (both MoR gateway orders and storefront orders)
 * with statistics for admin monitoring
 */
export async function getPayinOrders(req, res) {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const filter = {};

    if (req.query.source) {
      filter.orderSource = req.query.source;
    }
    if (req.query.status) {
      filter.paymentStatus = req.query.status;
    }

    const [orders, total, stats] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Order.countDocuments(filter),
      Order.aggregate([
        {
          $group: {
            _id: null,
            totalVolume: { $sum: "$total" },
            paidVolume: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, "$total", 0],
              },
            },
            totalOrders: { $sum: 1 },
            paidOrders: {
              $sum: {
                $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
              },
            },
            gatewayOrders: {
              $sum: {
                $cond: [{ $eq: ["$orderSource", "gateway"] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const metrics = stats[0] || {
      totalVolume: 0,
      paidVolume: 0,
      totalOrders: 0,
      paidOrders: 0,
      gatewayOrders: 0,
    };

    return res.status(200).json({
      status: "success",
      metrics,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Himaanix] getPayinOrders error:", error);
    return res.status(500).json({ status: "error", error: error.message });
  }
}
