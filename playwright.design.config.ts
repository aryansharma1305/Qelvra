import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

// Opt-in design parity suite (`npm run test:design`). Needs network access: the Stitch
// screens load the Tailwind Play CDN and Google Fonts.
export default defineConfig({
  ...baseConfig,
  testDir: "tests/design",
  fullyParallel: true,
  use: {
    ...baseConfig.use,
    // Use fractional font advances on Linux as on macOS, including the original reference.
    launchOptions: { args: ["--font-render-hinting=none"] },
  },
  // Keep reference/app captures serial to reduce Chromium text-rasterization variance.
  workers: 1,
  timeout: 90_000,
});
