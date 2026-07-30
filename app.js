import express from "express";
import cors from "cors";
import { corsOptions } from "./config/cors.js";

import inventoryRouter from "./routes/inventory.routes.js";
import productRouter from "./routes/product.routes.js";
import brandRouter from "./routes/brand.route.js";
import authRouter from "./routes/auth.routes.js";
import categoryRouter from "./routes/category.routes.js";

import errorMiddleware from "./middleware/error.middleware.js";
import arcjetMiddleware from "./middleware/arcjet.middleware.js";

const app = express();

app.disable("x-powered-by");
app.use(cors(corsOptions));
app.use(express.json({ limit: "100kb" }));
// Every current and future API route, including reads, uses Arcjet.
app.use("/api/v1", arcjetMiddleware);

app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/brands", brandRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/categories", categoryRouter);

app.get("/", (req, res) => {
  res.status(200).json({ success: true, service: "seasonal-harvest-backend" });
});

app.get("/health", (req, res) => {
  res.status(200).json({ success: true, status: "healthy" });
});

app.use(errorMiddleware);

export default app;
