import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/main/**/*.test.ts"],
    exclude: ["src/renderer/**", "node_modules/**", "e2e/**"],
  },
});
