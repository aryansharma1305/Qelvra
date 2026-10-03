import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Opt-in design parity suite (`npm run test:design`). Needs network access: the Stitch
// screens load the Tailwind Play CDN and Google Fonts.
export default defineConfig({
  ...baseConfig,
  testDir: "tests/design",
  fullyParallel: true,
  // Keep reference/app captures serial to reduce Chromium text-rasterization variance.
  workers: 1,
  timeout: 90_000,
});
