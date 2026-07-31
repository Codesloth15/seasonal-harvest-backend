import { randomUUID } from "node:crypto";
import { createAuthenticatedSupabaseClient } from "../config/supabase.js";

export const PRODUCT_IMAGE_BUCKET = "product-images";

const EXTENSIONS_BY_MIME_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export const uploadProductImage = async (productId, file, accessToken) => {
  const extension = EXTENSIONS_BY_MIME_TYPE[file.mimetype];
  if (!extension) {
    const error = new Error(
      "Unsupported product image type. Accepted formats: JPEG, PNG, WebP, and AVIF.",
    );
    error.statusCode = 400;
    error.code = "INVALID_PRODUCT_IMAGE_TYPE";
    throw error;
  }

  const objectPath = `${productId}/${randomUUID()}.${extension}`;
  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { error } = await userClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw error;

  const { data } = userClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .getPublicUrl(objectPath);

  return { imageUrl: data.publicUrl, objectPath };
};

export const deleteProductImage = async (objectPath, accessToken) => {
  if (!objectPath) return;

  const userClient = createAuthenticatedSupabaseClient(accessToken);
  const { error } = await userClient.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([objectPath]);

  if (error) throw error;
};
