import { E2E_API_URL } from "./env";
import { expect, test } from "./fixtures";

test("wizard starts at step 1 and steps are deep-linkable", async ({ page }) => {
  await page.goto("/agents/new");
  await expect(page.locator("#step-panel-1")).toBeVisible();
  await expect(page.locator("#step-panel-3")).toBeHidden();
  await expect(page.locator("#btn-prev-step")).toBeHidden();

  await page.locator("#btn-next-step").click();
  await expect(page).toHaveURL("/agents/new?step=2");
  await expect(page.locator("#step-panel-2")).toBeVisible();
  await expect(page.locator("#step-telemetry-badge")).toContainText("Step 2 of 5");

  await page.locator("#step-pill-5").click();
  await expect(page.locator("#step-panel-5")).toBeVisible();
  await expect(page.locator("#btn-next-step")).toBeDisabled();

  await page.goBack();
  await expect(page.locator("#step-panel-2")).toBeVisible();
});

test("out-of-range steps fall back to step 1", async ({ page }) => {
  await page.goto("/agents/new?step=99");
  await expect(page.locator("#step-panel-1")).toBeVisible();
});

test("identity edits update the live preview", async ({ page }) => {
  await page.goto("/agents/new");
  await page.locator("#input-agent-name").fill("Sentinel");
  await page.locator("#input-agent-role").fill("SRE Lead");
  await expect(page.locator("#live-agent-name")).toHaveText("Sentinel");
  await expect(page.locator("#live-agent-role")).toHaveText("SRE Lead");
  await expect(page.locator("#step-pill-1")).toContainText("Sentinel");
});

test("API provider selection updates the preview and unavailable cards are disabled", async ({
  page,
  request,
}) => {
  const response = await request.get(`${E2E_API_URL}/api/providers`);
  const { providers } = await response.json();
  // Make one known unavailable result deterministic without installing any external CLI.
  const fixture = providers.map((provider: { id: string }) =>
    provider.id === "gemini"
      ? { ...provider, available: false, reason: "CLI_NOT_FOUND" }
      : provider,
  );
  await page.route("**/api/providers", (route) => route.fulfill({ json: { providers: fixture } }));
  await page.goto("/agents/new?step=2");
  await expect(page.getByRole("radio")).toHaveCount(providers.length);
  const missing = page.getByRole("radio", { name: /Gemini CLI/ });
  await expect(missing).toBeDisabled();
  await expect(missing).toContainText("Not installed");
  await page.getByRole("radio", { name: /Fake agent/ }).click();
  await expect(page.locator("#live-agent-provider")).toHaveText("Fake agent (development)");
  await expect(
    page.locator("input[name=executable],input[name=args],input[name=cwd],input[name=apiKey]"),
  ).toHaveCount(0);
});

test("toggling tools updates counts", async ({ page }) => {
  await page.goto("/agents/new?step=3");
  await expect(page.locator("#live-tool-count")).toHaveText("6 ACTIVE");
  await page.getByRole("checkbox", { name: "Deep Research" }).click();
  await expect(page.locator("#live-tool-count")).toHaveText("7 ACTIVE");
  await expect(page.locator("#step-pill-3")).toContainText("7 Tools Enabled");
  await page.getByRole("checkbox", { name: "Coding" }).click();
  await expect(page.locator("#live-tool-count")).toHaveText("6 ACTIVE");
  await expect(page.locator("#live-tool-icons")).not.toContainText("Coding");
});

test("directive presets replace the editor content", async ({ page }) => {
  await page.goto("/agents/new?step=5");
  await page.getByRole("button", { name: "Paranoid Security" }).click();
  await expect(page.locator("#system-directive-editor")).toHaveValue(/security auditor/);
  await expect(page.getByRole("button", { name: "Paranoid Security" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("closing the wizard returns to the directory", async ({ page }) => {
  await page.goto("/agents/new");
  await page.getByTitle("Close Provisioning Session").click();
  await expect(page).toHaveURL("/agents");
});
