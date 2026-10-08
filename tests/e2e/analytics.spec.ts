import { test, expect, type Page } from "@playwright/test";
import { AnalyticsQuerySchema } from "@qelvra/shared";
import { analyticsFixture } from "../fixtures/analytics-service";
import { E2E_API_URL } from "./env";
async function controlled(page: Page, corrupt = false) {
  const fixture = await analyticsFixture(corrupt);
  await page.route("**/api/agents", (route) =>
    route.fulfill({ json: { agents: fixture.registry.list() } }),
  );
  await page.route("**/api/analytics**", async (route) => {
    const query = AnalyticsQuerySchema.parse(
      Object.fromEntries(new URL(route.request().url()).searchParams),
    );
    await route.fulfill({ json: await fixture.service.get(query) });
  });
  return fixture;
}
async function dates(page: Page, from = "2026-10-01", to = "2026-10-05") {
  await page.getByLabel("Date range", { exact: true }).selectOption("custom");
  await page.getByLabel("From UTC date", { exact: true }).fill(from);
  await page.getByLabel("To UTC date", { exact: true }).fill(to);
  await expect(page.getByTestId("analytics-range")).toContainText(
    from + "T00:00:00.000Z to " + to + "T00:00:00.000Z",
  );
}
test("real event creation changes counts on Refresh and uses the real registry agent filter", async ({
  page,
  request,
}) => {
  await page.goto("/analytics");
  await expect(page.getByTestId("recorded-events")).toBeVisible();
  const before = Number(
    (await page.getByTestId("recorded-events").innerText()).replaceAll(",", ""),
  );
  const response = await request.post(E2E_API_URL + "/api/agents", {
    data: { name: `Analytics ${Date.now()}`, role: "Engineer", providerId: "fake" },
  });
  expect(response.status()).toBe(201);
  const agent = (await response.json()).agent;
  const taskResponse = await request.post(E2E_API_URL + "/api/tasks", {
    data: { title: "PRIVATE_ANALYTICS_TASK_BODY", assignee: agent.id },
  });
  expect(taskResponse.status()).toBe(201);
  const task = (await taskResponse.json()).task;
  try {
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(
      page.getByLabel("Analytics agent").locator(`option[value="${agent.id}"]`),
    ).toHaveCount(1);
    await expect
      .poll(async () =>
        Number((await page.getByTestId("recorded-events").innerText()).replaceAll(",", "")),
      )
      .toBeGreaterThanOrEqual(before + 2);
    await page.getByLabel("Analytics agent").selectOption(agent.id);
    await expect(page.getByTestId("analytics-range")).toContainText(" · " + agent.id);
    const expected = (
      await (await request.get(E2E_API_URL + "/api/analytics?agentId=" + agent.id)).json()
    ).summary.recordedEvents;
    await expect(page.getByTestId("recorded-events")).toHaveText(expected.toLocaleString());
    await expect(page.getByRole("region", { name: "Event type breakdown" })).toContainText(
      "agent.created",
    );
    await expect(page.getByRole("region", { name: "Event type breakdown" })).toContainText(
      "task.created",
    );
    await expect(page.locator("main")).not.toContainText("PRIVATE_ANALYTICS_TASK_BODY");
    await expect(page.locator("main")).toContainText("Not available yet");
  } finally {
    await request.delete(E2E_API_URL + "/api/tasks/" + task.id);
    await request.delete(E2E_API_URL + "/api/agents/" + agent.id);
  }
});
test("UTC date filters show exact buckets, real zero days and multi-agent involvement", async ({
  page,
}) => {
  const fixture = await controlled(page);
  try {
    await page.goto("/analytics");
    await dates(page);
    await expect(page.getByTestId("recorded-events")).toHaveText("7");
    await page.getByText("Daily values (UTC)", { exact: true }).click();
    const table = page.getByRole("table", { name: "Daily recorded events", exact: true });
    await expect(table.getByRole("row")).toHaveCount(5);
    await expect(table.getByRole("row").filter({ hasText: "2026-10-03" })).toContainText("0");
    await expect(page.getByRole("region", { name: "Agent involvement" })).toContainText(
      "Deleted / unregistered agent",
    );
    await expect(page.locator("main")).not.toContainText("PRIVATE");
    await page.getByLabel("Analytics agent").selectOption("atlas");
    await expect(page.getByTestId("recorded-events")).toHaveText("1");
    await expect(page.getByTestId("involved-agents")).toHaveText("2");
    await expect(page.getByRole("region", { name: "Agent involvement" })).toContainText("Nova");
    await expect(page.getByRole("region", { name: "Agent involvement" })).toContainText("Atlas");
  } finally {
    await fixture.close();
  }
});
test("empty ranges keep zero summaries and daily values with no sample fallback", async ({
  page,
}) => {
  const fixture = await controlled(page);
  try {
    await page.goto("/analytics");
    await dates(page, "2026-10-03", "2026-10-04");
    await expect(page.getByTestId("recorded-events")).toHaveText("0");
    await expect(
      page.getByText("No recorded Activity events in this range.", { exact: true }),
    ).toBeVisible();
    await page.getByText("Daily values (UTC)", { exact: true }).click();
    const table = page.getByRole("table", { name: "Daily recorded events", exact: true });
    await expect(table.getByRole("row")).toHaveCount(2);
    await expect(table.getByRole("row").nth(1)).toContainText("0");
  } finally {
    await fixture.close();
  }
});
test("failed refresh preserves the last snapshot and recovery clears the warning", async ({
  page,
}) => {
  const fixture = await controlled(page);
  try {
    await page.goto("/analytics");
    await dates(page);
    await expect(page.getByTestId("recorded-events")).toHaveText("7");
    let failed = true;
    await page.route("**/api/analytics**", (route) =>
      failed
        ? route.fulfill({
            status: 503,
            json: { error: { code: "UNAVAILABLE", message: "Test disconnection" } },
          })
        : route.fallback(),
    );
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Showing the last known snapshot");
    await expect(page.getByTestId("recorded-events")).toHaveText("7");
    failed = false;
    await page.getByRole("button", { name: "Refresh", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByTestId("recorded-events")).toHaveText("7");
  } finally {
    await fixture.close();
  }
});
test("initial API failure offers Retry without inventing a snapshot", async ({ page }) => {
  const fixture = await controlled(page);
  try {
    let failed = true;
    await page.route("**/api/analytics**", (route) =>
      failed
        ? route.fulfill({
            status: 503,
            json: { error: { code: "UNAVAILABLE", message: "Test disconnection" } },
          })
        : route.fallback(),
    );
    await page.goto("/analytics");
    await expect(page.getByRole("alert")).toContainText("Analytics could not be loaded");
    await expect(page.getByTestId("recorded-events")).toHaveCount(0);
    failed = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByTestId("recorded-events")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    await fixture.close();
  }
});
test("actual corrupt retained history warns about missing recording without exposing the corrupt line", async ({
  page,
}) => {
  const fixture = await controlled(page, true);
  try {
    await page.goto("/analytics");
    await dates(page);
    const coverage = page.getByRole("region", { name: "Coverage and recording health" });
    await expect(coverage).toContainText(
      "Some activity may be missing because event recording reported errors",
    );
    await expect(coverage).toContainText("Unreadable or duplicate journal entries were skipped");
    await expect(page.locator("main")).not.toContainText("PRIVATE_CORRUPTION");
  } finally {
    await fixture.close();
  }
});
