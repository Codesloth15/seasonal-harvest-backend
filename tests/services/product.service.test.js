import { beforeEach, describe, expect, it, vi } from "vitest";

const { repository, uploadProductImage, deleteProductImage, publishDataChange } = vi.hoisted(() => ({
  repository: {
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    deleteProduct: vi.fn(),
    getAllProducts: vi.fn(),
    getProductById: vi.fn(),
  },
  uploadProductImage: vi.fn(),
  deleteProductImage: vi.fn(),
  publishDataChange: vi.fn(),
}));

vi.mock("../../model/product.model.js", () => repository);
vi.mock("../../services/product-image.service.js", () => ({
  uploadProductImage,
  deleteProductImage,
}));
vi.mock("../../services/realtime-events.service.js", () => ({ publishDataChange }));

import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../../services/product.service.js";

const EMBEDDED_IMAGE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO5+/FYAAAAASUVORK5CYII=";
const IMAGE_FILE = {
  buffer: Buffer.from(EMBEDDED_IMAGE.split(",")[1], "base64"),
  mimetype: "image/png",
};

describe("product service image creation flow", () => {
  beforeEach(() => vi.resetAllMocks());

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

  it("uploads an inline image without persisting its data URL or mutating input", async () => {
    const values = Object.freeze({ name: "Tomato", image_url: EMBEDDED_IMAGE });
    const created = { id: "product-id", name: "Tomato" };
    const updated = { ...created, image_url: "https://example.test/tomato.png" };
    repository.createProduct.mockResolvedValue(created);
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/image.png",
      imageUrl: updated.image_url,
    });
    repository.updateProduct.mockResolvedValue(updated);

    await expect(createProduct(values, undefined, "token")).resolves.toBe(updated);

    expect(repository.createProduct).toHaveBeenCalledWith({ name: "Tomato" }, "token");
    expect(uploadProductImage).toHaveBeenCalledWith("product-id", IMAGE_FILE, "token");
    expect(repository.updateProduct).toHaveBeenCalledWith(
      "product-id", { image_url: updated.image_url }, "token",
    );
    expect(values.image_url).toBe(EMBEDDED_IMAGE);
    expect(publishDataChange).toHaveBeenCalledExactlyOnceWith({
      resource: "product", action: "created", id: "product-id",
    });
  });

  it("prefers an explicit image and strips an inline URL without parsing it", async () => {
    const values = Object.freeze({ name: "Tomato", image_url: "data:image/png;base64,invalid!" });
    const file = { buffer: Buffer.from("multipart image"), mimetype: "image/webp" };
    const updated = { id: "product-id", image_url: "https://example.test/image.webp" };
    repository.createProduct.mockResolvedValue({ id: "product-id" });
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/image.webp", imageUrl: updated.image_url,
    });
    repository.updateProduct.mockResolvedValue(updated);

    await expect(createProduct(values, file, "token")).resolves.toBe(updated);

    expect(repository.createProduct).toHaveBeenCalledWith({ name: "Tomato" }, "token");
    expect(uploadProductImage).toHaveBeenCalledWith("product-id", file, "token");
    expect(values.image_url).toBe("data:image/png;base64,invalid!");
  });

  it("keeps an ordinary image URL without uploading it again", async () => {
    const values = { name: "Tomato", image_url: "https://example.test/image.png" };
    repository.createProduct.mockResolvedValue({ id: "product-id", ...values });

    await createProduct(values, undefined, "token");

    expect(repository.createProduct).toHaveBeenCalledWith(values, "token");
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("rejects a malformed inline image before creating a product", async () => {
    await expect(createProduct({ image_url: "data:image/png;base64,invalid!" }, undefined, "token"))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(repository.createProduct).not.toHaveBeenCalled();
    expect(uploadProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
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
  beforeEach(() => vi.resetAllMocks());

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
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("uploads an inline update and saves only its Storage URL without mutating input", async () => {
    const values = Object.freeze({ name: "Updated", image_url: EMBEDDED_IMAGE });
    const updated = { id: "product-id", name: "Updated", image_url: "https://example.test/image.png" };
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: updated.image_url,
    });
    repository.updateProduct.mockResolvedValue(updated);

    await expect(updateProduct("product-id", values, "token")).resolves.toBe(updated);

    expect(uploadProductImage).toHaveBeenCalledWith("product-id", IMAGE_FILE, "token");
    expect(repository.updateProduct).toHaveBeenCalledWith(
      "product-id", { name: "Updated", image_url: updated.image_url }, "token",
    );
    expect(values.image_url).toBe(EMBEDDED_IMAGE);
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).toHaveBeenCalledExactlyOnceWith({
      resource: "product", action: "updated", id: "product-id",
    });
  });

  it.each(["https://example.test/image.png", null])("preserves an ordinary image update (%s)", async (imageUrl) => {
    const values = Object.freeze({ image_url: imageUrl });
    repository.updateProduct.mockResolvedValue({ id: "product-id", ...values });

    await updateProduct("product-id", values, "token");

    expect(repository.updateProduct).toHaveBeenCalledWith("product-id", values, "token");
    expect(uploadProductImage).not.toHaveBeenCalled();
  });

  it("rejects a malformed inline update before touching storage or the database", async () => {
    await expect(updateProduct("product-id", { image_url: "data:image/png;base64,invalid!" }, "token"))
      .rejects.toMatchObject({ statusCode: 400 });

    expect(uploadProductImage).not.toHaveBeenCalled();
    expect(repository.updateProduct).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("removes a new image when the product update returns no row", async () => {
    uploadProductImage.mockResolvedValue({
      objectPath: "missing-id/new.png", imageUrl: "https://example.test/new.png",
    });
    repository.updateProduct.mockResolvedValue(null);

    await expect(updateProduct("missing-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toMatchObject({ statusCode: 404 });

    expect(deleteProductImage).toHaveBeenCalledWith("missing-id/new.png", "token");
    expect(repository.getProductById).not.toHaveBeenCalled();
    expect(repository.deleteProduct).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("removes a new image when saving the update fails", async () => {
    const failure = new Error("update failed");
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: "https://example.test/new.png",
    });
    repository.updateProduct.mockRejectedValue(failure);
    repository.getProductById.mockResolvedValue({ id: "product-id", image_url: "https://example.test/old.png" });

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(deleteProductImage).toHaveBeenCalledWith("product-id/new.png", "token");
    expect(repository.getProductById).toHaveBeenCalledWith("product-id", "token");
    expect(repository.deleteProduct).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("preserves the update failure if image cleanup also fails", async () => {
    const failure = new Error("update failed");
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: "https://example.test/new.png",
    });
    repository.updateProduct.mockRejectedValue(failure);
    repository.getProductById.mockResolvedValue({ id: "product-id", image_url: "https://example.test/old.png" });
    deleteProductImage.mockRejectedValue(new Error("cleanup failed"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(deleteProductImage).toHaveBeenCalledWith("product-id/new.png", "token");
    expect(console.error).toHaveBeenCalledOnce();
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("recovers a committed image update when the database response was lost", async () => {
    const updated = { id: "product-id", image_url: "https://example.test/new.png", name: "Updated" };
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: updated.image_url,
    });
    repository.updateProduct.mockRejectedValue(new Error("response lost"));
    repository.getProductById.mockResolvedValue(updated);

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE, name: "Updated" }, "token"))
      .resolves.toBe(updated);

    expect(repository.getProductById).toHaveBeenCalledWith("product-id", "token");
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).toHaveBeenCalledExactlyOnceWith({
      resource: "product", action: "updated", id: "product-id",
    });
  });

  it("retains a possibly committed image when authenticated readback also fails", async () => {
    const failure = new Error("response lost");
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: "https://example.test/new.png",
    });
    repository.updateProduct.mockRejectedValue(failure);
    repository.getProductById.mockRejectedValue(new Error("readback failed with sensitive details"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(repository.getProductById).toHaveBeenCalledWith("product-id", "token");
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      "Could not confirm product image update; uploaded image retained for recovery.",
    );
  });

  it("removes a new image when readback confirms the product is missing", async () => {
    const failure = new Error("update failed");
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: "https://example.test/new.png",
    });
    repository.updateProduct.mockRejectedValue(failure);
    repository.getProductById.mockResolvedValue(null);

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(deleteProductImage).toHaveBeenCalledWith("product-id/new.png", "token");
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("keeps a committed image when a data change listener throws", async () => {
    const failure = new Error("listener failed");
    const updated = { id: "product-id", image_url: "https://example.test/new.png" };
    uploadProductImage.mockResolvedValue({
      objectPath: "product-id/new.png", imageUrl: updated.image_url,
    });
    repository.updateProduct.mockResolvedValue(updated);
    publishDataChange.mockImplementation(() => { throw failure; });

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(repository.getProductById).not.toHaveBeenCalled();
    expect(deleteProductImage).not.toHaveBeenCalled();
  });

  it("preserves a normal update failure without triggering image readback", async () => {
    const failure = new Error("update failed");
    repository.updateProduct.mockRejectedValue(failure);

    await expect(updateProduct("product-id", { name: "Updated" }, "token")).rejects.toBe(failure);

    expect(repository.getProductById).not.toHaveBeenCalled();
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
  });

  it("leaves the product unchanged when an inline image upload fails", async () => {
    const failure = new Error("storage unavailable");
    uploadProductImage.mockRejectedValue(failure);

    await expect(updateProduct("product-id", { image_url: EMBEDDED_IMAGE }, "token"))
      .rejects.toBe(failure);

    expect(repository.updateProduct).not.toHaveBeenCalled();
    expect(deleteProductImage).not.toHaveBeenCalled();
    expect(publishDataChange).not.toHaveBeenCalled();
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
