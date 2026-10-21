import mongoose from "mongoose";

const womenShoeSchema = new mongoose.Schema(
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
        "Walking Shoes",
        "Heels",
        "Flats",
        "Sandals",
        "Slippers",
        "Slides",
        "Boots",
        "Ballet Flats",
        "Wedges",
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
  { timestamps: true, collection: "women-shoes" }
);

womenShoeSchema.index({
  name: "text",
  description: "text",
  brand: "text",
  tags: "text",
});

womenShoeSchema.index({ category: 1, isActive: 1 });
womenShoeSchema.index({ price: 1 });

const WomenShoe =
  mongoose.models.WomenShoe || mongoose.model("WomenShoe", womenShoeSchema);

export default WomenShoe;
