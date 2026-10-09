import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { test, expect } from "@playwright/test";
import { networkFixture } from "../fixtures/network";
test("Network renders real-data graph/list and detail hierarchy on desktop and mobile", async ({
  page,
}) => {
  await page.route("**/api/network?*", (r) => r.fulfill({ json: networkFixture() }));
  await page.goto("/network");
  await expect(page.getByRole("region", { name: "Agent relationships" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  const captures = resolve(".impeccable/review/network");
  await mkdir(captures, { recursive: true });
  for (const [name, width, height] of [
    ["desktop", 1440, 900],
    ["mobile", 390, 844],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.getByRole("button", { name: "Inspect WORKER" }).filter({ visible: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.getByRole("heading", { name: "Agent Network", exact: true })).toBeVisible();
    expect(
      (await page.getByRole("heading", { name: "Agent Network", exact: true }).boundingBox())?.y,
    ).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole("region", { name: "Selected agent details" })).toContainText(
      "Task 1",
    );
    await expect(page.getByRole("list", { name: "Relationship evidence list" })).toContainText(
      "LEAD coordinates WORKER",
    );
    await expect(page.locator("main svg animate, main svg animateMotion")).toHaveCount(0);
    if (name === "desktop") {
      const paths = page.locator("[data-network-edge]");
      await expect(paths).toHaveCount(networkFixture().edges.length);
      for (const path of await paths.all())
        expect(await path.evaluate((el) => getComputedStyle(el).stroke)).not.toMatch(
          /none|rgb\(0, 0, 0\)/,
        );
    }
    await expect(page.locator('aside a[href="/network"]')).not.toContainText("Preview");
    await page.screenshot({ path: resolve(captures, name + ".png"), fullPage: true });
  }
});
