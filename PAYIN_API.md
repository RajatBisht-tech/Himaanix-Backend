# Himaanix Pay-In API & MoR Gateway Bridge

Base URL: `http://localhost:5000/api/v1` (or `https://www.himaanix.com/api/v1`)

All server-to-server requests from SuryaPe require the bearer token:
`Authorization: Bearer <PAYIN_API_TOKEN>`

---

## 1. Create Pay-In Order (MoR Bridge)

`POST /payin/create-order`

### Request Body:
```json
{
  "order_id": "SE_100000000001",
  "amount": 899,
  "name": "Rahul Kumar",
  "email": "rahul@example.com",
  "mobile": "9876543210",
  "productinfo": "Himaanix Online Purchase",
  "customer_ip": "203.0.113.10",
  "device_info": "Mozilla/5.0 ...",
  "expiry_seconds": 1800,
  "provider": "payu",
  "gateway_key": "JROqUV",
  "gateway_salt": "6YdYDoXyr8zorCgibbBMgcrCPHa3gzYD"
}
```

### Response:
```json
{
  "status": "success",
  "data": {
    "transaction_id": "HP179260754525295dbfdbc",
    "order_id": "SE_100000000001",
    "amount": 899,
    "currency": "INR",
    "payment_status": "pending",
    "payment_id": "20000090598",
    "merchant_vpa": "payutest@hdfcbank",
    "merchant_name": "Himaanix",
    "deep_link": "upi://pay?pa=payutest@hdfcbank&pn=&tr=20000090598...",
    "upi_intent": "upi://pay?pa=payutest@hdfcbank&pn=&tr=20000090598...",
    "qr_string": "upi://pay?pa=payutest@hdfcbank&pn=&tr=20000090598...",
    "intent_data": "pa=payutest@hdfcbank&pn=&tr=20000090598...",
    "expires_in": 1800
  },
  "error": null
}
```

---

## 2. Check Order Status

`POST /payin/check-status`

### Request Body:
```json
{
  "order_id": "SE_100000000001"
}
```

### Response:
```json
{
  "status": "success",
  "data": {
    "order_id": "SE_100000000001",
    "transaction_id": "HP179260754525295dbfdbc",
    "payment_status": "pending | paid | failed",
    "amount": 899,
    "currency": "INR",
    "provider": "payu",
    "payment_id": "20000090598",
    "payu_payment_id": "20000090598",
    "utr": "508219876543",
    "deep_link": "upi://pay?...",
    "qr_string": "upi://pay?..."
  },
  "error": null
}
```

While an order is `pending`, this endpoint queries PayU S2S (`verify_payment`) to obtain the authoritative bank UTR and status update before responding.

---

## 3. PayU Callback & Relay

Configure PayU callback to:
`http://localhost:5000/api/payin/payu-callback`

When PayU posts a callback:
1. Himaanix verifies the PayU reverse SHA-512 hash using the channel salt.
2. It verifies the amount matches the order subtotal.
3. It performs S2S verification with PayU to fetch authoritative bank UTR.
4. Marks order `paid` in Himaanix DB.
5. If `PAYIN_BACKEND_WEBHOOK_URL` is set, it forwards the verified payload to SuryaPe's webhook endpoint (`/api/webhooks/payu/payment`), which reconciles the ledger and fires the merchant webhook.
