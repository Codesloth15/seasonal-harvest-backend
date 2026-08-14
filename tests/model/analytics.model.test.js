import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAuthenticatedSupabaseClient, from, transactionQuery } = vi.hoisted(() => {
  const transactionQuery = {
    gte: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
  };
  transactionQuery.gte.mockReturnValue(transactionQuery);
  transactionQuery.lt.mockReturnValue(transactionQuery);

  const from = vi.fn();
  return {
    transactionQuery,
    from,
    createAuthenticatedSupabaseClient: vi.fn(() => ({ from })),
  };
});

vi.mock("../../config/supabase.js", () => ({ createAuthenticatedSupabaseClient }));

import {
  getDashboardSourceData,
  getDashboardTransactionLog,
} from "../../model/analytics.model.js";

describe("analytics model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionQuery.gte.mockReturnValue(transactionQuery);
    transactionQuery.lt.mockReturnValue(transactionQuery);
    from.mockImplementation((table) => {
      if (table === "products") {
        return { select: vi.fn().mockResolvedValue({ data: [{ id: "p1" }], error: null }) };
      }
      if (table === "inventory") {
        return { select: vi.fn().mockResolvedValue({ data: [{ id: "i1" }], error: null }) };
      }
      return { select: vi.fn(() => transactionQuery) };
    });
    transactionQuery.order.mockResolvedValue({ data: [{ operation: "ADD" }], error: null });
  });

  it("loads dashboard sources with the caller's RLS context and date range", async () => {
    const result = await getDashboardSourceData({
      from: "2026-08-01T00:00:00.000Z",
      toExclusive: "2026-09-01T00:00:00.000Z",
    }, "token");

    expect(createAuthenticatedSupabaseClient).toHaveBeenCalledWith("token");
    expect(from).toHaveBeenCalledWith("products");
    expect(from).toHaveBeenCalledWith("inventory");
    expect(from).toHaveBeenCalledWith("inventory_transactions");
    expect(transactionQuery.gte).toHaveBeenCalledWith("created_at", "2026-08-01T00:00:00.000Z");
    expect(transactionQuery.lt).toHaveBeenCalledWith("created_at", "2026-09-01T00:00:00.000Z");
    expect(result).toEqual({
      products: [{ id: "p1" }],
      inventory: [{ id: "i1" }],
      transactions: [{ operation: "ADD" }],
    });
  });

  it("propagates a Supabase query error", async () => {
    const error = new Error("database unavailable");
    transactionQuery.order.mockResolvedValue({ data: null, error });
    await expect(getDashboardSourceData({ from: "from", toExclusive: "to" }, "token"))
      .rejects.toBe(error);
  });

  it("returns a filtered paginated transaction log", async () => {
    const logQuery = {
      order: vi.fn(), gte: vi.fn(), lt: vi.fn(), eq: vi.fn(), range: vi.fn(),
    };
    logQuery.order.mockReturnValue(logQuery);
    logQuery.gte.mockReturnValue(logQuery);
    logQuery.lt.mockReturnValue(logQuery);
    logQuery.eq.mockReturnValue(logQuery);
    logQuery.range.mockResolvedValue({
      data: [{ id: "tx-1" }], error: null, count: 21,
    });
    from.mockReturnValue({ select: vi.fn(() => logQuery) });

    const result = await getDashboardTransactionLog({
      page: 2,
      limit: 20,
      from: "2026-08-01T00:00:00.000Z",
      toExclusive: "2026-09-01T00:00:00.000Z",
      operation: "ADD",
      transactionType: "STOCK_RECEIVED",
    }, "token");

    expect(logQuery.gte).toHaveBeenCalledWith("created_at", "2026-08-01T00:00:00.000Z");
    expect(logQuery.lt).toHaveBeenCalledWith("created_at", "2026-09-01T00:00:00.000Z");
    expect(logQuery.eq).toHaveBeenCalledWith("operation", "ADD");
    expect(logQuery.eq).toHaveBeenCalledWith("transaction_type", "STOCK_RECEIVED");
    expect(logQuery.range).toHaveBeenCalledWith(20, 39);
    expect(result).toEqual({
      items: [{ id: "tx-1" }],
      pagination: { page: 2, limit: 20, total: 21, totalPages: 2 },
    });
  });
});
