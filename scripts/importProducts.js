import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import { resolve } from "node:path";
import Category from "../src/models/Category.js";
import Product from "../src/models/Product.js";
import {
  categoryDefinitions,
  classifyProductCategory,
} from "../src/utils/productCategory.js";
import connectDB from "../src/config/database.js";

const toObjectId = (value, index) => {
  const id =
    typeof value === "string"
      ? value
      : value && typeof value === "object"
        ? value.$oid
        : undefined;

  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
    throw new Error(`Product at index ${index} has an invalid MongoDB _id`);
  }

  return new mongoose.Types.ObjectId(id);
};

const getCategoryReference = (value, index) => {
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim();
    return mongoose.isValidObjectId(normalized)
      ? { id: new mongoose.Types.ObjectId(normalized) }
      : { name: normalized };
  }

  return { id: toObjectId(value, index) };
};

const getImportedCategorySlug = (product) =>
  classifyProductCategory(product) || "other";

const categorySlugFromName = (name) =>
  name.toLowerCase().trim().replace(/[^a-z\d]+/g, "-").replace(/^-|-$/g, "");

const toDate = (value, field, index) => {
  const dateValue =
    value && typeof value === "object" && "$date" in value
      ? value.$date
      : value;
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Product at index ${index} has an invalid ${field}`);
  }

  return date;
};

const validateProduct = (product, index) => {
  if (!product || typeof product !== "object" || Array.isArray(product)) {
    throw new Error(`Product at index ${index} must be an object`);
  }

  const id = toObjectId(product._id, index);

  if (
    typeof product.name !== "string" ||
    !product.name.trim() ||
    typeof product.slug !== "string" ||
    !product.slug.trim() ||
    !Number.isFinite(Number(product.price)) ||
    Number(product.price) < 0 ||
    product.category == null ||
    (typeof product.category === "string" && !product.category.trim())
  ) {
    throw new Error(`Product at index ${index} has invalid required fields`);
  }

  for (const field of ["images", "variants", "tags"]) {
    if (!Array.isArray(product[field])) {
      throw new Error(`Product at index ${index} must have an array for ${field}`);
    }
  }

  if (
    product.compareAtPrice != null &&
    (!Number.isFinite(Number(product.compareAtPrice)) ||
      Number(product.compareAtPrice) < 0)
  ) {
    throw new Error(`Product at index ${index} has an invalid compareAtPrice`);
  }

  const validatedProduct = {
    ...product,
    _id: id,
    category: getCategoryReference(product.category, index),
  };

  for (const field of ["createdAt", "updatedAt"]) {
    if (product[field] !== undefined) {
      validatedProduct[field] = toDate(product[field], field, index);
    }
  }

  return validatedProduct;
};

const importProducts = async () => {
  const filePath = process.argv[2];
  const dryRun = process.argv[3] === "--dry-run";

  if (!filePath) {
    throw new Error(
      'Provide a JSON file path, for example: npm run import:products -- "C:\\data\\products.json"'
    );
  }

  const source = JSON.parse(await fs.readFile(resolve(filePath), "utf8"));
  const records = Array.isArray(source) ? source : source?.products;

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("The input must contain a non-empty products array");
  }

  const products = records.map(validateProduct);
  const ids = new Set(products.map((product) => product._id.toString()));
  const slugs = new Set(products.map((product) => product.slug.trim().toLowerCase()));

  if (ids.size !== products.length) {
    throw new Error("The input contains duplicate product _id values");
  }
  if (slugs.size !== products.length) {
    throw new Error("The input contains duplicate product slugs");
  }

  if (dryRun) {
    const categoryCount = new Set(
      products.map((product) =>
        product.category.id
          ? `id:${product.category.id.toString()}`
          : `name:${categorySlugFromName(product.category.name)}`
      )
    ).size;
    console.log(
      `Validated ${products.length} products across ${categoryCount} source categories. No database changes made.`
    );
    return;
  }

  await connectDB();

  const categoryNames = [
    ...new Set(
      products
        .map((product) => product.category.name)
        .filter((name) => name !== undefined)
    ),
  ];
  const referencedCategoryIds = [
    ...new Set(
      products
        .map((product) => product.category.id?.toString())
        .filter(Boolean)
    ),
  ];
  const existingReferencedCategories = await Category.find({
    _id: { $in: referencedCategoryIds },
  })
    .select("_id")
    .lean();
  const existingCategoryIds = new Set(
    existingReferencedCategories.map((category) => category._id.toString())
  );
  const inferredCategories = new Map();

  for (const product of products) {
    const categoryId =     product.category.id?.toString();
    if (!categoryId || existingCategoryIds.has(categoryId)) continue;

    const categorySlug = getImportedCategorySlug(product);
    inferredCategories.set(categorySlug, categoryDefinitions[categorySlug]);
  }

  const categoriesToCreate = [
    ...new Map(
      [
        ...categoryNames.map((name) => [
          categorySlugFromName(name),
          {
            name,
            slug: categorySlugFromName(name),
          },
        ]),
        ...[...inferredCategories.values()].map((category) => [
          category.slug,
          category,
        ]),
      ]
    ).values(),
  ];
  const categorySlugs = new Map(
    categoryNames.map((name) => [
      name,
      categorySlugFromName(name),
    ])
  );

  if (categoriesToCreate.length > 0) {
    await Category.bulkWrite(
      categoriesToCreate.map((category) => ({
        updateOne: {
          filter: { slug: category.slug },
          update: { $setOnInsert: category },
          upsert: true,
        },
      }))
    );
  }

  const categories = await Category.find({
    $or: [
      { slug: { $in: categoriesToCreate.map((category) => category.slug) } },
      { _id: { $in: referencedCategoryIds } },
    ],
  })
    .select("_id slug")
    .lean();
  const categoryIdsBySlug = new Map(
    categories.map((category) => [category.slug, category._id])
  );
  const categoryIdsByReference = new Map(
    categories.map((category) => [category._id.toString(), category._id])
  );

  const missingCategories = categoriesToCreate
    .map((category) => category.slug)
    .filter((slug) => !categoryIdsBySlug.has(slug));
  if (missingCategories.length) {
    throw new Error(
      `Failed to resolve imported categories: ${missingCategories.join(", ")}`
    );
  }
  const unresolvedCategoryReferences = referencedCategoryIds.filter(
    (id) =>
      !categoryIdsByReference.has(id) &&
      !products.some(
        (product) =>
          product.category.id?.toString() === id &&
          inferredCategories.has(getImportedCategorySlug(product))
      )
  );
  if (unresolvedCategoryReferences.length) {
    throw new Error(
      `Failed to resolve category references: ${unresolvedCategoryReferences.join(", ")}`
    );
  }

  const existingProducts = await Product.find({
    slug: { $in: [...slugs] },
  })
    .select("_id slug")
    .lean();
  const conflictingSlugs = existingProducts.filter((existing) =>
    products.some(
      (product) =>
        product.slug.trim().toLowerCase() === existing.slug &&
        !product._id.equals(existing._id)
    )
  );
  if (conflictingSlugs.length) {
    throw new Error(
      `Product slugs already belong to different _id values: ${conflictingSlugs
        .map((product) => product.slug)
        .join(", ")}`
    );
  }

  const result = await Product.bulkWrite(
    products.map((product) => {
      const {
        _id,
        category,
        compareAtPrice,
        ...fields
      } = product;
      const productCategoryId = category.id
        ? categoryIdsByReference.get(category.id.toString()) ||
          categoryIdsBySlug.get(categoryDefinitions[getImportedCategorySlug(product)].slug)
        : categoryIdsBySlug.get(categorySlugs.get(category.name));

      if (!productCategoryId) {
        throw new Error(`Failed to resolve category for product ${product.slug}`);
      }
      const update = {
        $set: {
          ...fields,
          slug: fields.slug.trim().toLowerCase(),
          category: productCategoryId,
        },
      };

      if (compareAtPrice == null) {
        update.$unset = { compareAtPrice: 1 };
      } else {
        update.$set.compareAtPrice = Number(compareAtPrice);
      }

      return {
        updateOne: {
          filter: { _id },
          update,
          upsert: true,
        },
      };
    })
  );

  console.log(
    `Imported ${products.length} products: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${result.matchedCount - result.modifiedCount} unchanged.`
  );
};

try {
  await importProducts();
} catch (error) {
  console.error("Product import failed:", error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
