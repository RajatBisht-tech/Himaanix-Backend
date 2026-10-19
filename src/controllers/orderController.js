
import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

const trackingStatusByOrderStatus = {
  pending: "confirmed",
  processing: "packed",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "cancelled",
};

const formatOrderNumber = (order) => {
  const orderId = String(order._id);
  const date = new Date(order.createdAt || Date.now())
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  return `HIM-${date}-${orderId.slice(-8).toUpperCase()}`;
};

const getTrackingHistory = (order) => {
  if (order.trackingHistory?.length) return order.trackingHistory;

  const currentStatus = trackingStatusByOrderStatus[order.status];
  const deliverySteps = ["confirmed", "packed", "shipped", "delivered"];
  const currentIndex = deliverySteps.indexOf(currentStatus);
  const history = deliverySteps
    .slice(0, currentIndex + 1)
    .map((status, index) => ({
      status,
      timestamp:
        index === 0
          ? order.createdAt
          : index === currentIndex
            ? order.updatedAt
            : null,
    }));

  if (currentStatus === "cancelled") {
    history.push({ status: "cancelled", timestamp: order.updatedAt });
  }

  return history;
};

// Get logged-in user's orders
export const getMyOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const filter = { user: req.user.id };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get a single order belonging to the logged-in user
export const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({
      _id: id,
      user: req.user.id,
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    next(error);
  }
};

