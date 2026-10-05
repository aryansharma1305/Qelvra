import { defineConfig, devices } from "@playwright/test";
import {
  E2E_API_PORT,
  E2E_API_URL,
  E2E_DATA_DIR,
  E2E_WEB_PORT,
  E2E_WEB_URL,
} from "./tests/e2e/env";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: E2E_WEB_URL,
    viewport: { width: 1440, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
  ],
  // Full stack: the UI talks to the real server. Isolated ports and a data directory wiped
  // before each run (see tests/e2e/env.ts); never reuse a running server.
  webServer: [
    {
      command: `node -e "require('fs').rmSync(process.env.DATA_DIR,{recursive:true,force:true})" && npx tsx tests/fixtures/execution-server.ts`,
      url: `${E2E_API_URL}/api/health`,
      env: {
        PORT: String(E2E_API_PORT),
        WEB_ORIGIN: E2E_WEB_URL,
        DATA_DIR: E2E_DATA_DIR,
        LOG_LEVEL: "warn",
        NODE_ENV: "test",
      },
      reuseExistingServer: false,
      timeout: 60_000,
      // Without this Playwright SIGKILLs the server, skipping its PTY cleanup. SIGINT (not
      // SIGTERM) because npm reports a SIGTERM-ed script as a failure.
      gracefulShutdown: { signal: "SIGINT", timeout: 10_000 },
    },
    {
      command: `npm run dev -w @qelvra/web -- --port ${E2E_WEB_PORT}`,
      url: E2E_WEB_URL,
      env: { VITE_API_URL: E2E_API_URL },
      reuseExistingServer: false,
      timeout: 60_000,
      gracefulShutdown: { signal: "SIGINT", timeout: 5_000 },
    },
  ],
});
