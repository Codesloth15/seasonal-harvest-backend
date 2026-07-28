import { Router } from "express";
import {
  forgotPassword,
  getCurrentUser,
  resetPassword,
  signIn,
  signOut,
  signUp,
} from "../controller/auth.controller.js";
import authorize from "../middleware/auth.middleware.js";

const authRouter = Router();

authRouter.post("/sign-up", signUp);
authRouter.post("/sign-in", signIn);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password", authorize, resetPassword);
authRouter.post("/sign-out", authorize, signOut);
authRouter.get("/me", authorize, getCurrentUser);

export default authRouter;
