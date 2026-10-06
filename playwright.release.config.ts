import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/release",
  workers: 1,
  retries: 0,
  timeout: 120000,
  forbidOnly: !!process.env.CI,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:5197",
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  outputDir: "test-results/release",
  webServer: {
    command: "npm run dev -w @qelvra/web -- --port 5197",
    url: "http://127.0.0.1:5197",
    env: { VITE_API_URL: "http://127.0.0.1:3097" },
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGINT", timeout: 5000 },
  },
});
