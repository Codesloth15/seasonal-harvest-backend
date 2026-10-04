import { describe, expect, it } from "vitest";
import { productCardsFromTool } from "../../ai/tools/product-cards.js";

describe("assistant product cards", () => {
  it("uses catalog images and brands without inventing stock", () => {
    expect(productCardsFromTool("search_products", { products: [
      { id: "p1", name: "Hotdog", brand: { name: "Acme" }, image_url: "https://example.com/hotdog.jpg" },
    ] })).toEqual([{ id: "p1", name: "Hotdog", brand: "Acme", imageUrl: "https://example.com/hotdog.jpg" }]);
  });

  it("preserves packaged low-stock quantities and missing images", () => {
    expect(productCardsFromTool("get_low_stock_items", { items: [
      { productId: "p1", name: "Hotdog", displayQuantity: 5.5, displayUnit: "BOX" },
    ] })).toEqual([{ id: "p1", name: "Hotdog", brand: "Unbranded", imageUrl: null, quantity: 5.5, unit: "BOX" }]);
  });

  it("converts analytics base quantities into fractional packages", () => {
    expect(productCardsFromTool("analyze_inventory_movement", { lowStock: [
      { productId: "p1", name: "Hotdog", availableQuantity: 66, packageUnit: "BOX", unitsPerPackage: 12 },
    ] })[0]).toMatchObject({ quantity: 5.5, unit: "BOX" });
  });

  it("ignores non-product tools", () => {
    expect(productCardsFromTool("get_inventory_summary", { count: 1 })).toEqual([]);
  });
});
