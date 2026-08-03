import express from "express";
import { chat } from "../controller/assistant.controller.js";
import authorize from "../middleware/auth.middleware.js";
import requireRole from "../middleware/role.middleware.js";
import assistantRateLimit from "../middleware/assistant-rate-limit.middleware.js";

const assistantRouter = express.Router();

// Inventory information is operational data, so the first release is admin-only.
assistantRouter.post(
  "/chat",
  authorize,
  requireRole("admin", "super_admin"),
  assistantRateLimit,
  chat,
);

export default assistantRouter;
