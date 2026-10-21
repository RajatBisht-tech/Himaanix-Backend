import crypto from "crypto";

const PAYU_ENV = process.env.PAYU_ENV || "test";
const PAYU_KEY = process.env.PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;

function assertPayUConfig(key, salt) {
  const activeKey = key || PAYU_KEY;
  const activeSalt = salt || PAYU_SALT;
  if (!activeKey || !activeSalt) {
    throw new Error("PAYU_KEY and PAYU_SALT are required");
  }
}

function sha512(value) {
  return crypto.createHash("sha512").update(value).digest("hex");
}

function providerHttpError(response, raw, operation) {
  const error = new Error(
    operation === "verification"
      ? `PayU verification returned HTTP ${response.status}`
      : `PayU returned HTTP ${response.status}`
  );
  error.code =
    response.status === 429
      ? "PAYMENT_PROVIDER_RATE_LIMITED"
      : "PAYMENT_PROVIDER_HTTP_ERROR";

  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = /^\d+$/.test(retryAfter)
      ? Number(retryAfter)
      : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
    if (Number.isSafeInteger(seconds) && seconds >= 0) error.retryAfterSeconds = seconds;
  }

  error.providerDiagnostics = {
    operation,
    httpStatus: response.status,
    responseFormat: raw.trim().startsWith("<") ? "html" : raw.trim().startsWith("{") ? "json" : "text",
    rateLimitMentioned: /too many requests|rate.limit|request.limit/i.test(raw),
  };
  return error;
}

function providerIntentError(response, raw, payload) {
  const error = providerHttpError(response, raw, "create-intent");
  error.message = "PayU did not return a UPI intent";
  error.code = "PAYMENT_PROVIDER_INVALID_RESPONSE";
  return error;
}

/**
 * PayU standard payment hash
 * SHA512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayUPaymentHash({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
  key,
  salt,
}) {
  const activeKey = key || PAYU_KEY;
  const activeSalt = salt || PAYU_SALT;
  assertPayUConfig(activeKey, activeSalt);

  const hashString = [
    activeKey,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    "",
    "",
    "",
    "",
    "",
    activeSalt,
  ].join("|");

  return sha512(hashString);
}

/**
 * PayU UPI Intent / S2S Intent
 * pg = UPI, bankcode = INTENT, txn_s2s_flow = 4
 */
export async function createPayUIntent({
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  phone,
  successUrl,
  failureUrl,
  clientIp,
  deviceInfo,
  udf1 = "",
  udf2 = "",
  udf3 = "",
  udf4 = "",
  udf5 = "",
  key,
  salt,
}) {
  const activeKey = key || PAYU_KEY;
  const activeSalt = salt || PAYU_SALT;
  assertPayUConfig(activeKey, activeSalt);

  const env = process.env.PAYU_ENV || PAYU_ENV;
  const endpoint =
    env === "production"
      ? "https://secure.payu.in/_payment"
      : "https://test.payu.in/_payment";

  const formattedAmount = Number(amount).toFixed(2);

  const hash = generatePayUPaymentHash({
    txnid,
    amount: formattedAmount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    key: activeKey,
    salt: activeSalt,
  });

  const params = new URLSearchParams();
  params.set("key", activeKey);
  params.set("txnid", txnid);
  params.set("amount", formattedAmount);
  params.set("productinfo", productinfo);
  params.set("firstname", firstname);
  params.set("email", email);
  params.set("phone", phone);
  params.set("surl", successUrl);
  params.set("furl", failureUrl);
  params.set("pg", "UPI");
  params.set("bankcode", "INTENT");
  params.set("txn_s2s_flow", "4");
  params.set("udf1", udf1);
  params.set("udf2", udf2);
  params.set("udf3", udf3);
  params.set("udf4", udf4);
  params.set("udf5", udf5);
  params.set("s2s_client_ip", clientIp || "127.0.0.1");
  params.set("s2s_device_info", deviceInfo || "Himaanix-Payin");
  params.set("hash", hash);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw providerHttpError(response, raw, "create-intent");
  }

  const result = payload?.result || {};
  const intentURIData =
    result?.intentURIData ||
    result?.intentUri ||
    result?.intentURI ||
    payload?.intentURIData ||
    payload?.intentUri ||
    null;

  const intentUri = intentURIData ? `upi://pay?${intentURIData}` : null;
  const intentUrl = result?.intentUrl || null;

  if (!intentUri) {
    throw providerIntentError(response, raw, payload);
  }

  return {
    txnId: payload?.metaData?.txnId || txnid,
    transactionStatus: payload?.metaData?.txnStatus || "pending",
    paymentId: result?.paymentId || null,
    merchantVpa: result?.merchantVpa || null,
    merchantName: result?.merchantName || "Himaanix",
    intentURIData,
    intentUri,
    intentUrl,
    raw: payload,
  };
}

/**
 * Verify PayU payment S2S
 */
export async function verifyPayUPayment(txnid, options = {}) {
  const activeKey = options.key || PAYU_KEY;
  const activeSalt = options.salt || PAYU_SALT;
  assertPayUConfig(activeKey, activeSalt);

  const env = process.env.PAYU_ENV || PAYU_ENV;
  const endpoint =
    env === "production"
      ? "https://info.payu.in/merchant/postservice.php?form=2"
      : "https://test.payu.in/merchant/postservice.php?form=2";

  const command = "verify_payment";
  const hash = sha512([activeKey, command, txnid, activeSalt].join("|"));

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      key: activeKey,
      command,
      var1: txnid,
      hash,
    }).toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });

  const raw = await response.text();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw providerHttpError(response, raw, "verification");
  }

  return payload;
}

/**
 * Verify PayU callback hash
 */
export function verifyPayUCallbackHash(data, saltOverride) {
  const activeSalt = saltOverride || PAYU_SALT;
  if (!activeSalt) assertPayUConfig(data.key, activeSalt);

  if (process.env.PAYU_KEY && !saltOverride && data.key && data.key !== process.env.PAYU_KEY) {
    // If not overridden and key doesn't match env, allow order-specific key
  }

  const rawHash = [
    activeSalt,
    data.status || "",
    ...(data.splitInfo ? [data.splitInfo] : []),
    "",
    "",
    "",
    "",
    "",
    data.udf5 || "",
    data.udf4 || "",
    data.udf3 || "",
    data.udf2 || "",
    data.udf1 || "",
    data.email || "",
    data.firstname || "",
    data.productinfo || "",
    data.amount || "",
    data.txnid || "",
    data.key || PAYU_KEY,
  ].join("|");

  const charges = data.additionalCharges ?? data.additional_charges;
  const expected = sha512(charges ? `${charges}|${rawHash}` : rawHash);
  const received = String(data.hash || "").toLowerCase();

  if (!/^[a-f0-9]{128}$/.test(received)) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}
