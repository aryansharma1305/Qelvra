import { randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { TaskResponseSchema } from "@qelvra/shared";
import { expect, test } from "./fixtures";
import { E2E_API_URL } from "./env";
const unique = (name: string) => `${name} ${randomBytes(3).toString("hex")}`;
async function agent(request: APIRequestContext, name: string) {
  const res = await request.post(`${E2E_API_URL}/api/agents`, {
    data: { name, role: "Task test" },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).agent as { id: string; name: string };
}
async function create(page: Page, title: string, assignee?: string) {
  await page.getByRole("button", { name: "Create Task", exact: true }).click();
  const form = page.getByRole("dialog");
  await expect(form.getByLabel("Title", { exact: true })).toBeFocused();
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form
    .getByLabel("Description", { exact: true })
    .fill("Create the frontend login form and validation");
  if (assignee) await form.getByLabel("Assignee (optional)").selectOption(assignee);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: `Inspect ${title}`, exact: true }).click();
  return page.getByRole("region", { name: "Task details" });
}
test("task lifecycle: Inbox → Assigned → Working → Review → Completed, persisted after reload", async ({
  page,
  request,
}) => {
  const nova = await agent(request, unique("Nova"));
  const title = unique("Build login form");
  await page.goto("/tasks");
  const inspector = await create(page, title);
  await expect(inspector.getByTestId("task-status")).toHaveText("Inbox");
  await inspector.getByLabel("Assign agent").selectOption(nova.id);
  await inspector.getByRole("button", { name: "Assign", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Assigned");
  await inspector.getByRole("button", { name: "Start", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await inspector.getByRole("button", { name: "Send to Review" }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Review");
  await inspector.getByRole("button", { name: "Return to Working" }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await inspector.getByRole("button", { name: "Send to Review" }).click();
  await inspector.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Completed");
  await expect(inspector.getByText("Read-only", { exact: true })).toBeVisible();
  await page.reload();
  await expect(inspector.getByRole("heading", { name: title })).toBeVisible();
  await expect(inspector.getByTestId("task-status")).toHaveText("Completed");
  await inspector.getByRole("button", { name: "Close task details" }).click();
  await expect(
    page
      .locator('[data-task-column="completed"]')
      .getByRole("button", { name: `Inspect ${title}` }),
  ).toBeVisible();
});
test("deleting Atlas returns its active task to Inbox without losing content", async ({
  page,
  request,
}) => {
  const atlas = await agent(request, unique("Atlas"));
  const title = unique("Create API");
  await page.goto("/tasks");
  const inspector = await create(page, title, atlas.id);
  await inspector.getByRole("button", { name: "Start", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  const id = await inspector.getAttribute("data-task");
  await page.goto(`/agents/${atlas.id}`);
  await page.getByRole("button", { name: "Delete agent" }).click();
  await page
    .getByRole("group", { name: /Confirm deleting/ })
    .getByRole("button", { name: "Delete" })
    .click();
  await expect(page).toHaveURL("/agents");
  await page.goto(`/tasks?task=${id}`);
  await expect(inspector.getByTestId("task-status")).toHaveText("Inbox");
  await expect(inspector).toContainText("Create the frontend login form and validation");
  await expect(
    inspector.getByLabel("Assign agent").locator(`option[value="${atlas.id}"]`),
  ).toHaveCount(0);
  expect(
    TaskResponseSchema.parse(await (await request.get(`${E2E_API_URL}/api/tasks/${id}`)).json())
      .task.assignee,
  ).toBeNull();
});
test("failed tasks have a real filter and a read-only inspector; cards toggle and Escape restores focus", async ({
  page,
  request,
}) => {
  const nova = await agent(request, unique("Failed Nova"));
  const title = unique("Failure");
  await page.goto("/tasks");
  const inspector = await create(page, title, nova.id);
  await inspector.getByRole("button", { name: "Fail", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Failed");
  await page.keyboard.press("Escape");
  await page.getByLabel("Filter tasks").selectOption("failed");
  const card = page.getByRole("button", { name: `Inspect ${title}`, exact: true });
  await expect(card).toBeVisible();
  await card.click();
  await expect(inspector.getByText("Read-only", { exact: true })).toBeVisible();
  await card.click();
  await expect(inspector).toHaveCount(0);
  await card.click();
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
});
test.describe(() => {
  test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 500/],
  });
  test("loading, empty, validation, failed creation and retry are honest and recoverable", async ({
    page,
  }) => {
    let blocked = true;
    await page.route("**/api/tasks", async (route) => {
      if (route.request().method() === "GET") {
        if (blocked)
          await route.fulfill({
            status: 500,
            json: { error: { code: "INTERNAL_ERROR", message: "Could not load tasks" } },
          });
        else await route.fulfill({ json: { tasks: [] } });
      } else
        await route.fulfill({
          status: 500,
          json: { error: { code: "TASK_PERSISTENCE_FAILED", message: "Could not save tasks" } },
        });
    });
    await page.goto("/tasks");
    await expect(page.getByRole("alert")).toContainText("Could not load tasks");
    blocked = false;
    await page.getByRole("button", { name: "Retry", exact: true }).click();
    await expect(page.getByRole("heading", { name: "No tasks yet" })).toBeVisible();
    await page.keyboard.press("ControlOrMeta+n");
    const form = page.getByRole("dialog");
    await form.getByRole("button", { name: "Create", exact: true }).click();
    await expect(form.getByRole("alert")).toBeVisible();
    await form.getByLabel("Title", { exact: true }).fill("Good title");
    await form.getByRole("button", { name: "Create", exact: true }).click();
    await expect(form.getByRole("alert")).toContainText("Could not save tasks");
    await expect(form.getByLabel("Title", { exact: true })).toHaveValue("Good title");
    await expect(form.getByRole("button", { name: "Create", exact: true })).toBeEnabled();
    await page.keyboard.press("Escape");
    await expect(form).toHaveCount(0);
  });
});
