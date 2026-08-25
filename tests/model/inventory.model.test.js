import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthenticatedSupabaseClient, from, query } = vi.hoisted(() => {
  const query = { select: vi.fn(), order: vi.fn() };
  query.select.mockReturnValue(query);
  query.order.mockResolvedValue({ data: [], error: null });
  const from = vi.fn(() => query);

  return {
    query,
    from,
    createAuthenticatedSupabaseClient: vi.fn(() => ({ from })),
  };
});

vi.mock("../../config/supabase.js", () => ({
  default: { from },
  createAuthenticatedSupabaseClient,
}));

import { getAllInventory } from "../../model/inventory.model.js";

describe("inventory model product details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.select.mockReturnValue(query);
    query.order.mockResolvedValue({ data: [], error: null });
  });

  it("includes the product's brand in inventory list responses", async () => {
    await getAllInventory({}, "token");

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    const select = query.select.mock.calls[0][0];
    expect(select).toContain("product_type");
    expect(select).toContain("brand_id");
    expect(select).toContain("brand:brands(id, name, logo_url, is_active)");
  });
});
