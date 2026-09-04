import { Router } from "express";
import authorize from "../middleware/auth.middleware.js";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustInventory,
  deleteProduct,
  getInventorySummary,
  getLowStockItems,
  getInventoryTransactions,
  configureInventoryPackaging
} from "../controller/inventory.controller.js";

const inventoryRouter = Router();

// Get all products
inventoryRouter.get('/', authorize, getAllProducts);

// Static routes must be registered before the dynamic /:id route.
inventoryRouter.get('/reports/summary', authorize, getInventorySummary);
inventoryRouter.get('/reports/low-stock', authorize, getLowStockItems);

// Immutable ADD/SUBTRACT adjustment history for one inventory item.
inventoryRouter.get('/:id/transactions', authorize, getInventoryTransactions);
inventoryRouter.put('/:id/packaging', authorize, configureInventoryPackaging);

// Get single product
inventoryRouter.get('/:id', getProductById);

// Create new product (requires auth)
inventoryRouter.post('/', authorize, createProduct);

// Update product (requires auth)
inventoryRouter.put('/:id', authorize, updateProduct);

// Operation-based adjustment endpoint. Authentication is ready for admin-role middleware.
inventoryRouter.post('/:id/adjust', authorize, adjustInventory);

// Delete product (soft delete)
inventoryRouter.delete('/:id', authorize, deleteProduct);

export default inventoryRouter;
