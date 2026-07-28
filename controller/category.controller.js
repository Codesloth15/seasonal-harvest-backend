import * as CategoryService from "../services/category.service.js";

export const getAllCategories = async (req, res, next) => {
  try {
    const categories = await CategoryService.listCategories({
      search: req.query.search,
      sort: req.query.sort,
      order: req.query.order,
    });
    res.status(200).json({ success: true, count: categories.length, data: categories });
  } catch (error) {
    next(error);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const category = await CategoryService.getCategory(req.params.id);
    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const category = await CategoryService.createCategory(req.body, req.accessToken);
    res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const category = await CategoryService.updateCategory(req.params.id, req.body, req.accessToken);
    res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: category,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    await CategoryService.deleteCategory(req.params.id, req.accessToken);
    res.status(200).json({ success: true, message: "Category deleted successfully." });
  } catch (error) {
    next(error);
  }
};
