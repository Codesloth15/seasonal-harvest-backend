import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/inventory.service.js", () => ({
  adjustInventoryStock: vi.fn(),
  getInventoryTransactions: vi.fn(),
  configureInventoryPackaging: vi.fn(),
}));

import { adjustInventory, getInventoryTransactions } from "../../controller/inventory.controller.js";
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

  it("returns paginated inventory transaction history", async () => {
    const result = {
      items: [{ id: "transaction-1", operation: "ADD" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    InventoryService.getInventoryTransactions.mockResolvedValue(result);
    const res = { status: vi.fn(), json: vi.fn() };
    res.status.mockReturnValue(res);
    const next = vi.fn();

    await getInventoryTransactions(
      { params: { id: "inventory-id" }, query: { operation: "ADD" }, accessToken: "token" },
      res,
      next,
    );

    expect(InventoryService.getInventoryTransactions).toHaveBeenCalledWith(
      "inventory-id", { operation: "ADD" }, "token",
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
