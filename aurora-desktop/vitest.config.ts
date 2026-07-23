import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // src/renderer/prompt.test.ts roda aqui também: prompt.ts é TS puro, sem
    // DOM/React — os testes de UI de verdade continuam fora (Playwright/e2e).
    include: ["src/main/**/*.test.ts", "src/renderer/**/*.test.ts"],
    exclude: ["node_modules/**", "e2e/**"],
  },
});
