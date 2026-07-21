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
    console.log("Query Params:", req.query);

    const products = await ProductModel.getAllProducts({});

    console.log("Products:", products);

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

    await ProductModel.deleteProduct(id);

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    next(error);
  }
};


