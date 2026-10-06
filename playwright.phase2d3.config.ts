import { defineConfig } from "@playwright/test";

/**
 * Fase 2D.3: valida a apresentação pública com um endpoint Supabase fictício
 * interceptado pelo Playwright. Nenhuma credencial ou dado do projeto real é
 * usado; o objetivo é exercitar o transporte anônimo, os estados da rota e o
 * layout responsivo sobre o contrato da RPC 0023.
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase2d3-public-proposal.spec.ts",
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
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "http://127.0.0.1:8235/supabase",
      VITE_SUPABASE_PUBLISHABLE_KEY: "phase2d3-public-test-key",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
