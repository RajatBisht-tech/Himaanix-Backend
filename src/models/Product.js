
import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true, default: "" },
    size: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "" },
    stock: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    compareAtPrice: {
      type: Number,
      min: 0,
      default: undefined,
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    images: {
      type: [String],
      default: [],
    },

    brand: {
      type: String,
      default: "Himaanix",
      trim: true,
    },

    variants: {
      type: [variantSchema],
      default: [],
    },

    tags: {
      type: [String],
      default: [],
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({
  name: "text",
  description: "text",
  tags: "text",
});

const Product = mongoose.model("Product", productSchema);

export default Product;
