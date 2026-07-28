import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/category.service.js", () => ({
  listCategories: vi.fn(),
  getCategory: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

import * as CategoryService from "../../services/category.service.js";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} from "../../controller/category.controller.js";

const createResponse = () => {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
};

describe("category controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all categories with a count", async () => {
    const categories = [{ id: "1", name: "Wet Goods" }];
    CategoryService.listCategories.mockResolvedValue(categories);
    const res = createResponse();
    const next = vi.fn();

    await getAllCategories(
      { query: { search: "wet", sort: "name", order: "asc" } },
      res,
      next,
    );

    expect(CategoryService.listCategories).toHaveBeenCalledWith({
      search: "wet",
      sort: "name",
      order: "asc",
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 1, data: categories });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 404 when a category does not exist", async () => {
    CategoryService.getCategory.mockRejectedValue(
      Object.assign(new Error("Category not found."), { statusCode: 404 }),
    );
    const next = vi.fn();

    await getCategoryById({ params: { id: "missing" } }, createResponse(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 404 }));
  });

  it("creates a category with the authenticated access token", async () => {
    const category = { id: "1", name: "Dry Goods" };
    CategoryService.createCategory.mockResolvedValue(category);
    const res = createResponse();
    const next = vi.fn();

    await createCategory(
      { body: { name: "Dry Goods" }, accessToken: "token" },
      res,
      next,
    );

    expect(CategoryService.createCategory).toHaveBeenCalledWith({ name: "Dry Goods" }, "token");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data).toEqual(category);
  });

  it("updates an existing category", async () => {
    const category = { id: "1", name: "Frozen" };
    CategoryService.updateCategory.mockResolvedValue(category);
    const res = createResponse();

    await updateCategory(
      { params: { id: "1" }, body: { name: "Frozen" }, accessToken: "token" },
      res,
      vi.fn(),
    );

    expect(CategoryService.updateCategory).toHaveBeenCalledWith(
      "1",
      { name: "Frozen" },
      "token",
    );
    expect(res.json.mock.calls[0][0].data).toEqual(category);
  });

  it("deletes an existing category", async () => {
    CategoryService.deleteCategory.mockResolvedValue();
    const res = createResponse();

    await deleteCategory(
      { params: { id: "1" }, accessToken: "token" },
      res,
      vi.fn(),
    );

    expect(CategoryService.deleteCategory).toHaveBeenCalledWith("1", "token");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Category deleted successfully.",
    });
  });
});
