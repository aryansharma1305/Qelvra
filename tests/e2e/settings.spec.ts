import { test, expect, type Page } from "@playwright/test";
import { ProviderListResponseSchema, SettingsResponseSchema } from "@qelvra/shared";
import { settingsFixture } from "../fixtures/settings";
import { E2E_API_URL } from "./env";

async function controlled(page: Page, production = false, host = "127.0.0.1") {
  const fixture = await settingsFixture(production, host);
  await page.route("**/api/settings", (route) => route.fulfill({ json: fixture.settings }));
  await page.route("**/api/providers", (route) =>
    route.fulfill({ json: { providers: fixture.providers } }),
  );
  await page.route("**/api/providers/refresh", async (route) =>
    route.fulfill({ json: { providers: await fixture.registry.refresh() } }),
  );
  return fixture;
}
const table = (page: Page) =>
  page.getByRole("table", { name: "Discovered provider status and automation support" });

test("real Settings displays the server snapshot and refreshes actual provider discovery", async ({
  page,
  request,
}) => {
  const snapshot = SettingsResponseSchema.parse(
    await (await request.get(E2E_API_URL + "/api/settings")).json(),
  );
  await page.goto("/settings");
  const general = page.getByRole("region", { name: "General", exact: true });
  for (const value of [
    snapshot.general.version,
    snapshot.general.environment,
    snapshot.general.nodeVersion,
    `${snapshot.general.platform} / ${snapshot.general.architecture}`,
  ])
    await expect(general).toContainText(value);
  const storage = page.getByRole("region", { name: "Storage", exact: true });
  await expect(storage).toContainText(snapshot.storage.dataDir);
  await expect(storage).toContainText(snapshot.storage.workspaceRoot);
  const network = page.getByRole("region", { name: "Network and Security" });
  await expect(network).toContainText(snapshot.network.host);
  await expect(network).toContainText(String(snapshot.network.port));
  await expect(network).toContainText("Not enabled");
  for (const origin of snapshot.network.webOrigins) await expect(network).toContainText(origin);
  await expect(page.locator("main input, main select, main textarea")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refresh providers", exact: true })).toBeEnabled();
  const refreshed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/providers/refresh") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Refresh providers", exact: true }).click();
  const response = await refreshed;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({});
  const providers = ProviderListResponseSchema.parse(await response.json()).providers;
  await expect(table(page).getByRole("row")).toHaveCount(providers.length + 1);
  for (const provider of providers) {
    const row = table(page).getByRole("row").filter({ hasText: provider.name });
    await expect(row).toContainText(provider.available ? "Available" : "Unavailable");
    await expect(row).toContainText(
      provider.capabilities.automation ? "Supported" : "Not supported",
    );
  }
  await expect(page.getByText("Providers refreshed.", { exact: true })).toBeVisible();
});

test("production non-loopback configuration warns honestly and keeps Fake disabled", async ({
  page,
}) => {
  await controlled(page, true, "0.0.0.0");
  await page.goto("/settings");
  await expect(page.getByRole("region", { name: "General" })).toContainText("production");
  await expect(page.getByRole("alert")).toContainText("Non-loopback exposure");
  await expect(page.getByRole("alert")).toContainText("no authentication");
  await expect(
    table(page).getByRole("row").filter({ hasText: "Fake agent (development)" }),
  ).toContainText("Disabled in production");
  await expect(table(page).getByRole("row").filter({ hasText: "Codex" })).toContainText("Unknown");
  await expect(page.getByRole("region", { name: "Storage" })).toContainText(
    "requires a server restart",
  );
});

test("failed provider refresh retains the old snapshot and recovery clears the error", async ({
  page,
}) => {
  await controlled(page);
  let failed = true;
  await page.route("**/api/providers/refresh", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: { code: "PROVIDER_DETECTION_FAILED", message: "Retry discovery" } },
        })
      : route.fallback(),
  );
  await page.goto("/settings");
  await expect(table(page).getByRole("row")).toHaveCount(8);
  await page.getByRole("button", { name: "Refresh providers", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Showing the last known provider snapshot");
  await expect(table(page).getByRole("row")).toHaveCount(8);
  failed = false;
  await page.getByRole("button", { name: "Refresh providers", exact: true }).click();
  await expect(page.getByText("Providers refreshed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("initial runtime failure offers Retry while independently loaded providers stay visible", async ({
  page,
}) => {
  await controlled(page);
  let failed = true;
  await page.route("**/api/settings", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: { code: "UNAVAILABLE", message: "Test connection" } },
        })
      : route.fallback(),
  );
  await page.goto("/settings");
  await expect(page.getByRole("alert")).toContainText("Settings could not be loaded");
  await expect(table(page).getByRole("row")).toHaveCount(8);
  await expect(page.getByRole("region", { name: "Storage" })).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Retry settings", exact: true }).click();
  await expect(page.getByRole("region", { name: "Storage" })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("initial provider failure has no fabricated statuses and retries through explicit refresh", async ({
  page,
}) => {
  await controlled(page);
  await page.route("**/api/providers", (route) =>
    route.fulfill({
      status: 503,
      json: { error: { code: "UNAVAILABLE", message: "Test connection" } },
    }),
  );
  await page.goto("/settings");
  await expect(page.getByRole("alert")).toContainText("Providers could not be loaded");
  await expect(table(page)).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Storage" })).toBeVisible();
  await page.getByRole("button", { name: "Retry providers", exact: true }).click();
  await expect(table(page).getByRole("row")).toHaveCount(8);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("in-flight refresh disables the action and keeps existing provider data readable", async ({
  page,
}) => {
  await controlled(page);
  let complete = () => {};
  const gate = new Promise<void>((resolve) => {
    complete = resolve;
  });
  let requests = 0;
  await page.route("**/api/providers/refresh", async (route) => {
    requests++;
    await gate;
    await route.fallback();
  });
  await page.goto("/settings");
  const button = page.getByRole("button", { name: "Refresh providers", exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(
    page.getByRole("button", { name: "Refreshing providers…", exact: true }),
  ).toBeDisabled();
  await expect(table(page).getByRole("row")).toHaveCount(8);
  await expect.poll(() => requests).toBe(1);
  complete();
  await expect(page.getByText("Providers refreshed.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh providers", exact: true })).toBeEnabled();
  expect(requests).toBe(1);
});
