import express from "express";
import * as BrandController from "../controller/brand.controller.js";

const router = express.Router();

router.post("/", BrandController.createBrand);

router.get("/", BrandController.getAllBrands);

router.get("/:id", BrandController.getBrandById);

router.put("/:id", BrandController.updateBrand);

router.delete("/:id", BrandController.deleteBrand);

export default router;