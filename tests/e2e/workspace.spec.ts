import { expect, test } from "./fixtures";

test("terminal: single/split layout and unavailable quick prompts", async ({ page }) => {
  await page.goto("/terminal");
  await expect(page.locator("#dev-shell-pane")).toBeVisible();
  await page.locator("#btn-single-view").click();
  await expect(page.locator("#dev-shell-pane")).toHaveCount(0);
  await page.locator("#btn-split-view").click();
  await expect(page.locator("#dev-shell-pane")).toBeVisible();

  const quickPrompt = page.getByRole("button", { name: "Analyze chunks — coming later" });
  await expect(quickPrompt).toBeDisabled();
  await expect(quickPrompt).toHaveAttribute("title", /Coming later/);
  await expect(page.locator("#terminal-input")).toBeDisabled();
  await expect(page.locator("#terminal-input")).toHaveValue("");
  await expect(page).toHaveURL("/terminal");
});

test("studio: zoom, perspective and operative selection", async ({ page }) => {
  await page.goto("/studio");
  await expect(page.locator("#zoomLevelDisplay")).toHaveText("100%");
  await page.getByTitle("Zoom In").click();
  await expect(page.locator("#zoomLevelDisplay")).toHaveText("110%");
  for (let i = 0; i < 10; i++) await page.getByTitle("Zoom In").click();
  await expect(page.locator("#zoomLevelDisplay")).toHaveText("160%");
  await page.getByTitle("Fit to bounds").click();
  await expect(page.locator("#zoomLevelDisplay")).toHaveText("100%");

  await page.locator("#perspOrtho").click();
  await expect(page.locator("#perspOrtho")).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Inspect atlas" }).click();
  await expect(page.locator("#inspectorName")).toHaveText("Atlas");
  await expect(page.locator("#inspectorDesk")).toHaveText("Desk #03 (Engineering Bay, Rig Beta)");
});
