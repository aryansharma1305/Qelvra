import { required } from "../fixtures/automations";
import { test, expect, type Page } from "@playwright/test";
import { E2E_API_URL } from "./env";
import { AutomationListSchema } from "@qelvra/shared";
// Automation admission is intentionally globally serial: this file uses one worker.
test.describe.configure({ mode: "serial", timeout: 45000 });
let agentId: string;
test.beforeAll(async ({ request }) => {
  agentId = `automation-browser-${Date.now()}`;
  expect(
    (
      await request.post(`${E2E_API_URL}/api/agents`, {
        data: {
          id: agentId,
          name: "Automation browser agent",
          role: "Disposable",
          providerId: "fake",
        },
      })
    ).ok(),
  ).toBe(true);
});
test.afterAll(async ({ request }) => {
  const response = await request.get(`${E2E_API_URL}/api/automations`);
  if (response.ok()) {
    const data = AutomationListSchema.parse(await response.json());
    for (const a of data.automations.filter((a) => a.agentId === agentId))
      await request.delete(`${E2E_API_URL}/api/automations/${a.id}`, {
        data: { revision: a.revision },
      });
  }
  await request.delete(`${E2E_API_URL}/api/agents/${agentId}`);
});
async function form(page: Page, title: string, interval = false) {
  await page.getByRole("button", { name: "New automation", exact: true }).click();
  await page.getByLabel("Automation title", { exact: true }).fill(title);
  await page.getByLabel("Task title", { exact: true }).fill("Browser scheduled review");
  await page.getByLabel("Task instructions", { exact: true }).fill("PRIVATE_BROWSER_PROMPT");
  await page.getByLabel("Assigned agent", { exact: true }).selectOption(agentId);
  if (interval) {
    await page.getByLabel("Cadence", { exact: true }).selectOption("interval");
    await page.getByLabel("Interval in minutes").fill("5");
  }
}
test("complete browser CRUD, interval controls, real next due and review-preserving Run now", async ({
  page,
  request,
}) => {
  const title = `Browser automation ${Date.now()}`;
  await page.goto("/automations");
  await form(page, title, true);
  await page.getByRole("button", { name: "Save automation", exact: true }).click();
  const details = page.getByRole("region", { name: "Automation details", exact: true });
  await expect(details).toContainText(title);
  await expect(details).toContainText("Every 5 minutes");
  await expect(details).toContainText("Not scheduled");
  await page.getByRole("button", { name: "Enable schedule", exact: true }).click();
  await expect(page.getByRole("button", { name: "Disable schedule", exact: true })).toBeVisible();
  await expect(details).not.toContainText("Not scheduled");
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Disable schedule", exact: true }).click();
  await expect(details).toContainText("Not scheduled");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Automation title", { exact: true }).fill(title + " edited");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(details).toContainText(title + " edited");
  await page.getByRole("button", { name: "Run now", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run history", exact: true })).toContainText(
    "Awaiting human review",
    { timeout: 20000 },
  );
  const link = page.getByRole("link", { name: "Open generated task", exact: true }).first(),
    href = await link.getAttribute("href"),
    taskId = new URL(required(href), "http://localhost").searchParams.get("task");
  expect(taskId).toBeTruthy();
  const task = (await (await request.get(`${E2E_API_URL}/api/tasks/${taskId}`)).json()).task;
  expect(task.status).toBe("review");
  expect(task.createdBy).toBe("automation");
  await page.reload();
  await expect(details).toContainText(title + " edited");
  await expect(page.getByRole("region", { name: "Run history", exact: true })).toContainText(
    "Awaiting human review",
  );
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Keep automation", exact: true }).click();
  await expect(details).toContainText(title + " edited");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(details).toHaveCount(0);
  expect((await request.get(`${E2E_API_URL}/api/tasks/${taskId}`)).ok()).toBe(true);
});
test("one-time schedule actually dispatches while local server is running", async ({ page }) => {
  await page.goto("/automations");
  await form(page, `One-time browser ${Date.now()}`);
  await page
    .getByLabel("First run (UTC)")
    .fill(new Date(Date.now() + 20000).toISOString().slice(0, 19).replace(/:00$/, ""));
  await page.getByRole("button", { name: "Save automation", exact: true }).click();
  await page.getByRole("button", { name: "Enable schedule", exact: true }).click();
  await expect(page.getByRole("region", { name: "Run history", exact: true })).toContainText(
    "Awaiting human review",
    { timeout: 40000 },
  );
  await expect(page.getByRole("button", { name: "Enable schedule", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Run history", exact: true })).toContainText(
    "Scheduled",
  );
});
test("mobile keyboard CRUD has labelled controls and no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/automations");
  await form(page, `Mobile automation ${Date.now()}`);
  const save = page.getByRole("button", { name: "Save automation", exact: true });
  await save.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("region", { name: "Automation details", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
});
test("loading failure retries and refresh preserves stale data with controls blocked", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/automations", (route) =>
    failed
      ? route.fulfill({
          status: 503,
          json: { error: { code: "AUTOMATION_UNAVAILABLE", message: "Server offline" } },
        })
      : route.continue(),
  );
  await page.goto("/automations");
  await expect(page.getByRole("alert").first()).toContainText("could not be loaded");
  failed = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByRole("region", { name: "Saved automations", exact: true })).toBeVisible();
  failed = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("last known state");
  await expect(page.getByRole("button", { name: "New automation", exact: true })).toBeDisabled();
});
test("invalid past schedule is explained and does not save", async ({ page }) => {
  await page.goto("/automations");
  await form(page, `Past automation ${Date.now()}`);
  await page.getByLabel("First run (UTC)").fill("2020-01-01T00:00");
  await page.getByRole("button", { name: "Save automation", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("future UTC time");
  await expect(page.getByRole("region", { name: "New automation", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});

test("interruption recovery requires an explicit acknowledgement and retains task inspection", async ({
  page,
  request,
}) => {
  const res = await request.post(`${E2E_API_URL}/api/automations`, {
    data: {
      title: "Interrupted UI fixture",
      taskTitle: "Inspect interrupted task",
      description: "Private instructions",
      agentId,
      schedule: { kind: "interval", startsAt: "2035-01-01T00:00:00.000Z", everyMinutes: 60 },
    },
  });
  const saved = (await res.json()).automation;
  const snapshot = AutomationListSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/automations`)).json(),
  );
  const automation = { ...saved, needsAttention: true, revision: 2 };
  snapshot.automations = [automation];
  await page.route("**/api/automations", (route) => route.fulfill({ json: snapshot }));
  await page.route(`**/api/automations/${saved.id}/runs`, (route) =>
    route.fulfill({ json: { runs: [], retained: 0, recorded: 0, truncated: false } }),
  );
  let acknowledged = false;
  await page.route(`**/api/automations/${saved.id}/enable`, (route) => {
    acknowledged = route.request().postDataJSON().acknowledgeInterruption === true;
    snapshot.automations = [
      {
        ...automation,
        needsAttention: false,
        enabled: true,
        nextRunAt: "2035-01-01T00:00:00.000Z",
        revision: 3,
      },
    ];
    return route.fulfill({ json: { automation: snapshot.automations[0] } });
  });
  await page.goto(`/automations?automation=${saved.id}`);
  await expect(page.getByRole("button", { name: "Run now", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Enable schedule", exact: true })).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Enable schedule", exact: true }).click();
  await expect(page.getByRole("button", { name: "Disable schedule", exact: true })).toBeVisible();
  expect(acknowledged).toBe(true);
  await request.delete(`${E2E_API_URL}/api/automations/${saved.id}`, {
    data: { revision: saved.revision },
  });
});
