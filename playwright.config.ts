import { defineConfig } from "@playwright/test";

/**
 * Fase 18 (plano mestre): E2E real, sempre com contextos de navegador
 * genuinamente isolados (`browser.newContext()`, nunca abas da mesma
 * sessão) — ver e2e/README.md para o que esta suíte cobre e o que fica
 * bloqueado sem credencial real do Supabase (docs/MULTI_DEVICE_VALIDATION.md).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8235",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev --port 8235 --host 127.0.0.1",
    url: "http://127.0.0.1:8235",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
