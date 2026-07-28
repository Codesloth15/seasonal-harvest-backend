import express from "express";
import * as BrandController from "../controller/brand.controller.js";
import authorize from "../middleware/auth.middleware.js";
import requireRole from "../middleware/role.middleware.js";

const router = express.Router();
const requireCatalogAdmin = requireRole("admin", "super_admin");

router.post("/", authorize, requireCatalogAdmin, BrandController.createBrand);

router.get("/", BrandController.getAllBrands);

router.get("/:id", BrandController.getBrandById);

router.put("/:id", authorize, requireCatalogAdmin, BrandController.updateBrand);

router.delete("/:id", authorize, requireCatalogAdmin, BrandController.deleteBrand);

export default router;
