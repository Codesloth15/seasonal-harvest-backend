import { describe, expect, it, vi } from "vitest";

vi.mock("../../services/analytics.service.js", () => ({
  getDashboardAnalytics: vi.fn(),
  getDashboardTransactions: vi.fn(),
}));

import {
  getDashboardAnalytics,
  getDashboardTransactions,
} from "../../services/analytics.service.js";
import { getDashboard, getTransactions } from "../../controller/analytics.controller.js";

const response = () => {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
};

describe("analytics controller", () => {
  it("passes query filters and the authenticated access token", async () => {
    const data = { catalog: { totalProducts: 2 } };
    getDashboardAnalytics.mockResolvedValue(data);
    const res = response();
    const next = vi.fn();

    await getDashboard(
      { query: { granularity: "week" }, accessToken: "token" },
      res,
      next,
    );

    expect(getDashboardAnalytics).toHaveBeenCalledWith({ granularity: "week" }, "token");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data });
    expect(next).not.toHaveBeenCalled();
  });

  it("forwards analytics errors", async () => {
    const error = new Error("query failed");
    getDashboardAnalytics.mockRejectedValue(error);
    const next = vi.fn();
    await getDashboard({ query: {}, accessToken: "token" }, response(), next);
    expect(next).toHaveBeenCalledWith(error);
  });

  it("returns paginated dashboard transaction logs", async () => {
    const result = {
      items: [{ id: "tx-1" }],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };
    getDashboardTransactions.mockResolvedValue(result);
    const res = response();
    const next = vi.fn();

    await getTransactions({ query: { page: "1" }, accessToken: "token" }, res, next);

    expect(getDashboardTransactions).toHaveBeenCalledWith({ page: "1" }, "token");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
    expect(next).not.toHaveBeenCalled();
  });
});
