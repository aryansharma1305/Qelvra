import { test, expect, type Page } from "@playwright/test";
import { NetworkResponseSchema } from "@qelvra/shared";
import { networkFixture, observation, sources, NETWORK_NOW } from "../fixtures/network";
import { projectNetwork } from "../../apps/server/src/network/network-service";
import { E2E_API_URL } from "./env";
async function controlled(page: Page) {
  const data = networkFixture();
  await page.route("**/api/network?*", (route) => route.fulfill({ json: data }));
  return data;
}
test("Network reads actual registered agents and supports real detail navigation without mutations", async ({
  page,
  request,
}) => {
  const id = `network-real-${Date.now()}`;
  await request.post(`${E2E_API_URL}/api/agents`, {
    data: { id, name: "Network real agent", role: "Engineer" },
  });
  const mutations: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/") && r.method() !== "GET") mutations.push(r.url());
  });
  await page.goto("/network");
  await expect(page.getByRole("heading", { name: "Agent Network", exact: true })).toBeVisible();
  const snapshot = NetworkResponseSchema.parse(
    await (await request.get(`${E2E_API_URL}/api/network`)).json(),
  );
  expect(snapshot.nodes.some((n) => n.id === id)).toBe(true);
  await page
    .getByRole("button", { name: "Inspect Network real agent" })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("region", { name: "Selected agent details" })).toContainText(
    "No PTY",
  );
  await page.getByRole("link", { name: "Open agent", exact: true }).click();
  await expect(page).toHaveURL(`/agents/${id}`);
  expect(mutations).toEqual([]);
  await request.delete(`${E2E_API_URL}/api/agents/${id}`);
});
test("directed messages, orchestration membership, assignments and self-message counts remain distinct", async ({
  page,
}) => {
  const data = await controlled(page);
  await page.goto("/network");
  await page.getByRole("button", { name: "Inspect WORKER" }).filter({ visible: true }).click();
  const details = page.getByRole("region", { name: "Selected agent details" });
  await expect(details).toContainText("codex");
  await expect(details).toContainText("PTY present");
  await expect(details).toContainText("Task 1");
  await expect(details).toContainText("Goal 1");
  await expect(page.getByRole("list", { name: "Relationship evidence list" })).toContainText(
    "LEAD → WORKER: 1 queued · 1 delivered",
  );
  await expect(page.getByRole("list", { name: "Relationship evidence list" })).toContainText(
    "LEAD coordinates WORKER",
  );
  await expect(page.getByRole("region", { name: "Recorded message timeline" })).toContainText(
    `${data.timeline.length} / ${data.timeline.length}`,
  );
  await expect(page.getByRole("note")).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Shared RAM");
});
test("empty snapshots retain honest coverage and navigation", async ({ page }) => {
  const s = sources();
  s.agents = [];
  s.tasks = [];
  s.goals = [];
  s.runtimes = [];
  await page.route("**/api/network?*", (r) =>
    r.fulfill({ json: projectNetwork({}, s, new Date(NETWORK_NOW)) }),
  );
  await page.goto("/network");
  await expect(page.getByText("No registered agents yet.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Agents", exact: true })).toHaveAttribute(
    "href",
    "/agents",
  );
  await expect(page.getByRole("region", { name: "Coverage and recording health" })).toContainText(
    "Empty edges do not prove",
  );
});
test("initial failure retries and failed refresh preserves the loaded window", async ({ page }) => {
  let fail = true;
  const data = networkFixture();
  await page.route("**/api/network?*", (r) =>
    fail
      ? r.fulfill({
          status: 503,
          json: { error: { code: "SERVICE_UNAVAILABLE", message: "Server unavailable" } },
        })
      : r.fulfill({ json: data }),
  );
  await page.goto("/network");
  await expect(page.getByRole("alert")).toContainText("Network could not be loaded");
  fail = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByTestId("network-range")).toContainText(
    data.range.from.replace("T", " ").replace(".000Z", " UTC"),
  );
  fail = true;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("last known snapshot");
  await expect(page.getByTestId("network-range")).toContainText(
    data.range.from.replace("T", " ").replace(".000Z", " UTC"),
  );
  await expect(page.locator("main")).not.toContainText("Activity notifications connected.");
});
test("switching windows cancels obsolete responses", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let first = true;
  await page.route("**/api/network?*", async (r) => {
    const window = new URL(r.request().url()).searchParams.get("window");
    if (window === "24h" && first) {
      first = false;
      await pending;
      try {
        await r.fulfill({ json: networkFixture("24h") });
      } catch {
        /* Cancelled request. */
      }
    } else await r.fulfill({ json: networkFixture(window === "1h" ? "1h" : "7d") });
  });
  await page.goto("/network");
  await page.getByLabel("Recent history window").selectOption("1h");
  await expect(page.getByTestId("network-range")).toContainText("2026-10-09 11:00:00 UTC");
  release();
  await expect(page.getByTestId("network-range")).toContainText("2026-10-09 11:00:00 UTC");
});
test("keyboard selection and mobile list show the same evidence without overflow", async ({
  page,
}) => {
  await controlled(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/network");
  const node = page.getByRole("button", { name: "Inspect WORKER" }).filter({ visible: true });
  await node.focus();
  await page.keyboard.press("Enter");
  await expect(node).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Selected agent details" })).toContainText(
    "WORKER",
  );
  await expect(page.getByRole("list", { name: "Relationship evidence list" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("degraded source and all display limits are disclosed", async ({ page }) => {
  const data = networkFixture();
  data.coverage.status.degraded = true;
  data.coverage.status.consecutiveFailures = 1;
  data.coverage.warnings = ["RECORDING_ERRORS", "RETENTION_LIMIT", "JOURNAL_CAP"];
  data.coverage.truncated = {
    nodes: true,
    edges: true,
    tasks: true,
    goals: true,
    timeline: true,
    references: true,
  };
  await page.route("**/api/network?*", (r) => r.fulfill({ json: data }));
  await page.goto("/network");
  const coverage = page.getByRole("region", { name: "Coverage and recording health" });
  await expect(coverage).toContainText("recording reported errors");
  for (const key of Object.keys(data.coverage.truncated))
    await expect(coverage).toContainText(`limit reached for ${key}`);
  await expect(coverage).toContainText("32 MiB Activity journal cap");
  await expect(page.getByRole("link", { name: "See all registered agents" })).toBeVisible();
});
test("Activity invalidation coalesces requests; hidden pages pause fallback and resume", async ({
  page,
}) => {
  let calls = 0,
    release!: () => void;
  let hold = false;
  let pending = Promise.resolve();
  const data = networkFixture();
  await page.route("**/api/network?*", async (r) => {
    calls++;
    if (hold) await pending;
    try {
      await r.fulfill({ json: data });
    } catch {
      /* hidden/unmounted request aborted */
    }
  });
  await page.goto("/network");
  await expect(page.getByTestId("network-range")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  // Install an isolated Activity socket; bursts invalidate one pending snapshot.
  await page.routeWebSocket("**/ws/activity", (socket) => {
    socket.onMessage(() => {});
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("main")).toContainText("Refresh paused while page is hidden");
  const hiddenCalls = calls;
  await page.clock.install();
  await page.clock.fastForward(30000);
  expect(calls).toBe(hiddenCalls);
  hold = true;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect.poll(() => calls).toBeGreaterThan(hiddenCalls);
  const fetchingCalls = calls;
  await page.clock.fastForward(30000);
  expect(calls).toBe(fetchingCalls);
  hold = false;
  release();
  await page.clock.fastForward(200);
  await expect(page.getByTestId("network-range")).toBeVisible();
  await page.goto("/settings");
  const after = calls;
  await page.clock.fastForward(30000);
  expect(calls).toBe(after);
});

test("bursts of real Activity notifications trigger bounded projection refetches", async ({
  page,
}) => {
  let notify: ((message: string) => void) | undefined;
  await page.routeWebSocket("**/ws/activity", (socket) => {
    notify = (message) => socket.send(message);
  });
  let calls = 0,
    hold = false,
    release!: () => void;
  let pending = Promise.resolve();
  await page.route("**/api/network?*", async (route) => {
    calls++;
    if (hold) await pending;
    await route.fulfill({ json: networkFixture() });
  });
  await page.goto("/network");
  await expect(page.locator("main")).toContainText("Activity notifications connected.");
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  await page.clock.install();
  await page.clock.fastForward(500);
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  const before = calls;
  hold = true;
  pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const send = () => {
    if (!notify) throw new Error("Missing Activity socket");
    for (let n = 1; n <= 20; n++)
      notify(JSON.stringify({ type: "activity.event", event: observation(n, "lead", "worker") }));
  };
  send();
  await page.clock.fastForward(500);
  await expect.poll(() => calls).toBe(before + 1);
  send();
  await page.clock.fastForward(500);
  expect(calls).toBe(before + 1);
  hold = false;
  release();
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled();
  expect(calls).toBeLessThanOrEqual(before + 2);
});
