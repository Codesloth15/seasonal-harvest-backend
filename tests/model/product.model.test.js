import { beforeEach, describe, expect, it, vi } from "vitest";

const { userBuilder, createAuthenticatedSupabaseClient } = vi.hoisted(() => {
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
    userBuilder,
    createAuthenticatedSupabaseClient: vi.fn(() => ({
      from: vi.fn(() => userBuilder),
    })),
  };
});

vi.mock("../../config/supabase.js", () => ({
  default: { from: vi.fn() },
  createAuthenticatedSupabaseClient,
}));

vi.mock("../../services/sku.service.js", () => ({ generateSku: vi.fn() }));

import { deleteProduct } from "../../model/product.model.js";

describe("product model", () => {
  beforeEach(() => vi.clearAllMocks());

  it("permanently deletes a product using the authenticated client", async () => {
    const product = { id: "product-id", name: "Tomato" };
    userBuilder.maybeSingle.mockResolvedValue({ data: product, error: null });

    await expect(deleteProduct("product-id", "token")).resolves.toMatchObject(product);

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(userBuilder.delete).toHaveBeenCalledWith();
    expect(userBuilder.eq).toHaveBeenCalledWith("id", "product-id");
  });
});
