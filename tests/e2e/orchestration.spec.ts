import { randomBytes } from "node:crypto";
import type { APIRequestContext, Page } from "@playwright/test";
import { OrchestrationSchema } from "@qelvra/shared";
import { test, expect } from "./fixtures";
import { E2E_API_URL } from "./env";
async function createGoal(page: Page, request: APIRequestContext, title: string) {
  const suffix = randomBytes(3).toString("hex");
  let orchestrator = "";
  for (const [name, role] of [
    ["Michael", "Orchestrator"],
    ["Nova", "Frontend Engineer"],
    ["Atlas", "Backend Engineer"],
  ]) {
    const response = await request.post(`${E2E_API_URL}/api/agents`, {
      data: { name: `${name} ${suffix}`, role, providerId: "fake" },
    });
    expect(response.status()).toBe(201);
    if (name === "Michael") orchestrator = (await response.json()).agent.id;
  }
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "New Goal", exact: true }).click();
  const form = page.getByRole("form", { name: "New Goal" });
  await form.getByLabel("Goal title", { exact: true }).fill(`${title} ${suffix}`);
  await form
    .getByLabel("Goal description")
    .fill("A small frontend and API in isolated workspaces.");
  await form
    .getByRole("combobox", { name: "Orchestrator", exact: true })
    .selectOption(orchestrator);
  await form.getByRole("button", { name: "Create Goal" }).click();
  const details = page.getByRole("article", { name: "Goal details" });
  await expect(details.getByRole("status")).toContainText("Draft");
  await details.getByRole("button", { name: "Generate Plan" }).click();
  await expect(details.getByRole("button", { name: "Run Plan" })).toBeVisible({ timeout: 15000 });
  return { details, id: new URL(page.url()).searchParams.get("goal") ?? "" };
}
test("Goal → Plan → Run completes real Mission Control tasks and live Activity", async ({
  page,
  request,
  context,
}) => {
  test.setTimeout(60000);
  const { details, id } = await createGoal(page, request, "Build frontend and backend");
  await expect(
    details.getByRole("region", { name: "Task breakdown" }).getByRole("listitem"),
  ).toHaveCount(2);
  const activity = await context.newPage();
  await activity.goto("/activity");
  await expect(activity.getByText("Goal plan ready", { exact: true }).first()).toBeVisible();
  await details.getByRole("button", { name: "Run Plan" }).click();
  await expect(details.getByRole("status")).toContainText("Running");
  await expect(details.getByRole("region", { name: "Final goal summary" })).toBeVisible({
    timeout: 30000,
  });
  await expect(details.getByRole("status")).toContainText("2 / 2 tasks completed");
  await expect(activity.getByText("Goal completed", { exact: true }).first()).toBeVisible();
  await expect(details).toContainText("Workspaces are separate");
  const goal = OrchestrationSchema.parse(
    (await (await request.get(`${E2E_API_URL}/api/orchestrations/${id}`)).json()).orchestration,
  );
  expect(goal.tasks.map((t) => t.attempts)).toEqual([1, 1]);
  for (const slot of goal.tasks) {
    const task = (await (await request.get(`${E2E_API_URL}/api/tasks/${slot.taskId}`)).json()).task;
    expect(task.status).toBe("completed");
    await expect(details.locator(`a[href="/agents/${slot.agentId}"]`).first()).toBeVisible();
  }
  await details.getByRole("link", { name: "Build landing page frontend", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Task details" }).getByTestId("task-status"),
  ).toHaveText("Completed");
  await expect(page.getByRole("region", { name: "Task execution" })).toContainText("fixture.txt");
  await activity.close();
});
test("goal rework shows attempt two and finishes with an approved result", async ({
  page,
  request,
}) => {
  test.setTimeout(60000);
  const { details, id } = await createGoal(page, request, "[fixture:rework] Rework frontend");
  await details.getByRole("button", { name: "Run Plan" }).click();
  await expect(details).toContainText("Attempt 2 / 3", { timeout: 30000 });
  await expect(details.getByRole("region", { name: "Final goal summary" })).toBeVisible({
    timeout: 30000,
  });
  const goal = OrchestrationSchema.parse(
    (await (await request.get(`${E2E_API_URL}/api/orchestrations/${id}`)).json()).orchestration,
  );
  expect(goal.tasks[0]?.attempts).toBe(2);
});
