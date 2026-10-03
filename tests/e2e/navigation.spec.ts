import { TaskListResponseSchema } from "@qelvra/shared";
import { E2E_API_URL } from "./env";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

const sidebar = (page: Page) => page.locator("aside nav");

test("home renders inside the app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Good evening/ })).toBeVisible();
  await expect(sidebar(page).getByRole("link", { name: "Home" })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

const designedRoutes = [
  { link: "AI Studio", path: "/studio", heading: "AI Studio — Swarm Office" },
  { link: "Agents", path: "/agents", heading: "Your AI Team" },
  { link: "Tasks", path: "/tasks", heading: "Mission Control" },
  { link: "Terminal", path: "/terminal", text: "Swarm Console" },
  { link: "Agent Network", path: "/network", text: "Swarm Mesh Network" },
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
      await expect(page.getByRole("heading", { name: route.heading })).toBeVisible();
    } else if (route.text) {
      await expect(page.getByText(route.text).first()).toBeVisible();
    }
  });
}

for (const name of ["Activity", "Files", "Memory", "Automations", "Analytics", "Settings"]) {
  test(`${name} shows an explicit not-built-yet state`, async ({ page }) => {
    await page.goto("/");
    await sidebar(page).getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Not built yet")).toBeVisible();
  });
}

test("header shortcuts navigate", async ({ page }) => {
  await page.goto("/agents");
  await page
    .locator("header")
    .getByRole("link")
    .filter({ hasText: /Agents/ })
    .click();
  await expect(page).toHaveURL("/swarm");
  await expect(
    page.getByRole("heading", { name: /Your autonomous AI swarm is active/ }),
  ).toBeVisible();
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

  test("home and swarm operative cards link to agent profiles", async ({ page }) => {
    // Home and Swarm are still design dashboards; their cards link to /agents/:id, which
    // shows the real profile if that agent is registered and "Agent not found" otherwise.
    await page.goto("/");
    await page.getByRole("link", { name: /^grain Michael/ }).click();
    await expect(page).toHaveURL("/agents/michael");
    await expect(page.getByRole("heading", { name: "Agent not found" })).toBeVisible();

    await page.goto("/swarm");
    await page.getByRole("link", { name: /^brush Nova/ }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/agents/nova");
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

test("team activity tabs filter the feed", async ({ page }) => {
  await page.goto("/");
  const feed = page
    .getByText("Team Activity")
    .locator("xpath=ancestor::div[contains(@class,'lg:col-span-7')]");
  await feed.getByRole("button", { name: "Alerts" }).click();
  await expect(feed.getByText("Scout captured regression")).toBeVisible();
  await expect(feed.getByText("Michael assigned task to Nova")).toHaveCount(0);
  await feed.getByRole("button", { name: "Commits" }).click();
  await expect(feed.getByText("Nova published Pull Request #418")).toBeVisible();
  await feed.getByRole("button", { name: "All" }).click();
  await expect(feed.getByText("Michael assigned task to Nova")).toBeVisible();
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
