import { describe, expect, it, vi } from "vitest";

const { rpc, client } = vi.hoisted(() => {
  const rpc = vi.fn();
  return { rpc, client: vi.fn(() => ({ rpc })) };
});
vi.mock("../../config/supabase.js", () => ({ createAuthenticatedSupabaseClient: client }));
import { generateSku } from "../../services/sku.service.js";

describe("SKU allocation", () => {
  it.each([
    ["C.D.O.", "Chicken breast", "CDO-CHICKEN"],
    ["UNBRANDED", "Tomato", "UNB-TOMATO"],
  ])("allocates %s products using the caller's authenticated client", async (brand, name, prefix) => {
    rpc.mockResolvedValue({ data: `${prefix}-1000`, error: null });
    await expect(generateSku(brand, name, "user-token")).resolves.toBe(`${prefix}-1000`);
    expect(client).toHaveBeenCalledWith("user-token");
    expect(rpc).toHaveBeenCalledWith("allocate_product_sku", { p_prefix: prefix });
  });

  it("propagates allocation failures without unsafe fallback", async () => {
    const error = { code: "42501", message: "Forbidden" };
    rpc.mockResolvedValue({ data: null, error });
    await expect(generateSku("CDO", "Chicken", "token")).rejects.toEqual(error);
  });
});
