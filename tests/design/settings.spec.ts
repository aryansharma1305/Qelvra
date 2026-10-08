import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { settingsFixture } from "../fixtures/settings";

test("Settings preserves Qelvra's shell and readable runtime data on desktop and mobile", async ({
  page,
}) => {
  const fixture = await settingsFixture();
  await page.route("**/api/settings", (route) => route.fulfill({ json: fixture.settings }));
  await page.route("**/api/providers", (route) =>
    route.fulfill({ json: { providers: fixture.providers } }),
  );
  await page.goto("/settings");
  await expect(page.getByRole("region", { name: "Storage" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh providers", exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  const captures = resolve(".impeccable/review/settings");
  await mkdir(captures, { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
    const heading = await page
      .getByRole("heading", { name: "Settings", exact: true })
      .boundingBox();
    expect(heading?.y).toBeGreaterThanOrEqual(48);
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const title of ["General", "Providers", "Storage", "Network & Security"])
      await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
    expect(
      await page
        .getByRole("button", { name: "Refresh providers", exact: true })
        .evaluate((element) => getComputedStyle(element).color),
    ).toBe("rgb(60, 0, 145)");
    await expect(page.locator("main input, main select, main textarea")).toHaveCount(0);
    await page.screenshot({ path: resolve(captures, name + ".png"), fullPage: true });
  }
});
