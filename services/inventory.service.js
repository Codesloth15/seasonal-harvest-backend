import * as InventoryRepository from "../model/inventory.model.js";
import { badRequest, notFound } from "../utils/http-error.js";

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
  );
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
  return InventoryRepository.updateInventory(id, updates, accessToken);
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

export const adjustInventoryStock = async (id, input, accessToken) => {
  const operation = typeof input?.operation === "string" ? input.operation.trim().toUpperCase() : "";
  const transactionType = typeof input?.transaction_type === "string"
    ? input.transaction_type.trim().toUpperCase()
    : "";
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  const performedBy = typeof input?.performed_by === "string" ? input.performed_by.trim() : "";
  const quantity = input?.quantity;

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

  try {
    return await InventoryRepository.adjustStock(
      id,
      { operation, quantity, transaction_type: transactionType, reason, performed_by: performedBy },
      accessToken,
    );
  } catch (error) {
    if (error?.message?.includes("Insufficient stock for this adjustment.")) {
      throw badRequest("Insufficient stock for this adjustment.");
    }
    throw error;
  }
};

export const deleteInventoryItem = (id, accessToken) =>
  InventoryRepository.deleteInventory(id, accessToken);

export const getInventorySummary = () => InventoryRepository.getInventorySummary();
export const getLowStockItems = () => InventoryRepository.getLowStockItems();
