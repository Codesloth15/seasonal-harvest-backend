import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "config/cors.js",
        "controller/auth.controller.js",
        "controller/category.controller.js",
        "middleware/auth.middleware.js",
        "middleware/role.middleware.js",
        "model/category.model.js",
        "services/auth.service.js",
        "services/category.service.js",
        "services/inventory.service.js",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
