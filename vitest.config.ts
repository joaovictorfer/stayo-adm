import { defineConfig } from "vitest/config";

/**
 * Config separada do vite.config.ts (que é gerenciado pelo preset do
 * Lovable/TanStack Start) — testes de lógica pura, sem DOM.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
