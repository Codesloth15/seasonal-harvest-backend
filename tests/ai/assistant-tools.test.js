import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../services/inventory.service.js", () => ({
  getInventorySummary: vi.fn(),
  getLowStockItems: vi.fn(),
}));
vi.mock("../../services/product.service.js", () => ({
  listProducts: vi.fn(),
  getProduct: vi.fn(),
}));
vi.mock("../../services/brand.service.js", () => ({ listBrands: vi.fn() }));
vi.mock("../../services/category.service.js", () => ({ listCategories: vi.fn() }));
vi.mock("../../services/analytics.service.js", () => ({ getInventoryMovementAnalysis: vi.fn() }));

import * as BrandService from "../../services/brand.service.js";
import * as CategoryService from "../../services/category.service.js";
import * as InventoryService from "../../services/inventory.service.js";
import * as AnalyticsService from "../../services/analytics.service.js";
import { assistantTools, runAssistantTool } from "../../ai/tools/assistant-tools.js";

describe("assistant tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes read-only brand and category search tools", () => {
    const names = assistantTools.map(({ name }) => name);
    expect(names).toContain("search_brands");
    expect(names).toContain("search_categories");
    expect(names).toContain("analyze_inventory_movement");
  });

  it("searches and bounds brand results", async () => {
    BrandService.listBrands.mockResolvedValue(
      Array.from({ length: 51 }, (_, index) => ({ id: index, name: `Brand ${index}` })),
    );

    const result = await runAssistantTool("search_brands", JSON.stringify({ search: "fresh" }));

    expect(BrandService.listBrands).toHaveBeenCalledWith({
      search: "fresh",
      active: true,
      sort: "name",
      order: "asc",
    });
    expect(result).toMatchObject({ count: 51, truncated: true });
    expect(result.brands).toHaveLength(50);
  });

  it("searches categories without a query", async () => {
    CategoryService.listCategories.mockResolvedValue([{ id: "category-1", name: "Fruit" }]);

    const result = await runAssistantTool("search_categories", JSON.stringify({ search: null }));

    expect(CategoryService.listCategories).toHaveBeenCalledWith({
      search: undefined,
      active: true,
      sort: "name",
      order: "asc",
    });
    expect(result).toMatchObject({ count: 1, truncated: false });
  });

  it("rejects unsupported tools and malformed tool arguments", async () => {
    await expect(runAssistantTool("delete_product", "{}")).rejects.toThrow("Unsupported AI tool");
    await expect(runAssistantTool("search_brands", "{" )).rejects.toThrow("Invalid arguments");
  });

  it("runs movement analysis with the authenticated access token", async () => {
    AnalyticsService.getInventoryMovementAnalysis.mockResolvedValue({ fastMoving: [] });
    await runAssistantTool(
      "analyze_inventory_movement",
      { days: 30, leadTimeDays: 7, safetyStockDays: 3, limit: 10 },
      { accessToken: "token" },
    );
    expect(AnalyticsService.getInventoryMovementAnalysis).toHaveBeenCalledWith(
      { days: 30, leadTimeDays: 7, safetyStockDays: 3, limit: 10 }, "token",
    );
  });

  it("formats low-stock quantities using configured packaging", async () => {
    InventoryService.getLowStockItems.mockResolvedValue([
      { available_quantity: 0, low_stock_threshold: 5, base_unit: "PIECE", package_unit: "SACK", units_per_package: 20, product: { name: "Kikiam" } },
      { available_quantity: 60, low_stock_threshold: 75, base_unit: "PIECE", package_unit: "BOX", units_per_package: 12, product: { name: "Hotdog" } },
      { available_quantity: 3, low_stock_threshold: 5, base_unit: "KILO", package_unit: null, units_per_package: null, product: { name: "Chicken" } },
    ]);

    const result = await runAssistantTool("get_low_stock_items", {}, { accessToken: "admin-token" });

    expect(InventoryService.getLowStockItems).toHaveBeenCalledWith("admin-token");
    expect(result.items).toEqual([
      expect.objectContaining({ name: "Kikiam", displayQuantity: 0, displayUnit: "SACK" }),
      expect.objectContaining({ name: "Hotdog", displayQuantity: 5, displayUnit: "BOX" }),
      expect.objectContaining({ name: "Chicken", displayQuantity: 3, displayUnit: "KILO" }),
    ]);
  });
});
