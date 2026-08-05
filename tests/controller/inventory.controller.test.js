import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/inventory.service.js", () => ({
  adjustInventoryStock: vi.fn(),
}));

import { adjustInventory } from "../../controller/inventory.controller.js";
import * as InventoryService from "../../services/inventory.service.js";

describe("inventory controller", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the inventory adjustment quantities", async () => {
    const data = { previous_quantity: 40, quantity_change: -3, new_quantity: 37 };
    InventoryService.adjustInventoryStock.mockResolvedValue(data);
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();
    const body = {
      operation: "SUBTRACT", quantity: 3, transaction_type: "DAMAGED",
      reason: "Three packs were damaged", performed_by: "spoofed-user-id",
    };

    await adjustInventory(
      { params: { id: "inventory-id" }, body, accessToken: "token", user: { id: "auth-user-id" } },
      res,
      next,
    );

    expect(InventoryService.adjustInventoryStock).toHaveBeenCalledWith(
      "inventory-id", { ...body, performed_by: "auth-user-id" }, "token",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Inventory adjusted successfully.",
      data,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
