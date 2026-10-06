import { expect, test } from "./fixtures";
import { captureReleaseUI } from "./release-captures";

test("Home keeps goal draft transfer and exposes unavailable inputs honestly", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Attach context or files — coming later" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Voice input — coming later" })).toBeDisabled();
  await expect(page.locator("main").getByText("arrow_drop_down", { exact: true })).toHaveCount(0);
  await page.getByLabel("Goal draft", { exact: true }).fill("Review the beta without running work");
  await captureReleaseUI(page, "home");
  await page.getByRole("button", { name: "Create Goal", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\?view=goals$/);
  const form = page.getByRole("form", { name: "New Goal" });
  await expect(form.getByRole("textbox", { name: "Goal title", exact: true })).toHaveValue(
    "Review the beta without running work",
  );
  await expect(form.getByRole("textbox", { name: "Goal description", exact: true })).toHaveValue(
    "Review the beta without running work",
  );
});

test("per-agent delegation stays unavailable without disabling Goal orchestration", async ({
  page,
}) => {
  await page.goto("/agents/new?step=4");
  const delegation = page.getByRole("switch", {
    name: "Per-agent autonomous delegation — coming later",
  });
  await expect(delegation).toBeDisabled();
  await expect(delegation).toHaveAttribute("aria-checked", "false");
  await expect(delegation).toHaveAccessibleDescription(
    /Goals still coordinate agents after you approve a plan/,
  );
  await expect(page.getByText("Episodic Vector Memory Enclave", { exact: true })).toBeVisible();
  await expect(
    page.locator("#step-panel-4").getByText("Not available yet", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Next Step arrow_forward" })).toBeEnabled();
  await captureReleaseUI(page, "workspace");
});
