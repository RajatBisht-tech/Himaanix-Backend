import mongoose from "mongoose";

const menShoeSchema = new mongoose.Schema(
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
    },
    brand: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Sneakers",
        "Running Shoes",
        "Sports Shoes",
        "Casual Shoes",
        "Formal Shoes",
        "Walking Shoes",
        "Trekking Shoes",
        "Football Shoes",
        "Sandals",
        "Slippers",
        "Slides",
        "Boots",
        "Loafers",
        "Other",
      ],
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
    images: {
      type: [String],
      default: [],
    },
    colors: {
      type: [String],
      default: [],
    },
    sizes: {
      type: [String],
      default: [],
    },
    variants: [
      {
        sku: { type: String, trim: true, default: "" },
        size: { type: String, required: true },
        color: { type: String, default: "" },
        stock: { type: Number, min: 0, default: 0 },
        price: { type: Number, min: 0 },
        isAvailable: { type: Boolean, default: true },
      },
    ],
    tags: {
      type: [String],
      default: [],
    },
    source: {
      type: String,
      default: "",
    },
    sourceProductUrl: {
      type: String,
      default: "",
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
  { timestamps: true, collection: "men-shoes" }
);

menShoeSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  tags: "text",
});

menShoeSchema.index({ category: 1, isActive: 1 });
menShoeSchema.index({ price: 1 });

const MenShoe =
  mongoose.models.MenShoe || mongoose.model("MenShoe", menShoeSchema);

export default MenShoe;
