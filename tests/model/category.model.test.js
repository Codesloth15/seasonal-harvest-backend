import { beforeEach, describe, expect, it, vi } from "vitest";

const { publicBuilder, userBuilder, publicFrom, createAuthenticatedSupabaseClient } =
  vi.hoisted(() => {
    const makeBuilder = () => {
      const builder = {
        select: vi.fn(),
        ilike: vi.fn(),
        order: vi.fn(),
        eq: vi.fn(),
        maybeSingle: vi.fn(),
        insert: vi.fn(),
        single: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      };
      for (const method of ["select", "ilike", "order", "eq", "insert", "update", "delete"]) {
        builder[method].mockReturnValue(builder);
      }
      return builder;
    };

    const publicBuilder = makeBuilder();
    const userBuilder = makeBuilder();
    const publicFrom = vi.fn(() => publicBuilder);
    const userFrom = vi.fn(() => userBuilder);

    return {
      publicBuilder,
      userBuilder,
      publicFrom,
      userFrom,
      createAuthenticatedSupabaseClient: vi.fn(() => ({ from: userFrom })),
    };
  });

vi.mock("../../config/supabase.js", () => ({
  default: { from: publicFrom },
  createAuthenticatedSupabaseClient,
}));

import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} from "../../model/category.model.js";

describe("category model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists categories with safe filters and sorting", async () => {
    const categories = [{ id: "1", name: "Wet Goods" }];
    publicBuilder.order.mockResolvedValue({ data: categories, error: null });

    await expect(
      getAllCategories({ search: "wet", sort: "created_at", order: "desc" }),
    ).resolves.toEqual(categories);

    expect(publicBuilder.ilike).toHaveBeenCalledWith("name", "%wet%");
    expect(publicBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("gets one category by ID", async () => {
    const category = { id: "1", name: "Wet Goods" };
    publicBuilder.maybeSingle.mockResolvedValue({ data: category, error: null });

    await expect(getCategoryById("1")).resolves.toEqual(category);
    expect(publicBuilder.eq).toHaveBeenCalledWith("id", "1");
  });

  it("normalizes and creates an allowed category payload", async () => {
    const category = { id: "1", name: "Dry Goods", description: null, icon: "box" };
    userBuilder.single.mockResolvedValue({ data: category, error: null });

    await expect(
      createCategory(
        { name: "  Dry Goods ", description: " ", icon: " box ", ignored: "value" },
        "token",
      ),
    ).resolves.toEqual(category);

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(userBuilder.insert).toHaveBeenCalledWith({
      name: "Dry Goods",
      description: null,
      icon: "box",
    });
  });

  it("rejects category creation without a name", async () => {
    await expect(createCategory({ description: "Missing name" }, "token")).rejects.toMatchObject({
      message: "Category name is required.",
      statusCode: 400,
    });
    expect(createAuthenticatedSupabaseClient).not.toHaveBeenCalled();
  });

  it("rejects updates without supported fields", async () => {
    await expect(updateCategory("1", { ignored: true }, "token")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("updates a category using the authenticated client", async () => {
    const category = { id: "1", name: "Frozen" };
    userBuilder.maybeSingle.mockResolvedValue({ data: category, error: null });

    await expect(updateCategory("1", { name: " Frozen " }, "token")).resolves.toEqual(category);
    expect(userBuilder.update).toHaveBeenCalledWith({ name: "Frozen" });
  });

  it("deletes a category using the authenticated client", async () => {
    const category = { id: "1", name: "Frozen" };
    userBuilder.maybeSingle.mockResolvedValue({ data: category, error: null });

    await expect(deleteCategory("1", "token")).resolves.toEqual(category);
    expect(userBuilder.delete).toHaveBeenCalledWith();
  });
});
