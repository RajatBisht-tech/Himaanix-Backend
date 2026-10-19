
import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: Number.isInteger,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },

    isApproved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

reviewSchema.index({ product: 1, user: 1 }, { unique: true });

const Review = mongoose.model("Review", reviewSchema);

export default Review;
