import { beforeEach, describe, expect, it, vi } from "vitest";

const { publicBuilder, userBuilder, createAuthenticatedSupabaseClient } = vi.hoisted(() => {
  const publicBuilder = {
    select: vi.fn(),
    order: vi.fn(),
  };
  publicBuilder.select.mockReturnValue(publicBuilder);

  const userBuilder = {
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
  };

  for (const method of ["insert", "update", "delete", "eq", "select"]) {
    userBuilder[method].mockReturnValue(userBuilder);
  }

  return {
    publicBuilder,
    userBuilder,
    createAuthenticatedSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => userBuilder),
    })),
  };
});

vi.mock("../../config/supabase.js", () => ({
  default: { from: vi.fn(() => publicBuilder) },
  createAuthenticatedSupabaseClient,
}));

vi.mock("../../services/sku.service.js", () => ({ generateSku: vi.fn(() => "SKU-001") }));

import {
  createProduct,
  deleteProduct,
  getAllProducts,
  updateProduct,
} from "../../model/product.model.js";

describe("product model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes brand details when listing products", async () => {
    publicBuilder.select.mockReturnValue(publicBuilder);
    publicBuilder.order.mockResolvedValue({
      data: [{ id: "product-id", brand: { name: "CDO" } }],
      error: null,
    });

    await expect(getAllProducts()).resolves.toMatchObject([
      { brand: { name: "CDO" }, currency: "PHP" },
    ]);

    expect(publicBuilder.select).toHaveBeenCalledWith(
      "*, brand:brands(id, name, logo_url, is_active)",
    );
  });

  it("permanently deletes a product using the authenticated client", async () => {
    const product = { id: "product-id", name: "Tomato" };
    userBuilder.maybeSingle.mockResolvedValue({ data: product, error: null });

    await expect(deleteProduct("product-id", "token")).resolves.toMatchObject(product);

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(userBuilder.delete).toHaveBeenCalledWith();
    expect(userBuilder.eq).toHaveBeenCalledWith("id", "product-id");
  });

  it("creates a product with a per-piece price and bale conversion", async () => {
    const product = {
      id: "product-id",
      name: "Twine",
      unit: "PIECE",
      package_unit: "BALE",
      units_per_package: 15,
      price: 12.5,
    };
    userBuilder.single.mockResolvedValue({ data: product, error: null });

    await expect(createProduct({
      category_id: "category-id",
      name: "Twine",
      product_type: "UNBRANDED",
      unit: "piece",
      package_unit: "bale",
      units_per_package: "15",
      price: "12.50",
    }, "token")).resolves.toMatchObject({ ...product, currency: "PHP" });

    expect(userBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({
      unit: "PIECE",
      package_unit: "BALE",
      units_per_package: 15,
      price: 12.5,
    }));
  });

  it("rejects incomplete or invalid product packaging", async () => {
    const base = {
      category_id: "category-id",
      name: "Twine",
      product_type: "UNBRANDED",
      price: 12.5,
    };

    await expect(createProduct({ ...base, package_unit: "BALE" }, "token"))
      .rejects.toMatchObject({ statusCode: 400 });
    await expect(createProduct({
      ...base, unit: "PIECE", package_unit: "PIECE", units_per_package: 15,
    }, "token")).rejects.toMatchObject({ statusCode: 400 });
    await expect(updateProduct("product-id", {
      package_unit: "BALE", units_per_package: 1,
    }, "token")).rejects.toMatchObject({ statusCode: 400 });
  });
});
