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

import { getAllInventory, getInventorySummary } from "../../model/inventory.model.js";

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

  it("uses the authenticated client for inventory summaries", async () => {
    query.select.mockResolvedValue({
      data: [{
        id: "inventory-1",
        quantity_on_hand: 4,
        available_quantity: 2,
        low_stock_threshold: 3,
        product: { price: 5 },
      }],
      error: null,
    });

    const summary = await getInventorySummary("token");

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(summary).toMatchObject({
      lowStockCount: 1,
      totalItems: 1,
      totalQuantity: 4,
    });
  });
});
