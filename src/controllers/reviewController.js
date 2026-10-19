
import mongoose from "mongoose";
import Review from "../models/Review.js";
import Product from "../models/Product.js";

// Get approved reviews for a product
export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const reviews = await Review.find({
      product: productId,
      isApproved: true,
    })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: reviews.length,
      reviews,
    });
  } catch (error) {
    next(error);
  }
};

// Submit a product review
export const createReview = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { rating, comment } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const score = Number(rating);

    if (
      !Number.isInteger(score) ||
      score < 1 ||
      score > 5 ||
      typeof comment !== "string" ||
      !comment.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5, and a comment is required",
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

    const review = await Review.create({
      product: product._id,
      user: req.user.id,
      rating: score,
      comment: comment.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Review submitted for moderation",
      review,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product",
      });
    }

    next(error);
  }
};

// Approve or reject a review (Admin only)
export const moderateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isApproved } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid review ID",
      });
    }

    if (typeof isApproved !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isApproved must be true or false",
      });
    }

    const review = await Review.findByIdAndUpdate(
      id,
      { isApproved },
      { new: true, runValidators: true }
    ).populate("user", "name");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Review ${isApproved ? "approved" : "rejected"} successfully`,
      review,
    });
  } catch (error) {
    next(error);
  }
};
