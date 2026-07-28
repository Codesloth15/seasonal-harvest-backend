import * as ProductRepository from "../model/product.model.js";
import { notFound } from "../utils/http-error.js";

export const listProducts = (filters) => ProductRepository.getAllProducts(filters);

export const getProduct = async (id) => {
  const product = await ProductRepository.getProductById(id);
  if (!product) throw notFound("Product");
  return product;
};

export const createProduct = (values, accessToken) => ProductRepository.createProduct(values, accessToken);

export const updateProduct = async (id, values, accessToken) => {
  const product = await ProductRepository.updateProduct(id, values, accessToken);
  if (!product) throw notFound("Product");
  return product;
};

export const deleteProduct = async (id, accessToken) => {
  const product = await ProductRepository.deleteProduct(id, accessToken);
  if (!product) throw notFound("Product");
};
