import { Router } from "express";
import { signin, signout, signUp } from "../controller/auth.controller.js";
const authRouter =Router();

authRouter.post('/sign-up',signUp);
authRouter.post('/sign-in',signin);
authRouter.post('/sign-out',signout);

export default authRouter