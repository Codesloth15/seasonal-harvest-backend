import * as ProductModel from "../model/product.model.js";

/**
 * Create Product
 */
export const createProduct = async (req, res, next) => {
  try {
    const product = await ProductModel.createProduct(req.body);

    res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get All Products
 */
export const getAllProducts = async (req, res, next) => {
  try {
    const { categoryId, brandId, productType, search, active, sort, order } = req.query;
    const filters = {
      categoryId,
      brandId,
      productType,
      search,
      sort,
      order,
    };

    if (active !== undefined) {
      if (active !== "true" && active !== "false") {
        return res.status(400).json({ success: false, error: "active must be true or false." });
      }
      filters.active = active === "true";
    }

    const products = await ProductModel.getAllProducts(filters);

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });

  } catch (error) {
    console.error(error);
    next(error);
  }
};
/**
 * Get Product By ID
 */
export const getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await ProductModel.getProductById(id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found." });

    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Product
 */
export const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await ProductModel.updateProduct(id, req.body);
    if (!product) return res.status(404).json({ success: false, error: "Product not found." });

    res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete Product (Soft Delete)
 */
export const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await ProductModel.deleteProduct(id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found." });

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};


