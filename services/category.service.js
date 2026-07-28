import * as CategoryRepository from "../model/category.model.js";
import { notFound } from "../utils/http-error.js";

export const listCategories = (filters) => CategoryRepository.getAllCategories(filters);

export const getCategory = async (id) => {
  const category = await CategoryRepository.getCategoryById(id);
  if (!category) throw notFound("Category");
  return category;
};

export const createCategory = (values, accessToken) => CategoryRepository.createCategory(values, accessToken);

export const updateCategory = async (id, values, accessToken) => {
  const category = await CategoryRepository.updateCategory(id, values, accessToken);
  if (!category) throw notFound("Category");
  return category;
};

export const deleteCategory = async (id, accessToken) => {
  const category = await CategoryRepository.deleteCategory(id, accessToken);
  if (!category) throw notFound("Category");
};
