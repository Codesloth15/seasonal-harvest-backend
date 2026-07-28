import app from "./app.js";
import { PORT } from "./config/env.js";
import connectToDatabase from "./database/supabase.js";
import { parsePort } from "./utils/port.js";

const startServer = async () => {
  const port = parsePort(PORT);
  await connectToDatabase();

  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing HTTP server.`);
    server.close((error) => {
      if (error) {
        console.error("Failed to close HTTP server.", error);
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGTERM", () => shutdown("SIGTERM"));
  process.once("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
  console.error("Server startup failed.", error);
  process.exitCode = 1;
});
