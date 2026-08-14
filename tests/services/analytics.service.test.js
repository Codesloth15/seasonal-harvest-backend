import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../model/analytics.model.js", () => ({
  getDashboardSourceData: vi.fn(),
  getDashboardTransactionLog: vi.fn(),
}));

import * as AnalyticsRepository from "../../model/analytics.model.js";
import {
  getDashboardAnalytics,
  getDashboardTransactions,
} from "../../services/analytics.service.js";

describe("analytics service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AnalyticsRepository.getDashboardSourceData.mockResolvedValue({
      products: [
        { id: "p1", product_type: "BRANDED", is_active: true },
        { id: "p2", product_type: "UNBRANDED", is_active: true },
        { id: "p3", product_type: "BRANDED", is_active: false },
      ],
      inventory: [
        { quantity_on_hand: "10", reserved_quantity: "2", available_quantity: "8", low_stock_threshold: "5", product: { price: "20", is_active: true } },
        { quantity_on_hand: "2", reserved_quantity: "0", available_quantity: "2", low_stock_threshold: "3", product: { price: "50", is_active: true } },
        { quantity_on_hand: "0", reserved_quantity: "0", available_quantity: "0", low_stock_threshold: "1", product: { price: "99", is_active: false } },
      ],
      transactions: [
        { operation: "ADD", quantity_change: "10", created_at: "2026-08-01T10:00:00Z" },
        { operation: "SUBTRACT", quantity_change: "-3", created_at: "2026-08-01T12:00:00Z" },
        { operation: "ADD", quantity_change: "4", created_at: "2026-08-02T10:00:00Z" },
      ],
    });
    AnalyticsRepository.getDashboardTransactionLog.mockResolvedValue({
      items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it("returns catalog, inventory, and daily movement dashboard metrics", async () => {
    const result = await getDashboardAnalytics(
      { from: "2026-08-01", to: "2026-08-02", granularity: "day" },
      "token",
    );

    expect(AnalyticsRepository.getDashboardSourceData).toHaveBeenCalledWith({
      from: "2026-08-01T00:00:00.000Z",
      toExclusive: "2026-08-03T00:00:00.000Z",
    }, "token");
    expect(result.catalog).toEqual({
      totalProducts: 3, activeProducts: 2, inactiveProducts: 1,
      brandedProducts: 2, unbrandedProducts: 1,
    });
    expect(result.inventory).toEqual({
      inventoryItemCount: 2,
      totalQuantityOnHand: 12,
      totalReservedQuantity: 2,
      totalAvailableQuantity: 10,
      inventoryRetailValue: 300,
      lowStockCount: 1,
      outOfStockCount: 0,
      currency: "PHP",
    });
    expect(result.movements).toMatchObject({
      transactionCount: 3, totalAdditions: 14, totalSubtractions: 3, netChange: 11,
    });
    expect(result.movements.series).toEqual([
      { period: "2026-08-01", additions: 10, subtractions: 3, netChange: 7, transactionCount: 2 },
      { period: "2026-08-02", additions: 4, subtractions: 0, netChange: 4, transactionCount: 1 },
    ]);
  });

  it("defaults to the latest 30 UTC calendar days", async () => {
    const result = await getDashboardAnalytics({}, "token", new Date("2026-08-14T18:00:00Z"));
    expect(result.range).toEqual({ from: "2026-07-16", to: "2026-08-14", granularity: "day" });
  });

  it("groups movement trends by Monday-based week", async () => {
    const result = await getDashboardAnalytics(
      { from: "2026-08-01", to: "2026-08-10", granularity: "week" },
      "token",
    );
    expect(result.movements.series.map((item) => item.period)).toEqual(["2026-07-27"]);
  });

  it.each([
    [{ from: "2026/08/01" }, "YYYY-MM-DD"],
    [{ from: "2026-02-30" }, "valid calendar date"],
    [{ from: "2026-08-02", to: "2026-08-01" }, "on or before"],
    [{ from: "2025-01-01", to: "2026-08-01" }, "366 days"],
    [{ granularity: "hour" }, "day, week, or month"],
  ])("rejects invalid filters", async (filters, message) => {
    await expect(getDashboardAnalytics(filters, "token", new Date("2026-08-14T00:00:00Z")))
      .rejects.toThrow(message);
    expect(AnalyticsRepository.getDashboardSourceData).not.toHaveBeenCalled();
  });

  it("normalizes and forwards paginated global transaction-log filters", async () => {
    await getDashboardTransactions({
      from: "2026-08-01", to: "2026-08-31", operation: " add ",
      transactionType: " stock_received ", page: "2", limit: "25",
    }, "token");

    expect(AnalyticsRepository.getDashboardTransactionLog).toHaveBeenCalledWith({
      from: "2026-08-01T00:00:00.000Z",
      toExclusive: "2026-09-01T00:00:00.000Z",
      operation: "ADD",
      transactionType: "STOCK_RECEIVED",
      page: 2,
      limit: 25,
    }, "token");
  });

  it.each([
    [{ page: "0" }, "positive integer"],
    [{ limit: "101" }, "between 1 and 100"],
    [{ operation: "MOVE" }, "ADD or SUBTRACT"],
    [{ transactionType: "SALE" }, "not supported"],
    [{ from: "2026-08-02", to: "2026-08-01" }, "on or before"],
  ])("rejects invalid transaction-log filters", async (filters, message) => {
    await expect(getDashboardTransactions(filters, "token")).rejects.toThrow(message);
    expect(AnalyticsRepository.getDashboardTransactionLog).not.toHaveBeenCalled();
  });
});
