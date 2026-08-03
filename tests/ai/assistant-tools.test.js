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

import * as BrandService from "../../services/brand.service.js";
import * as CategoryService from "../../services/category.service.js";
import { assistantTools, runAssistantTool } from "../../ai/tools/assistant-tools.js";

describe("assistant tools", () => {
  beforeEach(() => vi.clearAllMocks());

  it("publishes read-only brand and category search tools", () => {
    const names = assistantTools.map(({ name }) => name);
    expect(names).toContain("search_brands");
    expect(names).toContain("search_categories");
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
});
