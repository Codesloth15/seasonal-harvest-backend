import { beforeEach, describe, expect, it, vi } from "vitest";

const { publicBuilder, userBuilder, createAuthenticatedSupabaseClient } = vi.hoisted(() => {
  const publicBuilder = {
    select: vi.fn(),
    order: vi.fn(),
  };
  publicBuilder.select.mockReturnValue(publicBuilder);

  const userBuilder = {
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    maybeSingle: vi.fn(),
  };

  for (const method of ["delete", "eq", "select"]) {
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

vi.mock("../../services/sku.service.js", () => ({ generateSku: vi.fn() }));

import { deleteProduct, getAllProducts } from "../../model/product.model.js";

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
});
