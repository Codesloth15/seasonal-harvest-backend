import express from "express";
import * as ProductController from "../controller/product.controller.js";

const router = express.Router();

router.post("/", ProductController.createProduct);

router.get("/", ProductController.getAllProducts);

router.get("/:id", ProductController.getProductById);

router.put("/:id", ProductController.updateProduct);

router.delete("/:id", ProductController.deleteProduct);

export default router;