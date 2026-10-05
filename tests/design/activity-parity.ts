import { expect, type Page, type APIRequestContext } from "@playwright/test";
import {
  ActivityListResponseSchema,
  ActivitySummarySchema,
  TaskListResponseSchema,
} from "@qelvra/shared";
import { E2E_API_URL } from "../e2e/env";
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing activity fixture");
  return value;
}
interface Fixture {
  title: string;
  detail: string;
  type: string;
  timestamp: string;
}
const TASK = "Auth0 schema migration & claim standardizer";
/** Last seeded task has exactly five lifecycle facts; no synthetic activity API. */
export async function readActivityFixture(request: APIRequestContext) {
  const activity = ActivityListResponseSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/activity?limit=5`)).json(),
  );
  const summary = ActivitySummarySchema.parse(
    await (await request.get(`${E2E_API_URL}/api/activity/summary`)).json(),
  );
  const events: Fixture[] = [
    {
      title: `${TASK} completed`,
      detail: "Assigned agent: Atlas",
      type: "task.completed",
      timestamp: "",
    },
    {
      title: `${TASK} moved to Review`,
      detail: "Assigned agent: Atlas",
      type: "task.review_requested",
      timestamp: "",
    },
    {
      title: `${TASK} started`,
      detail: "Assigned agent: Atlas",
      type: "task.started",
      timestamp: "",
    },
    {
      title: `${TASK} assigned to Atlas`,
      detail: "Assigned agent: Atlas",
      type: "task.assigned",
      timestamp: "",
    },
    {
      title: `${TASK} created`,
      detail: "Assigned agent: Atlas",
      type: "task.created",
      timestamp: "",
    },
  ];
  expect(activity.events.map((e) => e.type)).toEqual(events.map((e) => e.type));
  activity.events.forEach((event, n) => {
    expect(event.metadata).toMatchObject({ taskTitle: TASK, assigneeId: "atlas" });
    required(events[n]).timestamp = event.timestamp;
  });
  const tasks = TaskListResponseSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/tasks`)).json(),
  ).tasks;
  expect(summary).toEqual({
    activeAgents: 0,
    completedToday: 4,
    workingTasks: 3,
    recordedDeliveriesToday: 2,
  });
  expect(tasks).toHaveLength(14);
  return { events, summary };
}
export type ActivityFixture = Awaited<ReturnType<typeof readActivityFixture>>;
/** Approved frame with intentional canonical copy/colors; no timeline masking or cropping. */
export async function prepareHomeReference(page: Page, fixture: ActivityFixture) {
  await page.evaluate((fixture) => {
    function required<T>(value: T | null | undefined): T {
      if (value == null) throw new Error("Missing activity fixture");
      return value;
    }

    const heading = Array.from(document.querySelectorAll("h3")).find(
      (el) => el.textContent === "Team Activity",
    );
    const feed = heading?.parentElement?.parentElement?.parentElement;
    if (!feed) throw new Error("Missing reference feed");
    feed.setAttribute("data-testid", "team-activity");
    const filters = feed.querySelectorAll("button");
    ["All", "Agents", "Tasks", "Messages"].forEach((label, n) => {
      required(filters[n]).textContent = label;
    });
    const last = required(filters[3]).cloneNode(true) as HTMLElement;
    last.textContent = "System";
    required(required(filters[3]).parentElement).append(last);
    const rows = Array.from(required(feed.lastElementChild).children);
    fixture.events.forEach((event, n) => {
      const row = required(rows[n]);
      row.setAttribute("data-activity-type", event.type);
      const icon = required(row.children[0]);
      icon.className =
        "w-9 h-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary z-10 shrink-0";
      required(icon.firstElementChild).textContent = "task_alt";
      const content = required(row.children[1]);
      const title = required(required(content.firstElementChild).children[0]);
      title.textContent = event.title;
      title.className = "font-body-md text-body-md text-primary font-medium";
      required(required(content.firstElementChild).children[1]).textContent = "just now";
      const detail = required(content.children[1]);
      detail.textContent = event.detail;
      detail.className = "font-code-sm text-code-sm text-on-surface-variant mt-1";
    });
  }, fixture);
}
/** Normalize only relative times in the live timeline and validate ISO tooltips. */
export async function prepareHomeApp(page: Page, fixture: ActivityFixture) {
  const feed = page.getByTestId("team-activity");
  await expect(feed.locator("[data-activity-type]")).toHaveCount(5);
  for (const [n, event] of fixture.events.entries()) {
    const row = feed.locator("[data-activity-type]").nth(n);
    await expect(row).toHaveAttribute("data-activity-type", event.type);
    await expect(row.getByRole("link")).toHaveText(event.title);
    await expect(row.locator("p")).toHaveText(event.detail);
    await expect(row.locator("time")).toHaveAttribute("title", event.timestamp);
  }
  await feed.locator("time").evaluateAll((elements) =>
    elements.forEach((element) => {
      element.textContent = "just now";
    }),
  );
  await expect(page.getByTestId("activity-metrics")).toContainText("Completed Today");
}
