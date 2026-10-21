import mongoose from "mongoose";
import MenWatch from "../models/MenWatch.js";
import WomenWatch from "../models/WomenWatch.js";

const getWatchModel = (gender) => {
  if (gender === "men") return MenWatch;
  if (gender === "women") return WomenWatch;
  return null;
};

const editableFields = [
  "name",
  "slug",
  "description",
  "brand",
  "category",
  "price",
  "compareAtPrice",
  "images",
  "colors",
  "sizes",
  "variants",
  "tags",
  "source",
  "sourceProductUrl",
  "specifications",
  "isFeatured",
  "isActive",
];

const withGender = (watch, gender) => ({
  ...watch.toObject(),
  gender,
  catalogType: "watch",
});

export const getWatches = async (req, res, next) => {
  try {
    const Watch = getWatchModel(req.params.gender);
    if (!Watch) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 16;
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50",
      });
    }

    const filter = { isActive: true };
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      filter.category = req.query.category.trim();
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.$text = { $search: req.query.search.trim() };
    }

    const minPrice =
      req.query.minPrice === undefined ? undefined : Number(req.query.minPrice);
    const maxPrice =
      req.query.maxPrice === undefined ? undefined : Number(req.query.maxPrice);
    if (
      (minPrice !== undefined &&
        (!Number.isFinite(minPrice) || minPrice < 0)) ||
      (maxPrice !== undefined &&
        (!Number.isFinite(maxPrice) || maxPrice < 0)) ||
      (minPrice !== undefined &&
        maxPrice !== undefined &&
        minPrice > maxPrice)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid price range",
      });
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = minPrice;
      if (maxPrice !== undefined) filter.price.$lte = maxPrice;
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      "price-asc": { price: 1 },
      "price-desc": { price: -1 },
      name: { name: 1 },
    };
    const sort =
      typeof req.query.sort === "string" && sortOptions[req.query.sort]
        ? sortOptions[req.query.sort]
        : sortOptions.newest;

    const [watches, total] = await Promise.all([
      Watch.find(filter)
        .select("name slug brand category price compareAtPrice images")
        .slice("images", 1)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Watch.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products: watches.map((watch) => withGender(watch, req.params.gender)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};

export const getWatchBySlug = async (req, res, next) => {
  try {
    const Watch = getWatchModel(req.params.gender);
    if (!Watch) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const watch = await Watch.findOne({
      slug: req.params.slug,
      isActive: true,
    });
    if (!watch) {
      return res.status(404).json({
        success: false,
        message: "Watch not found",
      });
    }

    return res.json({
      success: true,
      product: withGender(watch, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const createWatch = async (req, res, next) => {
  try {
    const Watch = getWatchModel(req.params.gender);
    if (!Watch) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const watchData = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) watchData[field] = req.body[field];
    }
    if (typeof watchData.slug === "string") {
      watchData.slug = watchData.slug.trim().toLowerCase();
    }

    const watch = await Watch.create(watchData);
    return res.status(201).json({
      success: true,
      message: "Watch created successfully",
      product: withGender(watch, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateWatch = async (req, res, next) => {
  try {
    const Watch = getWatchModel(req.params.gender);
    if (!Watch) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watch ID",
      });
    }

    const updates = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (typeof updates.slug === "string") {
      updates.slug = updates.slug.trim().toLowerCase();
    }

    const watch = await Watch.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!watch) {
      return res.status(404).json({
        success: false,
        message: "Watch not found",
      });
    }

    return res.json({
      success: true,
      message: "Watch updated successfully",
      product: withGender(watch, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const archiveWatch = async (req, res, next) => {
  try {
    const Watch = getWatchModel(req.params.gender);
    if (!Watch) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid watch ID",
      });
    }

    const watch = await Watch.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, runValidators: true }
    );
    if (!watch) {
      return res.status(404).json({
        success: false,
        message: "Watch not found",
      });
    }

    return res.json({
      success: true,
      message: "Watch archived successfully",
    });
  } catch (error) {
    return next(error);
  }
};
