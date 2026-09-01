import * as InventoryService from "../../services/inventory.service.js";
import * as ProductService from "../../services/product.service.js";
import * as BrandService from "../../services/brand.service.js";
import * as CategoryService from "../../services/category.service.js";
import * as AnalyticsService from "../../services/analytics.service.js";

export const assistantTools = [
  {
    type: "function",
    name: "search_brands",
    description: "Search active brands by name.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional brand-name search." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_categories",
    description: "Search active product categories by name.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional category-name search." },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    type: "function",
    name: "search_products",
    description: "Search the active product catalog by product name.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        search: { type: "string", description: "Optional product-name search." },
      },
      required: [],
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
  {
    type: "function",
    name: "analyze_inventory_movement",
    description: "Rank fast-, slow-, and non-moving products, show low/high stock, and calculate transparent reorder suggestions from outbound stock movements.",
    strict: true,
    parameters: {
      type: "object",
      properties: {
        days: { type: "integer", description: "Analysis window in days, 1 to 366." },
        leadTimeDays: { type: "integer", description: "Supplier lead time in days, 1 to 90." },
        safetyStockDays: { type: "integer", description: "Extra demand coverage in days, 1 to 90." },
        limit: { type: "integer", description: "Maximum products per ranking, 1 to 50." },
      },
      required: [],
      additionalProperties: false,
    },
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
  search_brands: async ({ search }) => {
    const brands = await BrandService.listBrands({
      search: search || undefined,
      active: true,
      sort: "name",
      order: "asc",
    });
    return { count: brands.length, brands: brands.slice(0, 50), truncated: brands.length > 50 };
  },
  search_categories: async ({ search }) => {
    const categories = await CategoryService.listCategories({
      search: search || undefined,
      active: true,
      sort: "name",
      order: "asc",
    });
    return {
      count: categories.length,
      categories: categories.slice(0, 50),
      truncated: categories.length > 50,
    };
  },
  get_inventory_summary: () => InventoryService.getInventorySummary(),
  get_low_stock_items: async (_args, context) => {
    const items = await InventoryService.getLowStockItems(context.accessToken);
    const formattedItems = items.slice(0, 50).map((item) => {
      const availableBaseQuantity = Number(item.available_quantity ?? 0);
      const unitsPerPackage = Number(item.units_per_package ?? 0);
      const hasPackageConversion = Boolean(item.package_unit) && unitsPerPackage > 0;
      const displayQuantity = hasPackageConversion
        ? Number((availableBaseQuantity / unitsPerPackage).toFixed(2))
        : availableBaseQuantity;
      return {
        name: item.product?.name || "Unknown product",
        displayQuantity,
        displayUnit: hasPackageConversion ? item.package_unit : item.base_unit || item.product?.unit,
        availableBaseQuantity,
        baseUnit: item.base_unit || item.product?.unit,
        unitsPerPackage: hasPackageConversion ? unitsPerPackage : null,
        lowStockThreshold: Number(item.low_stock_threshold ?? 0),
      };
    });
    return { count: items.length, items: formattedItems, truncated: items.length > 50 };
  },
  analyze_inventory_movement: (args, context) =>
    AnalyticsService.getInventoryMovementAnalysis(args, context.accessToken),
};

export const runAssistantTool = async (name, toolArguments, context = {}) => {
  const handler = handlers[name];
  if (!handler) throw new Error(`Unsupported AI tool: ${name}`);

  let args;
  try {
    args = typeof toolArguments === "string" ? JSON.parse(toolArguments || "{}") : toolArguments ?? {};
  } catch {
    throw new Error(`Invalid arguments for AI tool: ${name}`);
  }

  return handler(args, context);
};
