import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase3-suppliers-visual.spec.ts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8236",
    viewport: { width: 390, height: 844 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev --port 8236 --host 127.0.0.1",
    url: "http://127.0.0.1:8236/vistoria/prototipo/phase3-suppliers",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "http://127.0.0.1:59999",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_phase3_visual_only",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
