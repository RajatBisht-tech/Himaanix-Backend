import mongoose from "mongoose";
import MenShoe from "../models/MenShoe.js";
import WomenShoe from "../models/WomenShoe.js";

const getShoeModel = (gender) => {
  if (gender === "men") return MenShoe;
  if (gender === "women") return WomenShoe;
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
  "isFeatured",
  "isActive",
];

const withGender = (shoe, gender) => ({ ...shoe.toObject(), gender });

export const getShoes = async (req, res, next) => {
  try {
    const Shoe = getShoeModel(req.params.gender);
    if (!Shoe) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const page = Number.parseInt(req.query.page, 10) || 1;
    const limit = Number.parseInt(req.query.limit, 10) || 50;
    if (page < 1 || limit < 1 || limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 50",
      });
    }

    const filter = { isActive: true };
    if (req.params.gender === "women") {
      filter.$nor = [
        { name: /^\s*men(?:['’]s)?\b/i },
        { tags: { $in: [/^men$/i, /^men footwear$/i] } },
      ];
    }
    if (typeof req.query.category === "string" && req.query.category.trim()) {
      filter.category = req.query.category.trim();
    }
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      filter.$text = { $search: req.query.search.trim() };
    }

    const minPrice = req.query.minPrice === undefined
      ? undefined
      : Number(req.query.minPrice);
    const maxPrice = req.query.maxPrice === undefined
      ? undefined
      : Number(req.query.maxPrice);
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

    const [shoes, total] = await Promise.all([
      Shoe.find(filter)
        .select("name slug brand category price compareAtPrice images")
        .slice("images", 1)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      Shoe.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      products: shoes.map((shoe) => withGender(shoe, req.params.gender)),
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

export const getShoeBySlug = async (req, res, next) => {
  try {
    const Shoe = getShoeModel(req.params.gender);
    if (!Shoe) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const shoe = await Shoe.findOne({
      slug: req.params.slug,
      isActive: true,
    });
    if (!shoe) {
      return res.status(404).json({
        success: false,
        message: "Shoe not found",
      });
    }

    return res.json({
      success: true,
      product: withGender(shoe, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const createShoe = async (req, res, next) => {
  try {
    const Shoe = getShoeModel(req.params.gender);
    if (!Shoe) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }

    const shoeData = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) shoeData[field] = req.body[field];
    }
    if (typeof shoeData.slug === "string") {
      shoeData.slug = shoeData.slug.trim().toLowerCase();
    }

    const shoe = await Shoe.create(shoeData);
    return res.status(201).json({
      success: true,
      message: "Shoe created successfully",
      product: withGender(shoe, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const updateShoe = async (req, res, next) => {
  try {
    const Shoe = getShoeModel(req.params.gender);
    if (!Shoe) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shoe ID",
      });
    }

    const updates = {};
    for (const field of editableFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    if (typeof updates.slug === "string") {
      updates.slug = updates.slug.trim().toLowerCase();
    }

    const shoe = await Shoe.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!shoe) {
      return res.status(404).json({
        success: false,
        message: "Shoe not found",
      });
    }

    return res.json({
      success: true,
      message: "Shoe updated successfully",
      product: withGender(shoe, req.params.gender),
    });
  } catch (error) {
    return next(error);
  }
};

export const archiveShoe = async (req, res, next) => {
  try {
    const Shoe = getShoeModel(req.params.gender);
    if (!Shoe) {
      return res.status(400).json({
        success: false,
        message: "Gender must be men or women",
      });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shoe ID",
      });
    }

    const shoe = await Shoe.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true, runValidators: true }
    );
    if (!shoe) {
      return res.status(404).json({
        success: false,
        message: "Shoe not found",
      });
    }

    return res.json({
      success: true,
      message: "Shoe archived successfully",
    });
  } catch (error) {
    return next(error);
  }
};
