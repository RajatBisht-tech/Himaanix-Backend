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

const menWatchSchema = new mongoose.Schema(
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
    tags: { type: [String], default: ["men", "watches"] },
    source: { type: String, default: "" },
    sourceProductUrl: { type: String, default: "" },
    specifications: { type: mongoose.Schema.Types.Mixed, default: {} },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: "men-watches",
  }
);

menWatchSchema.index({ brand: 1 });
menWatchSchema.index({ category: 1 });
menWatchSchema.index({ price: 1 });
menWatchSchema.index({ isActive: 1, isFeatured: 1 });
menWatchSchema.index({ name: "text", description: "text", brand: "text" });

const MenWatch =
  mongoose.models.MenWatch || mongoose.model("MenWatch", menWatchSchema);

export default MenWatch;
