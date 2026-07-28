import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../model/inventory.model.js", () => ({
  getAllInventory: vi.fn(),
  getInventoryById: vi.fn(),
  createInventory: vi.fn(),
  updateInventory: vi.fn(),
  adjustStock: vi.fn(),
  deleteInventory: vi.fn(),
  getInventorySummary: vi.fn(),
  getLowStockItems: vi.fn(),
}));

import * as InventoryRepository from "../../model/inventory.model.js";
import * as InventoryService from "../../services/inventory.service.js";

describe("inventory service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a normalized inventory item for the authenticated user", async () => {
    InventoryRepository.createInventory.mockResolvedValue({ id: "1" });
    await InventoryService.createInventoryItem(
      { name: "Chicken", category: "Wet", price: 100 },
      "user-1",
      "token",
    );
    expect(InventoryRepository.createInventory).toHaveBeenCalledWith(
      {
        name: "Chicken",
        category: "Wet",
        price: 100,
        stock_qty: 0,
        low_stock_threshold: 10,
        description: null,
        created_by: "user-1",
      },
      "token",
    );
  });

  it("rejects missing required creation fields", () => {
    expect(() => InventoryService.createInventoryItem({}, "user-1", "token")).toThrow(
      "Name, category, and price are required.",
    );
  });

  it("throws a typed 404 for a missing item", async () => {
    InventoryRepository.getInventoryById.mockResolvedValue(null);
    await expect(InventoryService.getInventoryItem("missing")).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("allows explicit zero values during updates", async () => {
    InventoryRepository.getInventoryById.mockResolvedValue({ id: "1" });
    InventoryRepository.updateInventory.mockResolvedValue({ id: "1", price: 0 });
    await InventoryService.updateInventoryItem("1", { price: 0 }, "token");
    expect(InventoryRepository.updateInventory).toHaveBeenCalledWith("1", { price: 0 }, "token");
  });

  it("rejects non-finite stock adjustments", () => {
    expect(() => InventoryService.adjustInventoryStock("1", Number.NaN, "token")).toThrow(
      "finite number",
    );
  });

  it("forwards valid stock adjustments with authentication", async () => {
    InventoryRepository.adjustStock.mockResolvedValue({ id: "1", stock_qty: 4 });
    await InventoryService.adjustInventoryStock("1", -1, "token");
    expect(InventoryRepository.adjustStock).toHaveBeenCalledWith("1", -1, "token");
  });
});
