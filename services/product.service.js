import * as ProductRepository from "../model/product.model.js";
import { notFound } from "../utils/http-error.js";
import {
  deleteProductImage,
  uploadProductImage,
} from "./product-image.service.js";
import { publishDataChange } from "./realtime-events.service.js";

export const listProducts = (filters) => ProductRepository.getAllProducts(filters);

export const getProduct = async (id) => {
  const product = await ProductRepository.getProductById(id);
  if (!product) throw notFound("Product");
  return product;
};

export const createProduct = async (values, image, accessToken) => {
  const product = await ProductRepository.createProduct(values, accessToken);
  if (!image) {
    publishDataChange({ resource: "product", action: "created", id: product.id });
    return product;
  }

  let objectPath;
  try {
    const uploaded = await uploadProductImage(product.id, image, accessToken);
    objectPath = uploaded.objectPath;

    const updatedProduct = await ProductRepository.updateProduct(
      product.id,
      { image_url: uploaded.imageUrl },
      accessToken,
    );
    publishDataChange({ resource: "product", action: "created", id: updatedProduct.id });
    return updatedProduct;
  } catch (error) {
    if (objectPath) {
      try {
        await deleteProductImage(objectPath, accessToken);
      } catch (cleanupError) {
        console.error("Failed to remove product image after product creation failed.", cleanupError);
      }
    }

    try {
      await ProductRepository.deleteProduct(product.id, accessToken);
    } catch (cleanupError) {
      console.error("Failed to roll back product after image upload failed.", cleanupError);
    }

    throw error;
  }
};

export const updateProduct = async (id, values, accessToken) => {
  const product = await ProductRepository.updateProduct(id, values, accessToken);
  if (!product) throw notFound("Product");
  publishDataChange({ resource: "product", action: "updated", id: product.id });
  return product;
};

export const deleteProduct = async (id, accessToken) => {
  const product = await ProductRepository.deleteProduct(id, accessToken);
  if (!product) throw notFound("Product");
  publishDataChange({ resource: "product", action: "deleted", id: product.id });
};
