import { expect, test } from "./fixtures";

test("tasks: selected card toggles the inspector; close and Esc hide it", async ({ page }) => {
  await page.goto("/tasks");
  const inspector = page.locator("#inspector-drawer");
  await expect(inspector).toBeVisible();
  await page.locator("#selected-card").click();
  await expect(inspector).toHaveCount(0);
  await page.locator("#selected-card").click();
  await expect(inspector).toBeVisible();
  await page.getByTitle("Close Drawer (ESC)").click();
  await expect(inspector).toHaveCount(0);
  await page.locator("#selected-card").click();
  await page.keyboard.press("Escape");
  await expect(inspector).toHaveCount(0);
});

test("terminal: single/split layout and quick prompts", async ({ page }) => {
  await page.goto("/terminal");
  await expect(page.locator("#dev-shell-pane")).toBeVisible();
  await page.locator("#btn-single-view").click();
  await expect(page.locator("#dev-shell-pane")).toHaveCount(0);
  await page.locator("#btn-split-view").click();
  await expect(page.locator("#dev-shell-pane")).toBeVisible();

  await page.getByRole("button", { name: "Analyze chunks" }).click();
  await expect(page.locator("#terminal-input")).toHaveValue(
    "Run bundle analyzer and report chunk weights",
  );
  // Submitting must not reload the page until the PTY bridge exists.
  await page.locator("#terminal-input").press("Enter");
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
