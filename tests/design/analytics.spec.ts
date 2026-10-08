import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { AnalyticsQuerySchema } from "@qelvra/shared";
import { analyticsFixture } from "../fixtures/analytics-service";
test("Analytics displays real deterministic retained-event data at desktop and mobile widths", async ({
  page,
}) => {
  const fixture = await analyticsFixture();
  try {
    await page.route("**/api/agents", (route) =>
      route.fulfill({ json: { agents: fixture.registry.list() } }),
    );
    await page.route("**/api/analytics**", async (route) =>
      route.fulfill({
        json: await fixture.service.get(
          AnalyticsQuerySchema.parse(
            Object.fromEntries(new URL(route.request().url()).searchParams),
          ),
        ),
      }),
    );
    await page.goto("/analytics");
    await page.getByLabel("Date range", { exact: true }).selectOption("custom");
    await page.getByLabel("From UTC date", { exact: true }).fill("2026-10-01");
    await page.getByLabel("To UTC date", { exact: true }).fill("2026-10-05");
    await expect(page.getByTestId("recorded-events")).toHaveText("7");
    await expect(page.getByTestId("analytics-range")).toContainText("2026-10-05T00:00:00.000Z");
    await page.evaluate(() => document.fonts.ready);
    const captures = resolve(".impeccable/review/analytics");
    await mkdir(captures, { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ] as const) {
      await page.setViewportSize({ width, height });
      await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(page.getByRole("img", { name: /Recorded events by UTC day/ })).toBeVisible();
      const refresh = page.getByRole("button", { name: "Refresh", exact: true });
      expect(await refresh.evaluate((el) => getComputedStyle(el).color)).toBe("rgb(60, 0, 145)");
      expect(
        await page
          .getByTestId("recorded-events")
          .evaluate((el) => getComputedStyle(el).fontVariantNumeric),
      ).toContain("tabular-nums");
      await page.screenshot({ path: resolve(captures, name + ".png"), fullPage: true });
    }
  } finally {
    await fixture.close();
  }
});
