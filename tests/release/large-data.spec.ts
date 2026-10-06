import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "@playwright/test";

test("100 agents, 500 tasks, 1000+ events and 50 goals remain browsable", async ({
  page,
  request,
}, testInfo) => {
  const data = await mkdtemp(join(tmpdir(), "qelvra-release-load-"));
  const api = "http://127.0.0.1:3097/api";
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const begun = performance.now();
  const server = spawn(process.execPath, [resolve("apps/server/dist/index.js")], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATA_DIR: data,
      WORKSPACE_ROOT: data,
      PORT: "3097",
      WEB_ORIGIN: "http://127.0.0.1:5197",
      LOG_LEVEL: "silent",
    },
    stdio: "ignore",
  });
  const timings: Record<string, number> = {};
  try {
    await expect
      .poll(async () => {
        try {
          return (await request.get(api + "/health")).ok();
        } catch {
          return false;
        }
      })
      .toBe(true);
    timings.startupMs = Math.round(performance.now() - begun);
    let begin = performance.now();
    expect((await request.get(api + "/providers")).ok()).toBe(true);
    timings.providerDetectionMs = Math.round(performance.now() - begin);
    for (let i = 0; i < 100; i++) {
      expect(
        (
          await request.post(api + "/agents", {
            data: {
              name: `Load Agent ${i}`,
              role: i === 0 ? "Orchestrator" : "Engineer",
              providerId: "fake",
            },
          })
        ).status(),
      ).toBe(201);
    }
    for (let i = 0; i < 500; i++) {
      const created = await request.post(api + "/tasks", {
        data: { title: `Load task ${i}`, assignee: "load-agent-1" },
      });
      expect(created.status()).toBe(201);
      const { task } = await created.json();
      expect((await request.post(`${api}/tasks/${task.id}/start`)).ok()).toBe(true);
    }
    for (let i = 0; i < 50; i++) {
      expect(
        (
          await request.post(api + "/orchestrations", {
            data: { title: `Load goal ${i}`, orchestratorAgentId: "load-agent-0" },
          })
        ).status(),
      ).toBe(201);
    }
    for (const [path, count] of [
      ["agents", 100],
      ["tasks", 500],
      ["orchestrations", 50],
    ] as const) {
      begin = performance.now();
      const body = await (await request.get(api + "/" + path)).json();
      timings[`${path}ListMs`] = Math.round(performance.now() - begin);
      expect(body[path]).toHaveLength(count);
    }
    let cursor: string | null = null;
    const eventIds = new Set<string>();
    begin = performance.now();
    do {
      const body = await (
        await request.get(api + "/activity", {
          params: { limit: 100, ...(cursor ? { cursor } : {}) },
        })
      ).json();
      expect(body.status.degraded).toBe(false);
      for (const event of body.events) {
        expect(eventIds.has(event.id)).toBe(false);
        eventIds.add(event.id);
      }
      cursor = body.nextCursor;
    } while (cursor);
    expect(eventIds.size).toBeGreaterThanOrEqual(1000);
    timings.allEventsListMs = Math.round(performance.now() - begin);
    begin = performance.now();
    await page.goto("/agents");
    await expect(page.getByText("100 Registered", { exact: true })).toBeVisible();
    timings.initialAgentsPageMs = Math.round(performance.now() - begin);
    await page.locator("#agent-search-input").fill("Load Agent 99");
    await expect(page.locator('.agent-card[data-agent="load-agent-99"]')).toBeVisible();
    await expect(page.locator(".agent-card")).toHaveCount(1);
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Inspect Load task 499", exact: true }).click();
    await expect(page.getByRole("region", { name: "Task details" })).toContainText("Load task 499");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("region", { name: "Task details" })).toHaveCount(0);
    await page.goto("/tasks?view=goals");
    await page
      .getByRole("navigation", { name: "Goal list" })
      .getByRole("button", { name: /Load goal 49/ })
      .click();
    await expect(page.getByRole("article", { name: "Goal details" })).toContainText("Load goal 49");
    await page.goto("/activity");
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
    await testInfo.attach("local-performance-baseline.json", {
      body: JSON.stringify(
        { agents: 100, tasks: 500, goals: 50, events: eventIds.size, timings },
        null,
        2,
      ),
      contentType: "application/json",
    });
    console.log(JSON.stringify({ baseline: timings, events: eventIds.size }));
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = new Promise<void>((resolve) => server.once("exit", () => resolve()));
      server.kill("SIGINT");
      await exited;
    }
    await rm(data, { recursive: true, force: true });
  }
});
