import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../model/category.model.js", () => ({
  getAllCategories: vi.fn(),
  getCategoryById: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import * as CategoryRepository from "../../model/category.model.js";
import * as CategoryService from "../../services/category.service.js";

describe("category service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delegates list filters to the repository", async () => {
    const categories = [{ id: "1" }];
    CategoryRepository.getAllCategories.mockResolvedValue(categories);
    await expect(CategoryService.listCategories({ search: "wet" })).resolves.toEqual(categories);
  });

  it("throws a typed 404 when a category is missing", async () => {
    CategoryRepository.getCategoryById.mockResolvedValue(null);
    await expect(CategoryService.getCategory("missing")).rejects.toMatchObject({
      name: "HttpError",
      statusCode: 404,
    });
  });

  it("forwards authenticated category creation", async () => {
    CategoryRepository.createCategory.mockResolvedValue({ id: "1" });
    await CategoryService.createCategory({ name: "Wet" }, "token");
    expect(CategoryRepository.createCategory).toHaveBeenCalledWith({ name: "Wet" }, "token");
  });

  it("throws a typed 404 when update affects no category", async () => {
    CategoryRepository.updateCategory.mockResolvedValue(null);
    await expect(CategoryService.updateCategory("missing", {}, "token")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("throws a typed 404 when delete affects no category", async () => {
    CategoryRepository.deleteCategory.mockResolvedValue(null);
    await expect(CategoryService.deleteCategory("missing", "token")).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
