import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    orderId: {
      type: String,
      unique: true,
      sparse: true,
    },

    transactionId: {
      type: String,
      unique: true,
      sparse: true,
    },

    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
    },

    orderSource: {
      type: String,
      enum: ["storefront", "gateway"],
      default: "storefront",
    },

    customer: {
      name: { type: String, default: "" },
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      ip: { type: String, default: "" },
      deviceInfo: { type: String, default: "" },
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: false,
        },
        name: {
          type: String,
          required: true,
        },
        image: {
          type: String,
          default: "",
        },
        sku: {
          type: String,
          default: "",
        },
        size: {
          type: String,
          default: "",
        },
        color: {
          type: String,
          default: "",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
          min: 0,
        },
        lineTotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    shippingAddress: {
      fullName: { type: String, default: "" },
      phone: { type: String, default: "" },
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "India" },
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    shippingFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      default: "pending",
    },

    estimatedDelivery: {
      type: Date,
      default: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },

    trackingHistory: [
      {
        status: {
          type: String,
          enum: ["confirmed", "packed", "shipped", "delivered", "cancelled"],
          required: true,
        },
        timestamp: {
          type: Date,
          required: true,
        },
      },
    ],

    paymentMethod: {
      type: String,
      default: "cod",
    },

    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },

    paymentReference: {
      type: String,
      default: "",
    },

    provider: {
      type: String,
      default: "payu",
    },

    payuTxnId: { type: String, default: null },
    payuPaymentId: { type: String, default: null },
    payuBankRefNum: { type: String, default: null },
    payuMerchantVpa: { type: String, default: null },
    payuQrString: { type: String, default: null },
    payuKey: { type: String, default: null },
    payuSalt: { type: String, default: null },
    payuResponse: { type: mongoose.Schema.Types.Mixed, default: null },

    gatewayKey: { type: String, default: null },
    gatewaySalt: { type: String, default: null },
    merchantVpa: { type: String, default: null },
    upiIntent: { type: String, default: null },
    upiString: { type: String, default: null },
    paidAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ payuTxnId: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);

export default Order;
