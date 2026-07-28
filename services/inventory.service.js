import * as InventoryRepository from "../model/inventory.model.js";
import { badRequest, notFound } from "../utils/http-error.js";

export const listInventory = (filters) => InventoryRepository.getAllInventory(filters);

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

export const adjustInventoryStock = (id, adjustment, accessToken) => {
  if (typeof adjustment !== "number" || !Number.isFinite(adjustment)) {
    throw badRequest("Adjustment value is required and must be a finite number.");
  }
  return InventoryRepository.adjustStock(id, adjustment, accessToken);
};

export const deleteInventoryItem = (id, accessToken) =>
  InventoryRepository.deleteInventory(id, accessToken);

export const getInventorySummary = () => InventoryRepository.getInventorySummary();
export const getLowStockItems = () => InventoryRepository.getLowStockItems();
