
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// Get cart
export const getCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id })
      .populate("items.product");

    res.json({
      success: true,
      cart: cart || { items: [] },
    });
  } catch (error) {
    next(error);
  }
};

// Add item to cart
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, size = "", color = "" } = req.body;

    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({
        success: false,
        message: "Valid product ID and quantity are required",
      });
    }

    const product = await Product.findOne({
      _id: productId,
      isActive: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    if (product.variants.length > 0) {
      const variant = product.variants.find(
        (v) => v.size === size && v.color === color
      );

      if (!variant || variant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: "Selected variant is unavailable or out of stock",
        });
      }
    }

    let cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      cart = new Cart({ user: req.user.id, items: [] });
    }

    const item = cart.items.find(
      (i) =>
        i.product.toString() === productId &&
        i.size === size &&
        i.color === color
    );

    if (item) {
      if (item.quantity + quantity > 20) {
        return res.status(400).json({
          success: false,
          message: "Maximum quantity is 20",
        });
      }

      item.quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity, size, color });
    }

    await cart.save();

    cart = await Cart.findById(cart._id).populate("items.product");

    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// Update cart item quantity
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({
        success: false,
        message: "Quantity must be between 1 and 20",
      });
    }

    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    const product = await Product.findById(item.product);

    if (!product || !product.isActive) {
      return res.status(404).json({
        success: false,
        message: "Product is unavailable",
      });
    }

    if (product.variants.length > 0) {
      const variant = product.variants.find(
        (v) => v.size === item.size && v.color === item.color
      );

      if (!variant || variant.stock < quantity) {
        return res.status(400).json({
          success: false,
          message: "Insufficient stock",
        });
      }
    }

    item.quantity = quantity;
    await cart.save();

    res.json({ success: true, cart });
  } catch (error) {
    next(error);
  }
};

// Remove item from cart
export const removeCartItem = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ user: req.user.id });

    if (!cart) {
      return res.status(404).json({
        success: false,
        message: "Cart not found",
      });
    }

    const item = cart.items.id(req.params.itemId);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Cart item not found",
      });
    }

    item.deleteOne();
    await cart.save();

    res.json({
      success: true,
      message: "Item removed from cart",
      cart,
    });
  } catch (error) {
    next(error);
  }
};

// Clear cart
export const clearCart = async (req, res, next) => {
  try {
    await Cart.findOneAndUpdate(
      { user: req.user.id },
      { $set: { items: [] } }
    );

    res.json({
      success: true,
      message: "Cart cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};
