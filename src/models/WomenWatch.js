import mongoose from "mongoose";

const watchVariantSchema = new mongoose.Schema(
  {
    sku: { type: String, trim: true, default: "" },
    size: { type: String, trim: true, default: "" },
    color: { type: String, trim: true, default: "" },
    stock: { type: Number, default: null, min: 0 },
    price: { type: Number, required: true, min: 0 },
    isAvailable: { type: Boolean, default: true },
  },
  { _id: false }
);

const womenWatchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: { type: String, default: "" },
    brand: { type: String, default: "Sylvi", trim: true },
    category: { type: String, default: "Watches", trim: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    images: { type: [String], default: [] },
    colors: { type: [String], default: [] },
    sizes: { type: [String], default: [] },
    variants: { type: [watchVariantSchema], default: [] },
    tags: { type: [String], default: ["women", "watches"] },
    source: { type: String, default: "" },
    sourceProductUrl: { type: String, default: "" },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "women-watches",
  }
);

womenWatchSchema.index({ brand: 1 });
womenWatchSchema.index({ category: 1 });
womenWatchSchema.index({ price: 1 });
womenWatchSchema.index({ isActive: 1, isFeatured: 1 });
womenWatchSchema.index({ name: "text", description: "text", brand: "text" });

const WomenWatch =
  mongoose.models.WomenWatch || mongoose.model("WomenWatch", womenWatchSchema);

export default WomenWatch;
