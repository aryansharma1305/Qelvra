import { expect, test } from "./fixtures";

test("continue buttons walk through every step into the workspace", async ({ page }) => {
  await page.goto("/onboarding");
  await page.getByRole("link", { name: /Create your workspace/ }).click();
  await expect(page).toHaveURL("/onboarding/goal");
  await page.locator("#continue-btn").click();
  await expect(page).toHaveURL("/onboarding/team");
  await page.getByRole("button", { name: /Confirm Squad/ }).click();
  await expect(page).toHaveURL("/onboarding/engines");
  await page.getByRole("button", { name: /Assemble Workspace/ }).click();
  await expect(page).toHaveURL("/onboarding/ready");
  await page.locator("#launch-button").click();
  await expect(page).toHaveURL("/");
});

test("header pills reflect and change the current step", async ({ page }) => {
  await page.goto("/onboarding/engines");
  await expect(page.getByRole("link", { name: "Memory" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Runtime" }).click();
  await expect(page).toHaveURL("/onboarding/goal");
});

test("keyboard: arrows cycle stages, ⌘/Ctrl+Enter advances, Esc skips", async ({ page }) => {
  await page.goto("/onboarding/goal");
  await expect(page.locator("#continue-btn")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL("/onboarding/team");
  await expect(page.getByRole("button", { name: /Confirm Squad/ })).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL("/onboarding/goal");
  await expect(page.locator("#continue-btn")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Enter");
  await expect(page).toHaveURL("/onboarding/team");
  await expect(page.getByRole("button", { name: /Confirm Squad/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/");
});

test("back returns to the previous step", async ({ page }) => {
  await page.goto("/onboarding/engines");
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page).toHaveURL("/onboarding/team");
});

test("choosing an archetype moves the selection and tool count", async ({ page }) => {
  await page.goto("/onboarding/goal");
  const research = page.locator('[data-archetype="research"]');
  await research.click();
  await expect(research).toHaveAttribute("aria-checked", "true");
  await expect(page.locator('[data-archetype="software"]')).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(page.locator("#active-tools-count")).toHaveText("5 synthesis tools");
  await expect(research.getByText("Selected")).toBeVisible();
  await expect(page.locator('[data-archetype="software"]').getByText("Selected")).toHaveCount(0);
});

test("compute engine selection is exclusive", async ({ page }) => {
  await page.goto("/onboarding/engines");
  const radios = page.getByRole("radiogroup", { name: "Compute engine" }).getByRole("radio");
  await radios.nth(1).click();
  await expect(radios.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "false");
});
