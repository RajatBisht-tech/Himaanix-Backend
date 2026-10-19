
import Category from "../models/Category.js";

// Get all active categories
export const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ name: 1 });

    res.json({
      success: true,
      categories,
    });
  } catch (error) {
    next(error);
  }
};

// Create category
export const createCategory = async (req, res, next) => {
  try {
    const { name, slug, description, image } = req.body;

    if (!name?.trim() || !slug?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name and slug are required",
      });
    }

    const category = await Category.create({
      name: name.trim(),
      slug: slug.trim().toLowerCase(),
      description: description || "",
      image: image || "",
    });

    res.status(201).json({
      success: true,
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Update category
export const updateCategory = async (req, res, next) => {
  try {
    const { name, slug, description, image, isActive } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (slug !== undefined) updates.slug = slug.trim().toLowerCase();
    if (description !== undefined) updates.description = description;
    if (image !== undefined) updates.image = image;
    if (isActive !== undefined) updates.isActive = isActive;

    const category = await Category.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    next(error);
  }
};

// Delete category (soft delete)
export const deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    res.json({
      success: true,
      message: "Category deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
