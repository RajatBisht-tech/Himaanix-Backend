
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    orderNumber: {
      type: String,
      unique: true,
      sparse: true,
      immutable: true,
    },

    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
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
      fullName: { type: String, required: true },
      phone: { type: String, required: true },
      line1: { type: String, required: true },
      line2: { type: String, default: "" },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
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
      enum: ["cod", "razorpay", "other"],
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
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model("Order", orderSchema);

export default Order;
