import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
} from "../controller/category.controller.js";
import authorize from "../middleware/auth.middleware.js";
import requireRole from "../middleware/role.middleware.js";

const categoryRouter = Router();
const requireCategoryAdmin = requireRole("admin", "super_admin");

categoryRouter.get("/", getAllCategories);
categoryRouter.get("/:id", getCategoryById);
categoryRouter.post("/", authorize, requireCategoryAdmin, createCategory);
categoryRouter.put("/:id", authorize, requireCategoryAdmin, updateCategory);
categoryRouter.delete("/:id", authorize, requireCategoryAdmin, deleteCategory);

export default categoryRouter;

