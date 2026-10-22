import { describe, expect, it } from "vitest";
import {
  MAX_PRODUCT_IMAGE_SIZE,
  parseEmbeddedProductImage,
} from "../../utils/product-image.js";

describe("inline product image parsing", () => {
  it.each([undefined, null, "", "https://images.test/product.png"])(
    "leaves external or absent images unchanged: %s",
    (value) => expect(parseEmbeddedProductImage(value)).toBeNull(),
  );

  it.each(["image/jpeg", "image/png", "image/webp", "image/avif"])(
    "decodes supported %s images",
    (mimetype) => {
      const buffer = Buffer.from([0, 1, 255, 17]);
      expect(parseEmbeddedProductImage(`data:${mimetype};base64,${buffer.toString("base64")}`))
        .toEqual({ mimetype, buffer });
    },
  );

  it("normalizes case in data URL metadata", () => {
    expect(parseEmbeddedProductImage("DATA:IMAGE/PNG;BASE64,YQ=="))
      .toEqual({ mimetype: "image/png", buffer: Buffer.from("a") });
  });

  it("recognizes inline images preceded by whitespace", () => {
    expect(parseEmbeddedProductImage(" \n\tdata:image/png;base64,YQ=="))
      .toEqual({ mimetype: "image/png", buffer: Buffer.from("a") });
  });

  it.each([
    "data:image/svg+xml;base64,YQ==",
    "data:text/plain;base64,YQ==",
    "data:image/png,plain-text",
    "data:image/png;charset=utf-8;base64,YQ==",
    "data:image/png;base64,",
    "data:image/png;base64,YQ",
    "data:image/png;base64,Y Q==",
    "data:image/png;base64,YQ==\n",
    "data:image/png;base64,YQ--",
    "data:image/png;base64,YR==", // Nonzero unused bits are not canonical base64.
    "data:image/png;base64,=YQ=",
    "data:image/png;base64,YQ===",
  ])("rejects invalid/unsupported inline data without echoing it", (value) => {
    expect(() => parseEmbeddedProductImage(value)).toThrow(expect.objectContaining({ statusCode: 400 }));
    try {
      parseEmbeddedProductImage(value);
    } catch (error) {
      expect(error.message).not.toContain(value);
    }
  });

  it("accepts the exact 5 MiB limit and rejects larger decoded or encoded input", () => {
    const exact = Buffer.alloc(MAX_PRODUCT_IMAGE_SIZE).toString("base64");
    expect(parseEmbeddedProductImage(`data:image/png;base64,${exact}`).buffer.length)
      .toBe(MAX_PRODUCT_IMAGE_SIZE);
    for (const size of [MAX_PRODUCT_IMAGE_SIZE + 1, MAX_PRODUCT_IMAGE_SIZE + 3]) {
      expect(() => parseEmbeddedProductImage(`data:image/png;base64,${Buffer.alloc(size).toString("base64")}`))
        .toThrow(expect.objectContaining({ code: "PRODUCT_IMAGE_TOO_LARGE", statusCode: 400 }));
    }
  });
});
