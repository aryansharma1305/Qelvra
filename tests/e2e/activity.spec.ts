import { randomBytes } from "node:crypto";
import { TaskResponseSchema } from "@qelvra/shared";
import { expect, test } from "./fixtures";
import { E2E_API_URL } from "./env";
test("real activity survives navigation and updates live after task actions", async ({
  page,
  request,
}) => {
  const id = `activity-nova-${randomBytes(4).toString("hex")}`;
  const name = `Nova ${id}`;
  const title = `Build login ${id}`;
  expect(
    (
      await request.post(`${E2E_API_URL}/api/agents`, { data: { id, name, role: "Frontend" } })
    ).status(),
  ).toBe(201);
  try {
    expect((await request.post(`${E2E_API_URL}/api/agents/${id}/start`)).ok()).toBeTruthy();
    const response = await request.post(`${E2E_API_URL}/api/tasks`, {
      data: { title, description: "PRIVATE_E2E_DESCRIPTION" },
    });
    const { task } = TaskResponseSchema.parse(await response.json());
    expect(
      (
        await request.post(`${E2E_API_URL}/api/tasks/${task.id}/assign`, { data: { agentId: id } })
      ).ok(),
    ).toBeTruthy();
    await page.goto("/activity");
    const feed = page.getByTestId("team-activity");
    await expect(feed.getByText(`${name} started`, { exact: true })).toBeVisible();
    await expect(feed.getByText(`${title} assigned to ${name}`, { exact: true })).toBeVisible();
    const created = feed.getByText(`${title} created`, { exact: true });
    await expect(created).toHaveAttribute("href", `/tasks?task=${encodeURIComponent(task.id)}`);
    expect((await request.post(`${E2E_API_URL}/api/tasks/${task.id}/start`)).ok()).toBeTruthy();
    await expect(feed.getByText(`${title} started`, { exact: true })).toBeVisible();
    await expect(
      feed.locator('[data-activity-type="task.started"]').filter({ hasText: title }),
    ).toHaveCount(1);
    await feed.getByRole("button", { name: "Messages", exact: true }).click();
    await expect(feed.getByText(`${title} started`, { exact: true })).toHaveCount(0);
    await feed.getByRole("button", { name: "Tasks", exact: true }).click();
    await expect(feed.getByText(`${title} started`, { exact: true })).toBeVisible();
    await page.goto("/");
    await expect(
      page.getByTestId("team-activity").getByText(`${title} started`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("activity-metrics")).not.toContainText("92% load");
    await expect(page.locator("main")).not.toContainText("PRIVATE_E2E_DESCRIPTION");
    await page.goto("/activity");
    await page.reload();
    await expect(page.getByText(`${title} started`, { exact: true })).toBeVisible();
  } finally {
    expect((await request.delete(`${E2E_API_URL}/api/agents/${id}`)).status()).toBe(204);
  }
});
test("activity has honest empty filters and an actionable connection error", async ({ page }) => {
  await page.goto("/activity");
  const feed = page.getByTestId("team-activity");
  await feed.getByRole("button", { name: "Messages", exact: true }).click();
  await expect(feed.getByText("No messages activity yet.")).toBeVisible();
  await page.routeWebSocket("**/ws/activity", (socket) => socket.close());
  await page.reload();
  await expect(page.getByRole("button", { name: "Retry", exact: true })).toBeVisible({
    timeout: 20000,
  });
});
