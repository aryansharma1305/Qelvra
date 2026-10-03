import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Opt-in design parity suite (`npm run test:design`). Needs network access: the Stitch
// screens load the Tailwind Play CDN and Google Fonts.
export default defineConfig({
  ...baseConfig,
  testDir: "tests/design",
  fullyParallel: true,
  // Bound concurrent reference/app rendering to the verified three-worker setting.
  workers: 3,
  timeout: 90_000,
});
