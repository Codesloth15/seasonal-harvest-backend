import { Router } from "express";
import authorize from "../middleware/auth.middleware.js";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  deleteProduct,
  getInventorySummary,
  getLowStockItems
} from "../controller/inventory.controller.js";

const inventoryRouter = Router();

// Get all products
inventoryRouter.get('/', getAllProducts);

// Get single product
inventoryRouter.get('/:id', getProductById);

// Create new product (requires auth)
inventoryRouter.post('/', authorize, createProduct);

// Update product (requires auth)
inventoryRouter.put('/:id', authorize, updateProduct);

// Adjust stock (add/subtract units)
inventoryRouter.patch('/:id/stock', authorize, adjustStock);

// Delete product (soft delete)
inventoryRouter.delete('/:id', authorize, deleteProduct);

// Get inventory summary report
inventoryRouter.get('/reports/summary', getInventorySummary);

// Get low stock items
inventoryRouter.get('/reports/low-stock', getLowStockItems);

export default inventoryRouter;
