import express from "express";
import * as ProductController from "../controller/product.controller.js";
import authorize from "../middleware/auth.middleware.js";
import requireRole from "../middleware/role.middleware.js";
import { uploadProductImage } from "../middleware/product-image.middleware.js";

const router = express.Router();
const requireCatalogAdmin = requireRole("admin", "super_admin");

router.post(
  "/",
  authorize,
  requireCatalogAdmin,
  uploadProductImage,
  ProductController.createProduct,
);

router.get("/", ProductController.getAllProducts);

router.get("/:id", ProductController.getProductById);

router.put("/:id", authorize, requireCatalogAdmin, ProductController.updateProduct);

router.delete("/:id", authorize, requireCatalogAdmin, ProductController.deleteProduct);

export default router;
