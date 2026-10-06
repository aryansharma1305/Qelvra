import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const status = (page: Page) => page.locator("[data-connection]");

test("sidebar reports Connected when the server is healthy", async ({ page }) => {
  await page.goto("/");
  await expect(status(page)).toHaveText("CONNECTED");
  await expect(status(page)).toHaveAttribute("title", /Server v0\.1\.0-beta\.1 responded/);
});

test.describe("when the server is unreachable", () => {
  test.use({ allowedConsoleErrors: [/Failed to load resource/] });

  test("sidebar reports Disconnected and recovers on refocus", async ({ page }) => {
    await page.route("**/api/health", (route) => route.abort("connectionrefused"));
    await page.goto("/");
    await expect(status(page)).toHaveText("DISCONNECTED");
    await expect(status(page)).toHaveAttribute("title", /Could not reach the server/);

    await page.unroute("**/api/health");
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(status(page)).toHaveText("CONNECTED");
  });

  test("an error response from the server counts as Disconnected", async ({ page }) => {
    await page.route("**/api/health", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Internal server error" },
        }),
      }),
    );
    await page.goto("/");
    await expect(status(page)).toHaveText("DISCONNECTED");
  });
});
