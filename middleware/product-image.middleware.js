import multer from "multer";
import { ALLOWED_PRODUCT_IMAGE_TYPES, MAX_PRODUCT_IMAGE_SIZE } from "../utils/product-image.js";

export { ALLOWED_PRODUCT_IMAGE_TYPES, MAX_PRODUCT_IMAGE_SIZE };

const productImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_PRODUCT_IMAGE_SIZE,
    files: 1,
  },
  fileFilter(req, file, callback) {
    if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(file.mimetype)) {
      const error = new Error(
        "Unsupported product image type. Accepted formats: JPEG, PNG, WebP, and AVIF.",
      );
      error.statusCode = 400;
      error.code = "INVALID_PRODUCT_IMAGE_TYPE";
      return callback(error);
    }

    return callback(null, true);
  },
});

export const uploadProductImage = productImageUpload.single("image");
