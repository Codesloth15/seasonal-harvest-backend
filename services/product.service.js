import * as ProductRepository from "../model/product.model.js";
import { notFound } from "../utils/http-error.js";
import { parseEmbeddedProductImage } from "../utils/product-image.js";
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
  const productImage = image || parseEmbeddedProductImage(values.image_url);
  const createValues = { ...values };
  if (productImage) delete createValues.image_url;

  const product = await ProductRepository.createProduct(createValues, accessToken);
  if (!productImage) {
    publishDataChange({ resource: "product", action: "created", id: product.id });
    return product;
  }

  let objectPath;
  try {
    const uploaded = await uploadProductImage(product.id, productImage, accessToken);
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
  const image = parseEmbeddedProductImage(values.image_url);
  const uploaded = image ? await uploadProductImage(id, image, accessToken) : null;
  const updates = uploaded ? { ...values, image_url: uploaded.imageUrl } : values;
  const removeUnusedImage = async () => {
    try {
      await deleteProductImage(uploaded.objectPath, accessToken);
    } catch {
      console.error("Failed to remove unused product image after product update failed.");
    }
  };

  let product;
  try {
    product = await ProductRepository.updateProduct(id, updates, accessToken);
  } catch (error) {
    if (!uploaded) throw error;

    let current;
    try {
      current = await ProductRepository.getProductById(id, accessToken);
    } catch {
      // A lost response can follow a committed update. Keep the object until its
      // reference can be checked rather than deleting a possibly active image.
      console.error("Could not confirm product image update; uploaded image retained for recovery.");
      throw error;
    }

    if (current?.image_url === uploaded.imageUrl) {
      product = current;
    } else {
      await removeUnusedImage();
      throw error;
    }
  }

  if (!product) {
    if (uploaded) await removeUnusedImage();
    throw notFound("Product");
  }

  publishDataChange({ resource: "product", action: "updated", id: product.id });
  return product;
};

export const deleteProduct = async (id, accessToken) => {
  const product = await ProductRepository.deleteProduct(id, accessToken);
  if (!product) throw notFound("Product");
  publishDataChange({ resource: "product", action: "deleted", id: product.id });
};
