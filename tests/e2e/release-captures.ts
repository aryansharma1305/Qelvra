import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { Page } from "@playwright/test";

/** Opt-in local finish-review evidence; it never captures the developer's DATA_DIR. */
export async function captureReleaseUI(page: Page, surface: string) {
  if (process.env.QELVRA_CAPTURE_RELEASE_UI !== "1") return;
  const directory = resolve(".impeccable/review/blocker-cleanup");
  await mkdir(directory, { recursive: true });
  const original = page.viewportSize();
  await page.evaluate(async () => document.fonts.ready);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: resolve(directory, `${surface}-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  if (original) await page.setViewportSize(original);
}
