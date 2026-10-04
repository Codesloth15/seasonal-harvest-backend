// Cards are built from backend records, never from model-generated text or URLs.
export const productCardsFromTool = (name, result) => {
  let products = [];
  if (name === "search_products") products = result.products || [];
  if (name === "get_product") products = result ? [result] : [];
  if (name === "get_low_stock_items") products = result.items || [];
  if (name === "analyze_inventory_movement") {
    products = ["fastMoving", "slowMoving", "nonMoving", "lowStock", "highStock", "reorderSuggestions"]
      .flatMap((key) => result[key] || []);
  }
  return products.filter((product) => product.id || product.productId).map((product) => {
    const conversion = Number(product.unitsPerPackage);
    const packaged = product.packageUnit && conversion > 0;
    return {
      id: product.id || product.productId,
      name: product.name || "Unknown product",
      brand: (typeof product.brand === "string" ? product.brand : product.brand?.name) || "Unbranded",
      imageUrl: product.imageUrl || product.image_url || null,
      ...(product.displayQuantity !== undefined ? {
        quantity: product.displayQuantity, unit: product.displayUnit,
      } : product.availableQuantity !== undefined ? {
        quantity: packaged ? Number((product.availableQuantity / conversion).toFixed(2)) : product.availableQuantity,
        unit: packaged ? product.packageUnit : product.baseUnit,
      } : {}),
    };
  });
};
