import * as InventoryRepository from "../model/inventory.model.js";
import { badRequest, notFound } from "../utils/http-error.js";
import { publishDataChange } from "./realtime-events.service.js";

export const listInventory = (filters, accessToken) =>
  InventoryRepository.getAllInventory(filters, accessToken);

export const getInventoryItem = async (id) => {
  const item = await InventoryRepository.getInventoryById(id);
  if (!item) throw notFound("Inventory item");
  return item;
};

export const createInventoryItem = (input, userId, accessToken) => {
  const { name, category, price, stock_qty, low_stock_threshold, description } = input;
  if (!name || !category || price === undefined) {
    throw badRequest("Name, category, and price are required.");
  }

  return InventoryRepository.createInventory(
    {
      name,
      category,
      price,
      stock_qty: stock_qty ?? 0,
      low_stock_threshold: low_stock_threshold ?? 10,
      description: description ?? null,
      created_by: userId,
    },
    accessToken,
  ).then((inventory) => {
    publishDataChange({ resource: "inventory", action: "created", id: inventory.id });
    return inventory;
  });
};

export const updateInventoryItem = async (id, input, accessToken) => {
  await getInventoryItem(id);
  const allowedFields = ["name", "category", "price", "low_stock_threshold", "description"];
  const updates = Object.fromEntries(
    allowedFields
      .filter((field) => input[field] !== undefined)
      .map((field) => [field, input[field]]),
  );
  if (Object.keys(updates).length === 0) throw badRequest("Provide a valid field to update.");
  const inventory = await InventoryRepository.updateInventory(id, updates, accessToken);
  publishDataChange({ resource: "inventory", action: "updated", id: inventory.id ?? id });
  return inventory;
};

const ADJUSTMENT_OPERATIONS = new Set(["ADD", "SUBTRACT"]);
const TRANSACTION_OPERATIONS = {
  STOCK_RECEIVED: "ADD",
  CUSTOMER_RETURN: "ADD",
  INITIAL_STOCK: "ADD",
  ORDER_RELEASED: "ADD",
  DAMAGED: "SUBTRACT",
  EXPIRED: "SUBTRACT",
  MISSING: "SUBTRACT",
  SUPPLIER_RETURN: "SUBTRACT",
  ORDER_COMPLETED: "SUBTRACT",
};
const ADJUSTMENT_TYPES = new Set([...Object.keys(TRANSACTION_OPERATIONS), "MANUAL_ADJUSTMENT"]);
const INVENTORY_UNITS = new Set([
  "BOX", "PACK", "BALE", "PIECE", "SACK", "CRATE", "TRAY", "BUNDLE",
  "KILOGRAM", "GRAM", "LITER", "MILLILITER",
]);

export const adjustInventoryStock = async (id, input, accessToken) => {
  const operation = typeof input?.operation === "string" ? input.operation.trim().toUpperCase() : "";
  const transactionType = typeof input?.transaction_type === "string"
    ? input.transaction_type.trim().toUpperCase()
    : "";
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  const performedBy = typeof input?.performed_by === "string" ? input.performed_by.trim() : "";
  const quantity = input?.quantity;
  const unit = typeof input?.unit === "string" ? input.unit.trim().toUpperCase() : "";

  if (!ADJUSTMENT_OPERATIONS.has(operation)) {
    throw badRequest("Operation must be ADD or SUBTRACT.");
  }
  if (typeof quantity !== "number" || !Number.isFinite(quantity) || quantity <= 0) {
    throw badRequest("Quantity must be a positive number.");
  }
  if (!ADJUSTMENT_TYPES.has(transactionType)) {
    throw badRequest("Transaction type is not supported for inventory adjustments.");
  }
  if (TRANSACTION_OPERATIONS[transactionType] && TRANSACTION_OPERATIONS[transactionType] !== operation) {
    throw badRequest(`${transactionType} adjustments must use ${TRANSACTION_OPERATIONS[transactionType]}.`);
  }
  if (!reason) throw badRequest("Reason is required.");
  if (reason.length > 1000) throw badRequest("Reason must not exceed 1000 characters.");
  if (!performedBy) throw badRequest("Performed by is required.");
  if (unit && !INVENTORY_UNITS.has(unit)) throw badRequest("Adjustment unit is not supported.");

  try {
    const adjustment = await InventoryRepository.adjustStock(
      id,
      {
        operation,
        quantity,
        ...(unit ? { unit } : {}),
        transaction_type: transactionType,
        reason,
        performed_by: performedBy,
      },
      accessToken,
    );
    publishDataChange({ resource: "inventory", action: "adjusted", id });
    return adjustment;
  } catch (error) {
    if (error?.message?.includes("Insufficient stock for this adjustment.")) {
      throw badRequest("Insufficient stock for this adjustment.");
    }
    throw error;
  }
};

export const configureInventoryPackaging = async (id, input, accessToken) => {
  const baseUnit = typeof input?.base_unit === "string" ? input.base_unit.trim().toUpperCase() : "";
  const packageUnit = typeof input?.package_unit === "string" ? input.package_unit.trim().toUpperCase() : "";
  const unitsPerPackage = Number(input?.units_per_package);

  if (!INVENTORY_UNITS.has(baseUnit)) throw badRequest("Base unit is not supported.");
  if (!INVENTORY_UNITS.has(packageUnit)) throw badRequest("Package unit is not supported.");
  if (baseUnit === packageUnit) throw badRequest("Package unit must differ from the base unit.");
  if (!Number.isFinite(unitsPerPackage) || unitsPerPackage <= 1) {
    throw badRequest("Units per package must be a number greater than 1.");
  }

  const inventory = await InventoryRepository.updateInventoryPackaging(id, {
    base_unit: baseUnit,
    package_unit: packageUnit,
    units_per_package: unitsPerPackage,
  }, accessToken);
  publishDataChange({ resource: "inventory", action: "packaging-updated", id });
  return inventory;
};

export const deleteInventoryItem = async (id, accessToken) => {
  const inventory = await InventoryRepository.deleteInventory(id, accessToken);
  publishDataChange({ resource: "inventory", action: "deleted", id: inventory.id ?? id });
  return inventory;
};

export const getInventorySummary = (accessToken) =>
  InventoryRepository.getInventorySummary(accessToken);
export const getLowStockItems = (accessToken) => InventoryRepository.getLowStockItems(accessToken);

export const getInventoryTransactions = (id, input = {}, accessToken) => {
  const operation = typeof input.operation === "string"
    ? input.operation.trim().toUpperCase()
    : "";
  const page = input.page === undefined ? 1 : Number(input.page);
  const limit = input.limit === undefined ? 20 : Number(input.limit);

  if (operation && !ADJUSTMENT_OPERATIONS.has(operation)) {
    throw badRequest("Operation must be ADD or SUBTRACT.");
  }
  if (!Number.isInteger(page) || page < 1) {
    throw badRequest("Page must be a positive integer.");
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw badRequest("Limit must be an integer between 1 and 100.");
  }

  return InventoryRepository.getInventoryTransactions(
    id,
    { operation: operation || undefined, page, limit },
    accessToken,
  );
};
