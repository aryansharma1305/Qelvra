import { TaskListResponseSchema } from "@qelvra/shared";
import { E2E_API_URL } from "./env";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const sidebar = (page: Page) => page.locator("aside nav");

test("home renders inside the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Welcome to/ })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

const designedRoutes = [
  { link: "AI Studio", path: "/studio", heading: "AI Studio — Swarm Office" },
  { link: "Agents", path: "/agents", heading: "Your AI Team" },
  { link: "Activity", path: "/activity", heading: "Activity" },
  { link: "Files", path: "/files", heading: "Files" },
  { link: "Memory", path: "/memory", heading: "Memory" },
  { link: "Analytics", path: "/analytics", heading: "Analytics" },
  { link: "Settings", path: "/settings", heading: "Settings" },
  { link: "Automations", path: "/automations", heading: "Automations" },
  { link: "Tasks", path: "/tasks", heading: "Mission Control" },
  { link: "Terminal", path: "/terminal", text: "Swarm Console" },
  { link: "Agent Network", path: "/network", text: "Agent Network" },
];

for (const route of designedRoutes) {
  test(`sidebar navigates to ${route.link}`, async ({ page }) => {
    await page.goto("/");
    await sidebar(page).getByRole("link", { name: route.link }).click();
    await expect(page).toHaveURL(route.path);
    await expect(sidebar(page).getByRole("link", { name: route.link })).toHaveAttribute(
      "aria-current",
      "page",
    );
    if (route.heading) {
      await expect(page.getByRole("heading", { name: route.heading, exact: true })).toBeVisible();
    } else if (route.text) {
      await expect(page.getByText(route.text).first()).toBeVisible();
    }
  });
}

test("header shortcuts navigate", async ({ page }) => {
  await page.goto("/agents");
  await page
    .locator("header")
    .getByRole("link")
    .filter({ hasText: /Agents/ })
    .click();
  await expect(page).toHaveURL("/agents");
  await expect(page.getByRole("heading", { name: "Your AI Team" })).toBeVisible();
  await page.getByRole("link", { name: "Qelvra Brand Mark" }).click();
  await expect(page).toHaveURL("/");
});

test("unknown routes show not found inside the shell", async ({ page }) => {
  await page.goto("/does-not-exist");
  await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  await expect(page.locator("aside nav")).toBeVisible();
});

test("home topology button opens the agent network", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Topology Graph" }).click();
  await expect(page).toHaveURL("/network");
});

test.describe(() => {
  // Unregistered agent ids answer 404, which the browser logs.
  test.use({
    allowedConsoleErrors: [/Failed to load resource: the server responded with a status of 404/],
  });

  test("preview cards open the real agent directory instead of missing sample profiles", async ({
    page,
  }) => {
    // Home and Swarm are still design dashboards; their cards link to /agents/:id, which
    // shows the real profile if that agent is registered and "Agent not found" otherwise.
    await page.goto("/");
    await page.getByRole("link", { name: /^grain Michael/ }).click();
    await expect(page).toHaveURL("/agents");
    await expect(page.getByRole("heading", { name: "Your AI Team" })).toBeVisible();

    await page.goto("/swarm");
    await page.getByRole("link", { name: /^brush Nova/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/agents");
  });
});

test("deep links and reloads render the right page", async ({ page }) => {
  await page.goto("/tasks");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Mission Control" })).toBeVisible();
  await page.goto("/agents/new?step=4");
  await page.reload();
  await expect(page.locator("#step-panel-4")).toBeVisible();
});

test("team activity tabs filter real events", async ({ page, request }) => {
  const res = await request.post(`${E2E_API_URL}/api/tasks`, {
    data: { title: "Activity filter task" },
  });
  expect(res.ok()).toBeTruthy();
  await page.goto("/");
  const feed = page.getByTestId("team-activity");
  await feed.getByRole("button", { name: "Tasks", exact: true }).click();
  await expect(feed.getByText("Activity filter task created", { exact: true })).toBeVisible();
  await feed.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(feed.getByText("Activity filter task created", { exact: true })).toHaveCount(0);
  await feed.getByRole("button", { name: "All", exact: true }).click();
  await expect(feed.getByText("Activity filter task created", { exact: true })).toBeVisible();
});

test("task board column badges match the real task snapshot", async ({ page, request }) => {
  const snapshot = TaskListResponseSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/tasks`)).json(),
  );
  // Other workers may mutate the shared test registry. Use the actual API snapshot
  // for this rendering assertion, rather than racing another worker's create/start.
  await page.route("**/api/tasks", (route) => route.fulfill({ json: snapshot }));
  await page.goto("/tasks");
  for (const status of ["inbox", "assigned", "working", "review", "completed"]) {
    const count = snapshot.tasks.filter((task) => task.status === status).length;
    const column = page.locator(`[data-task-column="${status}"]`);
    await expect(column.locator(".task-card")).toHaveCount(count);
    await expect(column.locator("div.rounded-t-xl span.font-label-sm.rounded-full")).toHaveText(
      String(count),
    );
  }
});
