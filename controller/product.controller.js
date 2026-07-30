import * as ProductService from "../services/product.service.js";
import { parseOptionalBoolean } from "../utils/validation.js";

export const getAllProducts = async (req, res, next) => {
  try {
    const products = await ProductService.listProducts({
      categoryId: req.query.categoryId,
      brandId: req.query.brandId,
      productType: req.query.productType,
      search: req.query.search,
      active: parseOptionalBoolean(req.query.active, "active"),
      sort: req.query.sort,
      order: req.query.order,
    });
    res.status(200).json({ success: true, count: products.length, data: products });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await ProductService.getProduct(req.params.id);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const product = await ProductService.createProduct(req.body, req.file, req.accessToken);
    res.status(201).json({ success: true, message: "Product created successfully.", data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await ProductService.updateProduct(req.params.id, req.body, req.accessToken);
    res.status(200).json({ success: true, message: "Product updated successfully.", data: product });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    await ProductService.deleteProduct(req.params.id, req.accessToken);
    res.status(200).json({ success: true, message: "Product deleted successfully." });
  } catch (error) {
    next(error);
  }
};
