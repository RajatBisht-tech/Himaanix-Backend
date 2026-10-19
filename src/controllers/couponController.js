import Coupon from "../models/Coupon.js";

// Validate coupon
export const validateCoupon = async (req, res, next) => {
  try {
    const { code, orderAmount } = req.body;
    const amount = Number(orderAmount);

    if (!code?.trim() || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid coupon code and order amount are required",
      });
    }

    const coupon = await Coupon.findOne({
      code: code.trim().toUpperCase(),
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon is invalid or expired",
      });
    }

    if (
      coupon.usageLimit != null &&
      coupon.usedCount >= coupon.usageLimit
    ) {
      return res.status(400).json({
        success: false,
        message: "Coupon usage limit reached",
      });
    }

    if (amount < coupon.minOrderAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${coupon.minOrderAmount}`,
      });
    }

    let discount =
      coupon.discountType === "percentage"
        ? (amount * coupon.discountValue) / 100
        : coupon.discountValue;

    if (coupon.maxDiscount != null) {
      discount = Math.min(discount, coupon.maxDiscount);
    }

    discount = Math.min(discount, amount);
    discount = Math.round(discount * 100) / 100;

    return res.status(200).json({
      success: true,
      coupon: coupon.code,
      discount,
      finalAmount: Math.round((amount - discount) * 100) / 100,
    });
  } catch (error) {
    next(error);
  }
};

// Create coupon (Admin only)
export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderAmount = 0,
      maxDiscount,
      usageLimit,
      expiresAt,
    } = req.body;

    const value = Number(discountValue);
    const minAmount = Number(minOrderAmount);
    const expiry = new Date(expiresAt);

    if (
      !code?.trim() ||
      !["percentage", "fixed"].includes(discountType) ||
      !Number.isFinite(value) ||
      value <= 0 ||
      (discountType === "percentage" && value > 100) ||
      !Number.isFinite(minAmount) ||
      minAmount < 0 ||
      !expiresAt ||
      !Number.isFinite(expiry.getTime()) ||
      expiry <= new Date()
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid coupon details",
      });
    }

    const coupon = await Coupon.create({
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: value,
      minOrderAmount: minAmount,
      maxDiscount,
      usageLimit,
      expiresAt: expiry,
    });

    return res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      coupon,
    });
  } catch (error) {
    next(error);
  }
};