export const getOrderTracking = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findOne({
      _id: id,
      user: req.user.id,
    });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    const estimatedDelivery =
      order.estimatedDelivery ||
      new Date(order.createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);

    return res.status(200).json({
      success: true,
      tracking: {
        orderId: order._id,
        orderNumber: order.orderNumber || formatOrderNumber(order),
        status: order.status,
        estimatedDelivery,
        history: getTrackingHistory(order),
        items: order.items,
        total: order.total,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all orders (Admin only)
export const getAllOrders = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 20)
    );

    const filter = {};

    if (req.query.status) {
      const allowedStatuses = [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ];

      if (!allowedStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status filter",
        });
      }

      filter.status = req.query.status;
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update order status (Admin only)
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "processing",
      "shipped",
      "delivered",
      "cancelled",
    ];

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order status",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (["delivered", "cancelled"].includes(order.status)) {
      return res.status(409).json({
        success: false,
        message: "This order can no longer be updated",
      });
    }

    const allowedTransitions = {
      pending: ["processing", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered", "cancelled"],
    };
    if (!allowedTransitions[order.status]?.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Order cannot move from ${order.status} to ${status}`,
      });
    }

    if (
      status === "delivered" &&
      order.paymentMethod !== "cod" &&
      order.paymentStatus !== "paid"
    ) {
      return res.status(409).json({
        success: false,
        message: "Cannot deliver an unpaid prepaid order",
      });
    }

    order.status = status;
    order.trackingHistory.push({
      status: trackingStatusByOrderStatus[status],
      timestamp: new Date(),
    });
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      order,
    });
  } catch (error) {
    next(error);
  }
};

export const createOrder = async (req, res, next) => {
  const { items, shippingAddress, paymentMethod = "cod" } = req.body;

  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Add between 1 and 50 items to your order",
    });
  }

  if (paymentMethod !== "cod") {
    return res.status(400).json({
      success: false,
      message: "Only cash on delivery is available right now",
    });
  }

  const addressFields = [
    "fullName",
    "phone",
    "line1",
    "city",
    "state",
    "postalCode",
  ];
  if (
    !shippingAddress ||
    addressFields.some(
      (field) =>
        typeof shippingAddress[field] !== "string" ||
        !shippingAddress[field].trim()
    ) ||
    !/^[0-9+() -]{8,20}$/.test(shippingAddress.phone.trim())
  ) {
    return res.status(400).json({
      success: false,
      message: "Enter a valid delivery address and phone number",
    });
  }

  const requestedItems = [];
  for (const item of items) {
    const productId = item?.product;
    const quantity = item?.quantity;

    if (
      !mongoose.isValidObjectId(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 20
    ) {
      return res.status(400).json({
        success: false,
        message: "Each item must have a valid product and quantity between 1 and 20",
      });
    }

    requestedItems.push({
      productId: new mongoose.Types.ObjectId(productId),
      quantity,
      size: typeof item.size === "string" ? item.size.trim() : "",
      color: typeof item.color === "string" ? item.color.trim() : "",
    });
  }

  const normalizedAddress = Object.fromEntries(
    addressFields.map((field) => [field, shippingAddress[field].trim()])
  );
  normalizedAddress.line2 =
    typeof shippingAddress.line2 === "string"
      ? shippingAddress.line2.trim()
      : "";
  normalizedAddress.country =
    typeof shippingAddress.country === "string" &&
    shippingAddress.country.trim()
      ? shippingAddress.country.trim()
      : "India";

  const reservedVariants = [];

  try {
    const orderItems = [];
    let subtotal = 0;

    for (const requested of requestedItems) {
      const product = await Product.findOne({
        _id: requested.productId,
        isActive: true,
      });

      if (!product) {
        const error = new Error("One or more products are unavailable");
        error.status = 409;
        throw error;
      }

      let variant;
      if (product.variants.length > 0) {
        const matchingVariants = product.variants.filter(
          (candidate) =>
            (
              candidate.size === requested.size ||
              (!requested.size && candidate.size === "OneSize") ||
              (requested.size &&
                candidate.size.startsWith(`${requested.size}/`))
            ) &&
            (!requested.color || candidate.color === requested.color)
        );

        if (matchingVariants.length !== 1) {
          const error = new Error(
            `Please select a valid size${matchingVariants.length > 1 ? " and color" : ""} for ${product.name}`
          );
          error.status = 400;
          throw error;
        }
        [variant] = matchingVariants;

        if (variant.stock < requested.quantity) {
          const error = new Error(
            `${product.name} has only ${variant.stock} left in stock`
          );
          error.status = 409;
          throw error;
        }

        const variantIndex = product.variants.indexOf(variant);
        const stockPath = `variants.${variantIndex}.stock`;
        const reservation = await Product.updateOne(
          {
            _id: product._id,
            isActive: true,
            [stockPath]: { $gte: requested.quantity },
          },
          { $inc: { [stockPath]: -requested.quantity } }
        );

        if (reservation.modifiedCount !== 1) {
          const error = new Error(
            `${product.name} has just gone out of stock. Please review your bag.`
          );
          error.status = 409;
          throw error;
        }

        reservedVariants.push({
          productId: product._id,
          stockPath,
          quantity: requested.quantity,
        });
      }

      const lineTotal = product.price * requested.quantity;
      subtotal += lineTotal;
      orderItems.push({
        product: product._id,
        name: product.name,
        image: product.images[0] || "",
        sku: variant?.sku || "",
        size: variant?.size || "",
        color: variant?.color || "",
        quantity: requested.quantity,
        unitPrice: product.price,
        lineTotal,
      });
    }

    const shippingFee = subtotal >= 1999 ? 0 : 99;
    const orderId = new mongoose.Types.ObjectId();
    const createdAt = new Date();
    const order = await Order.create({
      _id: orderId,
      orderNumber: formatOrderNumber({ _id: orderId, createdAt }),
      createdAt,
      user: req.user.id,
      items: orderItems,
      shippingAddress: normalizedAddress,
      subtotal,
      discount: 0,
      shippingFee,
      total: subtotal + shippingFee,
      paymentMethod: "cod",
      paymentStatus: "pending",
      estimatedDelivery: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      trackingHistory: [{ status: "confirmed", timestamp: new Date() }],
    });

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    const rollbackResults = await Promise.allSettled(
      reservedVariants.map(({ productId, stockPath, quantity }) =>
        Product.updateOne(
          { _id: productId },
          { $inc: { [stockPath]: quantity } }
        )
      )
    );

    if (
      rollbackResults.some(
        (result) =>
          result.status !== "fulfilled" ||
          result.value.modifiedCount !== 1
      )
    ) {
      console.error("Failed to release all reserved stock after checkout error");
      return res.status(500).json({
        success: false,
        message:
          "We couldn't finish your order and some stock could not be restored. Please contact support.",
      });
    }

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  }
};
