import * as InventoryService from "../../services/inventory.service.js";
import * as ProductService from "../../services/product.service.js";

export const assistantTools = [
  {
    type: "function",
    name: "search_products",
    description: "Search the active product catalog by product name.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        search: { type: ["string", "null"], description: "Optional product-name search." },
      },
      required: ["search"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_product",
    description: "Get one catalog product by its UUID.",
    strict: true,
    parameters: {
      type: "object",
      properties: { id: { type: "string", description: "Product UUID." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "get_inventory_summary",
    description: "Get inventory totals, value, quantity, average price, and low-stock count.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    type: "function",
    name: "get_low_stock_items",
    description: "Get active inventory items at or below their configured low-stock threshold.",
    strict: true,
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

const handlers = {
  search_products: async ({ search }) => {
    const products = await ProductService.listProducts({
      search: search || undefined,
      active: true,
      sort: "name",
      order: "asc",
    });
    return { count: products.length, products: products.slice(0, 50), truncated: products.length > 50 };
  },
  get_product: ({ id }) => ProductService.getProduct(id),
  get_inventory_summary: () => InventoryService.getInventorySummary(),
  get_low_stock_items: async () => {
    const items = await InventoryService.getLowStockItems();
    return { count: items.length, items: items.slice(0, 50), truncated: items.length > 50 };
  },
};

export const runAssistantTool = async (name, argumentsJson) => {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unsupported AI tool: ${name}`);

  let args;
  try {
    args = JSON.parse(argumentsJson || "{}");
  } catch {
    throw new Error(`Invalid arguments for AI tool: ${name}`);
  }

  return handler(args);
};
