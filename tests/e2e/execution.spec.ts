import { randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { E2E_API_URL } from "./env";
test.describe(() => {
  test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 500/],
  });
  test("failed provider discovery offers a reload and recovers Execute for the same task", async ({
    page,
    request,
  }) => {
    const suffix = randomBytes(3).toString("hex");
    const agent = (
      await (
        await request.post(`${E2E_API_URL}/api/agents`, {
          data: { name: `Retry Nova ${suffix}`, role: "Frontend", providerId: "fake" },
        })
      ).json()
    ).agent as { id: string };
    const task = (
      await (
        await request.post(`${E2E_API_URL}/api/tasks`, {
          data: { title: `Provider retry ${suffix}`, assignee: agent.id },
        })
      ).json()
    ).task as { id: string };
    let fail = true;
    await page.route("**/api/providers", (route) =>
      fail
        ? route.fulfill({
            status: 500,
            json: { error: { code: "INTERNAL_ERROR", message: "Provider discovery failed" } },
          })
        : route.continue(),
    );
    await page.goto(`/tasks?task=${task.id}`);
    const inspector = page.getByRole("region", { name: "Task details" });
    await expect(inspector.getByRole("alert")).toContainText(
      "Provider availability could not be loaded",
    );
    await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeDisabled();
    fail = false;
    await inspector.getByRole("button", { name: "Reload providers" }).click();
    await expect(inspector.getByTestId("task-status")).toHaveText("Assigned");
    await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeEnabled();
    await expect(page).toHaveURL(`/tasks?task=${task.id}`);
  });
});
async function create(page: Page, request: APIRequestContext, prefix = "Build login form") {
  const suffix = randomBytes(3).toString("hex");
  const response = await request.post(`${E2E_API_URL}/api/agents`, {
    data: { name: `Fake Nova ${suffix}`, role: "Frontend", providerId: "fake" },
  });
  expect(response.status()).toBe(201);
  const agent = (await response.json()).agent as { id: string };
  const title = `${prefix} ${suffix}`;
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Create Task", exact: true }).click();
  const form = page.getByRole("dialog");
  await form.getByLabel("Title", { exact: true }).fill(title);
  await form
    .getByLabel("Description", { exact: true })
    .fill("Create the frontend login form and validation");
  await form.getByLabel("Assignee (optional)").selectOption(agent.id);
  await form.getByRole("button", { name: "Create", exact: true }).click();
  await expect(form).toHaveCount(0);
  await page.getByRole("button", { name: `Inspect ${title}`, exact: true }).click();
  const inspector = page.getByRole("region", { name: "Task details" });
  await expect(inspector.getByTestId("task-status")).toHaveText("Assigned");
  await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeEnabled();
  return { inspector, title };
}
test("fake execution goes Assigned → Working → Review, displays results and requires manual Complete", async ({
  page,
  request,
}) => {
  const { inspector, title } = await create(page, request);
  await inspector.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await expect(inspector.getByRole("region", { name: "Task execution" })).toContainText("Running");
  await expect(inspector.getByRole("button", { name: "Send to Review" })).toBeDisabled();
  await expect(inspector.getByTestId("task-status")).toHaveText("Review", { timeout: 15000 });
  const result = inspector.getByRole("region", { name: "Task execution" });
  await expect(result).toContainText(`Completed: ${title}`);
  await expect(result).toContainText("Fake agent");
  await expect(result).toContainText("fixture.txt");
  await expect(result).toContainText("Deterministic execution fixture.");
  await expect(inspector.getByRole("button", { name: "Complete", exact: true })).toBeEnabled();
  await inspector.getByRole("button", { name: "Return to Working" }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeEnabled();
  await expect(inspector.getByRole("button", { name: "Cancel execution" })).toHaveCount(0);
  await inspector.getByRole("button", { name: "Send to Review" }).click();
  await inspector.getByRole("button", { name: "Complete", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Completed");
  await page.reload();
  await expect(inspector.getByTestId("task-status")).toHaveText("Completed");
  await expect(inspector.getByRole("region", { name: "Task execution" })).toContainText(
    "fixture.txt",
  );
});
test("cancel stops a running execution and leaves the task Assigned and retryable", async ({
  page,
  request,
}) => {
  const { inspector } = await create(page, request, "[fixture:timeout] Cancel work");
  await inspector.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await inspector.getByRole("button", { name: "Cancel execution" }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Assigned");
  await expect(inspector.getByRole("alert")).toContainText("Execution cancelled");
  await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeEnabled();
});
test("invalid provider output displays a controlled error and allows retry", async ({
  page,
  request,
}) => {
  const { inspector } = await create(page, request, "[fixture:invalid] Invalid result");
  await inspector.getByRole("button", { name: "Execute", exact: true }).click();
  await expect(inspector.getByTestId("task-status")).toHaveText("Working");
  await expect(inspector.getByRole("alert")).toContainText("Invalid result format", {
    timeout: 15000,
  });
  await expect(inspector.getByTestId("task-status")).toHaveText("Assigned");
  await expect(inspector.getByRole("button", { name: "Execute", exact: true })).toBeEnabled();
  await expect(inspector).not.toContainText("QELVRA_RESULT_START");
});
