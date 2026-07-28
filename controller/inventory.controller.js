import * as InventoryService from "../services/inventory.service.js";

export const getAllProducts = async (req, res, next) => {
  try {
    const products = await InventoryService.listInventory({
      category: req.query.category,
      sort: req.query.sort || "created_at",
      order: req.query.order || "desc",
    });
    res.status(200).json({ success: true, data: products });
  } catch (error) {
    next(error);
  }
};

export const getProductById = async (req, res, next) => {
  try {
    const product = await InventoryService.getInventoryItem(req.params.id);
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const createProduct = async (req, res, next) => {
  try {
    const product = await InventoryService.createInventoryItem(
      req.body,
      req.user.id,
      req.accessToken,
    );
    res.status(201).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const updateProduct = async (req, res, next) => {
  try {
    const product = await InventoryService.updateInventoryItem(
      req.params.id,
      req.body,
      req.accessToken,
    );
    res.status(200).json({ success: true, data: product });
  } catch (error) {
    next(error);
  }
};

export const adjustStock = async (req, res, next) => {
  try {
    const product = await InventoryService.adjustInventoryStock(
      req.params.id,
      req.body.adjustment,
      req.accessToken,
    );
    const adjustment = req.body.adjustment;
    res.status(200).json({
      success: true,
      data: product,
      message: `Stock adjusted by ${adjustment > 0 ? "+" : ""}${adjustment}`,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteProduct = async (req, res, next) => {
  try {
    await InventoryService.deleteInventoryItem(req.params.id, req.accessToken);
    res.status(200).json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    next(error);
  }
};

export const getInventorySummary = async (req, res, next) => {
  try {
    const summary = await InventoryService.getInventorySummary();
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

export const getLowStockItems = async (req, res, next) => {
  try {
    const items = await InventoryService.getLowStockItems();
    res.status(200).json({ success: true, data: items, count: items.length });
  } catch (error) {
    next(error);
  }
};
