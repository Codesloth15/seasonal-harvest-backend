import { Router } from "express";
import { streamDataChanges } from "../controller/events.controller.js";
import authorize from "../middleware/auth.middleware.js";

const eventsRouter = Router();

eventsRouter.get("/stream", authorize, streamDataChanges);

export default eventsRouter;
