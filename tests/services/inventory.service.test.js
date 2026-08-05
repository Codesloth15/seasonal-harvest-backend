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

  it("rejects negative stock adjustment quantities", async () => {
    await expect(InventoryService.adjustInventoryStock("1", {
      operation: "ADD", quantity: -1, transaction_type: "MANUAL_ADJUSTMENT",
      reason: "Count correction", performed_by: "user-1",
    }, "token")).rejects.toThrow("positive number");
  });

  it("forwards normalized operation-based adjustments with authentication", async () => {
    InventoryRepository.adjustStock.mockResolvedValue({ previous_quantity: 5, quantity_change: -1, new_quantity: 4 });
    await InventoryService.adjustInventoryStock("1", {
      operation: "subtract", quantity: 1, transaction_type: "damaged",
      reason: " Damaged pack ", performed_by: " user-1 ",
    }, "token");
    expect(InventoryRepository.adjustStock).toHaveBeenCalledWith("1", {
      operation: "SUBTRACT", quantity: 1, transaction_type: "DAMAGED",
      reason: "Damaged pack", performed_by: "user-1",
    }, "token");
  });

  it("rejects an operation that conflicts with the transaction type", async () => {
    await expect(InventoryService.adjustInventoryStock("1", {
      operation: "ADD", quantity: 1, transaction_type: "DAMAGED",
      reason: "Damaged pack", performed_by: "user-1",
    }, "token")).rejects.toThrow("DAMAGED adjustments must use SUBTRACT");
  });

  it("returns a typed bad request when available stock is insufficient", async () => {
    InventoryRepository.adjustStock.mockRejectedValue(new Error("Insufficient stock for this adjustment."));
    await expect(InventoryService.adjustInventoryStock("1", {
      operation: "SUBTRACT", quantity: 10, transaction_type: "MISSING",
      reason: "Missing", performed_by: "user-1",
    }, "token")).rejects.toMatchObject({ statusCode: 400, message: "Insufficient stock for this adjustment." });
  });
});
