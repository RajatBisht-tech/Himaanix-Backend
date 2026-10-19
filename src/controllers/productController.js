
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";

export const getProductTags = async (req, res, next) => {
  try {
    const tags = await Product.distinct("tags", {
      isActive: true,
      tags: { $exists: true, $ne: [] },
    });
    const uniqueTags = [
      ...new Map(
        tags
          .filter((tag) => typeof tag === "string" && tag.trim())
          .map((tag) => [tag.trim().toLocaleLowerCase(), tag.trim()])
      ).values(),
    ].sort((a, b) => a.localeCompare(b));

    return res.json({ success: true, tags: uniqueTags });
  } catch (error) {
    next(error);
  }
};

// Get all products with search, filters, and pagination
export const getProducts = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12)
    );

    const filter = { isActive: true };

    if (req.query.search?.trim()) {
      filter.$text = { $search: req.query.search.trim() };
    }

    if (req.query.category !== undefined) {
      const rawCategories = Array.isArray(req.query.category)
        ? req.query.category
        : [req.query.category];
      const categoryValues = rawCategories.flatMap((value) =>
        typeof value === "string" ? value.split(",") : [value]
      );

      if (
        categoryValues.length === 0 ||
        categoryValues.some(
          (value) => typeof value !== "string" || !value.trim()
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Category must be a category ID, name, or slug",
        });
      }

      const categoryIds = categoryValues
        .map((value) => value.trim())
        .filter(mongoose.isValidObjectId);
      const categorySlugs = categoryValues
        .map((value) =>
          value
            .trim()
            .toLowerCase()
            .replace(/[^a-z\d]+/g, "-")
            .replace(/^-|-$/g, "")
        )
        .filter((value) => value && !mongoose.isValidObjectId(value));

      if (categorySlugs.length > 0) {
        const categories = await Category.find({
          slug: { $in: categorySlugs },
          isActive: true,
        }).select("_id");
        categoryIds.push(...categories.map((category) => category._id));
      }

      const genderCategory = categorySlugs.length === 1
        ? categorySlugs[0]
        : null;
      const productMetadataPatterns = {
        women: /\b(women|woman|female|ladies?|saree|sari|lehenga|anarkali|kurti|kurtis|salwar|dupatta|gown|dress|ethnic|indie|fusion)\b/i,
        men: /\b(men(?:['’]s|s{1,2})?|man|male|groom|sherwani|pathani|bandhgala|nehru|jodhpuri|dhoti|safari)\b/i,
        kids: /\b(kids?|children|boys?|girls?|junior|toddlers?|little|mini)\b/i,
      };
      const metadataConditions = (pattern) => [
        { name: pattern },
        { slug: pattern },
        { description: pattern },
        { tags: pattern },
      ];

      if (["women", "men", "kids"].includes(genderCategory)) {
        const genderCategories = await Category.find({
          slug: { $in: ["women", "men", "kids"] },
          isActive: true,
        }).select("_id slug");
        const womenCategory = genderCategories.find(
          (category) => category.slug === "women"
        );
        const menCategory = genderCategories.find(
          (category) => category.slug === "men"
        );
        const categoryConditions = [];

        if (genderCategory === "women") {
          const menProductPattern =
            /\bmen(?:['’]s|s{1,2})?\b|\bman\b|\bmale\b/i;
          const kidsProductPattern =
            /\b(kids?|children|boys?|girls?|junior|toddlers?|little|mini)\b/i;
          const menBrandPattern = /^KISAH$/i;

          if (womenCategory) {
            categoryConditions.push({ category: womenCategory._id });
          }
          categoryConditions.push(
            ...metadataConditions(productMetadataPatterns.women),
            { brand: /^(SHREE\s*-\s*She Is Special|INDIESSENCE)$/i }
          );
          filter.$nor = [
            { name: menProductPattern },
            { slug: menProductPattern },
            { description: menProductPattern },
            { tags: menProductPattern },
            { brand: menBrandPattern },
            { name: kidsProductPattern },
            { slug: kidsProductPattern },
            { description: kidsProductPattern },
            { tags: kidsProductPattern },
            { brand: /^Kidsville$/i },
          ];
        } else if (genderCategory === "men") {
          const menProductPattern = productMetadataPatterns.men;
          if (menCategory) {
            categoryConditions.push({ category: menCategory._id });
          }
          if (womenCategory) {
            categoryConditions.push({
              category: womenCategory._id,
              $or: [
                ...metadataConditions(menProductPattern),
                { brand: /^KISAH$/i },
              ],
            });
          }
          categoryConditions.push(
            ...metadataConditions(menProductPattern),
            { brand: /^KISAH$/i }
          );
        } else {
          categoryConditions.push(
            ...(categoryIds.length
              ? [{ category: { $in: categoryIds } }]
              : []),
            ...metadataConditions(productMetadataPatterns.kids),
            { brand: /^Kidsville$/i }
          );
        }

        filter.$and = [
          ...(filter.$and || []),
          { $or: categoryConditions },
        ];
      }

      if (
        !["women", "men", "kids"].includes(genderCategory) &&
        !filter.category &&
        categoryIds.length > 0
      ) {
        filter.category = { $in: categoryIds };
      } else if (
        !["women", "men", "kids"].includes(genderCategory) &&
        !filter.category &&
        categorySlugs.length > 0
      ) {
        const categoryPatterns = categorySlugs.flatMap((slug) => {
          const normalizedSlug = slug.replace(/-/g, " ");
          if (normalizedSlug === "jewellery") {
            return [/^jewellery$/i, /^jewelry$/i, /^jewellry$/i];
          }
          return [
            new RegExp(
              `^${normalizedSlug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
              "i"
            ),
          ];
        });

        const categoryConditions = [
          { tags: { $in: categoryPatterns } },
          ...categorySlugs.map((slug) => ({
            name: new RegExp(
              `\\b${slug.replace(/-/g, "[\\s-]+")}\\b`,
              "i"
            ),
          })),
        ];

        for (const slug of categorySlugs) {
          const metadataPattern = productMetadataPatterns[slug];
          if (metadataPattern) {
            categoryConditions.push(
              { name: metadataPattern },
              { description: metadataPattern },
              { brand: metadataPattern },
              { tags: metadataPattern }
            );
          }
        }

        if (categoryIds.length > 0) {
          categoryConditions.push({ category: { $in: categoryIds } });
        }
        filter.$or = categoryConditions;
      }
    }

    const minPrice =
      req.query.minPrice !== undefined
        ? Number(req.query.minPrice)
        : undefined;

    const maxPrice =
      req.query.maxPrice !== undefined
        ? Number(req.query.maxPrice)
        : undefined;

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

    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const sortOptions = {
      newest: { createdAt: -1, _id: -1 },
      featured: { isFeatured: -1, createdAt: -1, _id: -1 },
      low: { price: 1, _id: 1 },
      high: { price: -1, _id: -1 },
      name: { name: 1, _id: 1 },
    };

    if (!Object.hasOwn(sortOptions, sort)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product sort order",
      });
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("category", "name slug")
        .sort(sortOptions[sort])
        .skip((page - 1) * limit)
        .limit(limit),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get product by slug
export const getProductBySlug = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      slug: req.params.slug,
      isActive: true,
    }).populate("category", "name slug");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Create product (Admin only)
export const createProduct = async (req, res, next) => {
  try {
    const {
      name,
      slug,
      description,
      price,
      category,
      images = [],
      compareAtPrice,
      brand,
      variants = [],
      tags = [],
      isFeatured = false,
    } = req.body;

    if (
      !name?.trim() ||
      !slug?.trim() ||
      !description?.trim() ||
      price === undefined ||
      !category
    ) {
      return res.status(400).json({
        success: false,
        message: "Name, slug, description, price and category are required",
      });
    }

    const productPrice = Number(price);

    if (!Number.isFinite(productPrice) || productPrice < 0) {
      return res.status(400).json({
        success: false,
        message: "Price must be a non-negative number",
      });
    }

    if (!mongoose.isValidObjectId(category)) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (
      !Array.isArray(images) ||
      !Array.isArray(variants) ||
      !Array.isArray(tags)
    ) {
      return res.status(400).json({
        success: false,
        message: "Images, variants and tags must be arrays",
      });
    }

    const product = await Product.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description.trim(),
      price: productPrice,
      category,
      images,
      compareAtPrice,
      brand,
      variants,
      tags,
      isFeatured,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Update product (Admin only)
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const allowedFields = [
      "name",
      "slug",
      "description",
      "price",
      "compareAtPrice",
      "category",
      "images",
      "brand",
      "variants",
      "tags",
      "isFeatured",
      "isActive",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (updates.price !== undefined) {
      updates.price = Number(updates.price);

      if (!Number.isFinite(updates.price) || updates.price < 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid product price",
        });
      }
    }

    if (updates.name !== undefined) {
      updates.name = String(updates.name).trim();

      if (!updates.name) {
        return res.status(400).json({
          success: false,
          message: "Product name cannot be empty",
        });
      }
    }

    if (updates.slug !== undefined) {
      updates.slug = String(updates.slug).trim().toLowerCase();

      if (!updates.slug) {
        return res.status(400).json({
          success: false,
          message: "Product slug cannot be empty",
        });
      }
    }

    if (
      updates.category !== undefined &&
      !mongoose.isValidObjectId(updates.category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    for (const field of ["images", "variants", "tags"]) {
      if (updates[field] !== undefined && !Array.isArray(updates[field])) {
        return res.status(400).json({
          success: false,
          message: `${field} must be an array`,
        });
      }
    }

    const product = await Product.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).populate("category", "name slug");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    next(error);
  }
};

// Archive product instead of permanently deleting it
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product archived successfully",
    });
  } catch (error) {
    next(error);
  }
};
