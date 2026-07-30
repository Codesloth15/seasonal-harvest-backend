import multer from "multer";

export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

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
