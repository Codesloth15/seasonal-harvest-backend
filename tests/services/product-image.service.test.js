import { beforeEach, describe, expect, it, vi } from "vitest";

const { upload, remove, getPublicUrl, from, createAuthenticatedSupabaseClient } = vi.hoisted(() => {
  const upload = vi.fn();
  const remove = vi.fn();
  const getPublicUrl = vi.fn();
  const from = vi.fn(() => ({ upload, remove, getPublicUrl }));
  const createAuthenticatedSupabaseClient = vi.fn(() => ({ storage: { from } }));
  return { upload, remove, getPublicUrl, from, createAuthenticatedSupabaseClient };
});

vi.mock("../../config/supabase.js", () => ({
  createAuthenticatedSupabaseClient,
}));

import {
  PRODUCT_IMAGE_BUCKET,
  deleteProductImage,
  uploadProductImage,
} from "../../services/product-image.service.js";

describe("product image service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads an image under the product id and returns its public URL", async () => {
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.test/product.jpg" } });
    const file = { buffer: Buffer.from("image"), mimetype: "image/jpeg" };

    const result = await uploadProductImage("product-id", file, "token");

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(from).toHaveBeenCalledWith(PRODUCT_IMAGE_BUCKET);
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^product-id\/[0-9a-f-]+\.jpg$/),
      file.buffer,
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );
    expect(result.imageUrl).toBe("https://example.test/product.jpg");
    expect(result.objectPath).toMatch(/^product-id\/[0-9a-f-]+\.jpg$/);
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/avif", "avif"],
  ])("uses the correct extension for %s", async (mimetype, extension) => {
    upload.mockResolvedValue({ error: null });
    getPublicUrl.mockReturnValue({ data: { publicUrl: "https://example.test/product" } });

    const result = await uploadProductImage(
      "product-id",
      { buffer: Buffer.from("image"), mimetype },
      "token",
    );

    expect(result.objectPath).toMatch(new RegExp(`^product-id/[0-9a-f-]+\\.${extension}$`));
  });

  it("rejects unsupported image types before uploading", async () => {
    await expect(
      uploadProductImage(
        "product-id",
        { buffer: Buffer.from("image"), mimetype: "image/svg+xml" },
        "token",
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(upload).not.toHaveBeenCalled();
  });

  it("removes a stored product image", async () => {
    remove.mockResolvedValue({ error: null });

    await deleteProductImage("product-id/image.webp", "token");

    expect(remove).toHaveBeenCalledWith(["product-id/image.webp"]);
  });

  it("does nothing when no object path is provided", async () => {
    await expect(deleteProductImage(undefined, "token")).resolves.toBeUndefined();

    expect(createAuthenticatedSupabaseClient).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("propagates storage upload errors", async () => {
    const storageError = new Error("upload failed");
    upload.mockResolvedValue({ error: storageError });

    await expect(
      uploadProductImage(
        "product-id",
        { buffer: Buffer.from("image"), mimetype: "image/jpeg" },
        "token",
      ),
    ).rejects.toBe(storageError);
  });

  it("propagates storage deletion errors", async () => {
    const storageError = new Error("delete failed");
    remove.mockResolvedValue({ error: storageError });

    await expect(deleteProductImage("product-id/image.jpg", "token")).rejects.toBe(storageError);
  });
});
