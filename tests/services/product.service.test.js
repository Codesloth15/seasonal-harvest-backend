import { beforeEach, describe, expect, it, vi } from "vitest";

const { repository, uploadProductImage, deleteProductImage } = vi.hoisted(() => ({
  repository: {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getAllProducts: vi.fn(),
    getProductById: vi.fn(),
  },
  uploadProductImage: vi.fn(),
  deleteProductImage: vi.fn(),
}));

vi.mock("../../model/product.model.js", () => repository);
vi.mock("../../services/product-image.service.js", () => ({
  uploadProductImage,
  deleteProductImage,
}));

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../../services/product.service.js";

describe("product service image creation flow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates and returns a product without touching storage when no image is supplied", async () => {
    const created = { id: "product-id", name: "Tomato" };
    repository.createProduct.mockResolvedValue(created);

    await expect(createProduct({ name: "Tomato" }, undefined, "token")).resolves.toBe(created);

    expect(repository.createProduct).toHaveBeenCalledWith({ name: "Tomato" }, "token");
    expect(uploadProductImage).not.toHaveBeenCalled();
    expect(repository.updateProduct).not.toHaveBeenCalled();
  });

  it("uploads an image and saves its public URL on the new product", async () => {
    const file = { buffer: Buffer.from("image"), mimetype: "image/webp" };
    const created = { id: "product-id", name: "Tomato" };
    const updated = { ...created, image_url: "https://example.test/tomato.webp" };
    repository.createProduct.mockResolvedValue(created);
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/image.webp",
      imageUrl: updated.image_url,
    });
    repository.updateProduct.mockResolvedValue(updated);

    await expect(createProduct({ name: "Tomato" }, file, "token")).resolves.toBe(updated);

    expect(uploadProductImage).toHaveBeenCalledWith("product-id", file, "token");
    expect(repository.updateProduct).toHaveBeenCalledWith(
      "product-id",
      { image_url: updated.image_url },
      "token",
    );
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(repository.deleteProduct).not.toHaveBeenCalled();
  });

  it("deletes the new product when the image upload fails", async () => {
    const uploadError = new Error("storage unavailable");
    repository.createProduct.mockResolvedValue({ id: "product-id" });
    uploadProductImage.mockRejectedValue(uploadError);
    repository.deleteProduct.mockResolvedValue({ id: "product-id" });

    await expect(
      createProduct({}, { buffer: Buffer.from("image"), mimetype: "image/png" }, "token"),
    ).rejects.toBe(uploadError);

    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(repository.deleteProduct).toHaveBeenCalledWith("product-id", "token");
  });

  it("removes the uploaded object and product when saving the URL fails", async () => {
    const databaseError = new Error("update failed");
    repository.createProduct.mockResolvedValue({ id: "product-id" });
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/image.avif",
      imageUrl: "https://example.test/image.avif",
    });
    repository.updateProduct.mockRejectedValue(databaseError);
    deleteProductImage.mockResolvedValue();
    repository.deleteProduct.mockResolvedValue({ id: "product-id" });

    await expect(createProduct({}, { mimetype: "image/avif" }, "token")).rejects.toBe(databaseError);

    expect(deleteProductImage).toHaveBeenCalledWith("product-id/image.avif", "token");
    expect(repository.deleteProduct).toHaveBeenCalledWith("product-id", "token");
  });

  it("preserves the original failure when cleanup operations also fail", async () => {
    const databaseError = new Error("update failed");
    repository.createProduct.mockResolvedValue({ id: "product-id" });
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/image.jpg",
      imageUrl: "https://example.test/image.jpg",
    });
    repository.updateProduct.mockRejectedValue(databaseError);
    deleteProductImage.mockRejectedValue(new Error("object cleanup failed"));
    repository.deleteProduct.mockRejectedValue(new Error("product cleanup failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(createProduct({}, { mimetype: "image/jpeg" }, "token")).rejects.toBe(databaseError);

    expect(console.error).toHaveBeenCalledTimes(2);
  });
});

describe("product service catalog operations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("passes list filters to the repository", async () => {
    const filters = { search: "tomato", active: true };
    const products = [{ id: "product-id" }];
    repository.getAllProducts.mockResolvedValue(products);

    await expect(listProducts(filters)).resolves.toBe(products);
    expect(repository.getAllProducts).toHaveBeenCalledWith(filters);
  });

  it("returns a product by id", async () => {
    const product = { id: "product-id" };
    repository.getProductById.mockResolvedValue(product);

    await expect(getProduct("product-id")).resolves.toBe(product);
  });

  it("throws a 404 when a product lookup returns no row", async () => {
    repository.getProductById.mockResolvedValue(null);

    await expect(getProduct("missing-id")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("updates a product with the authenticated repository", async () => {
    const updated = { id: "product-id", name: "Updated" };
    repository.updateProduct.mockResolvedValue(updated);

    await expect(updateProduct("product-id", { name: "Updated" }, "token")).resolves.toBe(updated);
    expect(repository.updateProduct).toHaveBeenCalledWith(
      "product-id",
      { name: "Updated" },
      "token",
    );
  });

  it("throws a 404 when updating a missing product", async () => {
    repository.updateProduct.mockResolvedValue(null);

    await expect(updateProduct("missing-id", { name: "Updated" }, "token")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("deletes an existing product", async () => {
    repository.deleteProduct.mockResolvedValue({ id: "product-id" });

    await expect(deleteProduct("product-id", "token")).resolves.toBeUndefined();
    expect(repository.deleteProduct).toHaveBeenCalledWith("product-id", "token");
  });

  it("throws a 404 when deleting a missing product", async () => {
    repository.deleteProduct.mockResolvedValue(null);

    await expect(deleteProduct("missing-id", "token")).rejects.toMatchObject({ statusCode: 404 });
  });
});
