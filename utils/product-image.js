export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const invalidImage = (message, code = "INVALID_PRODUCT_IMAGE") => {
  const error = new Error(message);
  error.statusCode = 400;
  error.code = code;
  return error;
};

// Buffer.from(base64) alone silently accepts malformed input. Require canonical
// base64, including padding, and bound the encoded size before allocating bytes.
export const parseEmbeddedProductImage = (value) => {
  if (typeof value !== "string") return null;
  const normalizedValue = value.trimStart();
  if (!/^data:/i.test(normalizedValue)) return null;

  const separator = normalizedValue.indexOf(",");
  const header = separator === -1 ? "" : normalizedValue.slice(0, separator);
  const match = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(header);
  if (!match || !ALLOWED_PRODUCT_IMAGE_TYPES.has(match[1].toLowerCase())) {
    throw invalidImage("Inline images must be base64 JPEG, PNG, WebP, or AVIF.", "INVALID_PRODUCT_IMAGE_TYPE");
  }

  const encoded = normalizedValue.slice(separator + 1);
  if (encoded.length > Math.ceil(MAX_PRODUCT_IMAGE_SIZE / 3) * 4) {
    throw invalidImage("Product images must be no larger than 5 MB.", "PRODUCT_IMAGE_TOO_LARGE");
  }
  if (!encoded || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw invalidImage("Inline product images must contain valid base64.");
  }
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.toString("base64") !== encoded) {
    throw invalidImage("Inline product images must contain valid base64.");
  }
  if (buffer.length > MAX_PRODUCT_IMAGE_SIZE) {
    throw invalidImage("Product images must be no larger than 5 MB.", "PRODUCT_IMAGE_TOO_LARGE");
  }
  return { buffer, mimetype: match[1].toLowerCase() };
};
