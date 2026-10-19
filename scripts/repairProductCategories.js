import "dotenv/config";
import mongoose from "mongoose";
import Category from "../src/models/Category.js";
import Product from "../src/models/Product.js";
import {
  categoryDefinitions,
  classifyProductCategory,
} from "../src/utils/productCategory.js";
import connectDB from "../src/config/database.js";

const repairProductCategories = async () => {
  const applyChanges = process.argv.includes("--apply");
  await connectDB();

  const existingCategories = await Category.find({})
    .select("_id")
    .lean();
  const existingCategoryIds = new Set(
    existingCategories.map((category) => category._id.toString())
  );
  const products = await Product.find({})
    .select("category name description brand tags")
    .lean();

  const repairs = [];
  const skipped = [];
  for (const product of products) {
    const currentCategoryId =
      product.category && String(product.category);
    if (existingCategoryIds.has(currentCategoryId)) continue;

    const categorySlug = classifyProductCategory(product);
    if (!categorySlug) {
      skipped.push(product);
      continue;
    }

    repairs.push({ product, categorySlug });
  }

  const counts = repairs.reduce((totals, repair) => {
    totals[repair.categorySlug] = (totals[repair.categorySlug] || 0) + 1;
    return totals;
  }, {});

  console.log(
    `${applyChanges ? "Applying" : "Dry run:"} ${repairs.length} product category repairs`,
    JSON.stringify(counts)
  );
  if (skipped.length) {
    console.log(
      `Skipped ${skipped.length} products with missing category references that could not be classified.`
    );
  }
  if (!applyChanges || repairs.length === 0) return;

  const categories = new Map();
  for (const slug of Object.keys(counts)) {
    const definition = categoryDefinitions[slug];
    const category = await Category.findOneAndUpdate(
      { slug: definition.slug },
      { $setOnInsert: definition },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).select("_id");
    categories.set(slug, category._id);
  }

  const result = await Product.bulkWrite(
    repairs.map(({ product, categorySlug }) => ({
      updateOne: {
        filter: { _id: product._id },
        update: { $set: { category: categories.get(categorySlug) } },
      },
    }))
  );
  console.log(
    `Repaired ${result.modifiedCount} product category references.`
  );
};

try {
  await repairProductCategories();
} catch (error) {
  console.error("Product category repair failed:", error.message);
  process.exitCode = 1;
} finally {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
