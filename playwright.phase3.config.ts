import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "phase3-suppliers-list-detail.spec.ts",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:8235",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev --port 8235 --host 127.0.0.1",
    url: "http://127.0.0.1:8235",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      ...process.env,
      VITE_SUPABASE_URL: "https://phase3-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_phase3_test",
      VITE_SUPABASE_ANON_KEY: "",
    },
  },
});
