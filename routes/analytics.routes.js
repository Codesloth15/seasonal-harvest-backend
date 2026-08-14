import { Router } from "express";
import { getDashboard, getTransactions } from "../controller/analytics.controller.js";
import authorize from "../middleware/auth.middleware.js";
import requireRole from "../middleware/role.middleware.js";

const analyticsRouter = Router();

analyticsRouter.get(
  "/dashboard",
  authorize,
  requireRole("admin", "super_admin"),
  getDashboard,
);

analyticsRouter.get(
  "/transactions",
  authorize,
  requireRole("admin", "super_admin"),
  getTransactions,
);

export default analyticsRouter;
