import express from "express";
import cors from "cors";
import { PORT } from "./config/env.js";
import connectToDatabase from "./database/supabase.js";

import inventoryRouter from "./routes/inventory.routes.js";
import productRouter from "./routes/product.routes.js";
import brandRouter from "./routes/brand.route.js";

import errorMiddleware from "./middleware/error.middleware.js";
import cookieParser from "cookie-parser";
import arcjetMiddleware from "./middleware/arcjet.middleware.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS
app.use(
  cors({
    origin: `http://localhost:${PORT}`,
    credentials: true,
  })
);

app.use(arcjetMiddleware);

// Routes
app.use("/api/v1/inventory", inventoryRouter);
app.use("/api/v1/products", productRouter);
app.use("/api/v1/brands", brandRouter);

// Home
app.get("/", (req, res) => {
  res.send(`Running on http://localhost:${PORT}`);
});

// Error Handler
app.use(errorMiddleware);

app.listen(PORT, async () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  await connectToDatabase();
});

export default app;