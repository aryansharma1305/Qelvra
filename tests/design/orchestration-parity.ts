import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { createApp } from "../../apps/server/src/app.js";
import { loadConfig } from "../../apps/server/src/config/env.js";
import { ProviderRegistry, PROVIDER_DEFINITIONS } from "../../apps/server/src/providers/index.js";
import type { Agent, Orchestration, Task } from "@qelvra/shared";
export interface GoalFixture {
  planned: Orchestration;
  completed: Orchestration;
  tasks: Task[];
  agents: Agent[];
}
/** Real fake-provider snapshots from disposable services; reads are replayed only for visual checks. */
export async function seedGoalFixture(): Promise<GoalFixture> {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-goal-design-"));
  const app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
    {
      logger: false,
      providerRegistry: new ProviderRegistry({
        allowFake: true,
        definitions: PROVIDER_DEFINITIONS.filter((d) => d.id === "fake"),
      }),
    },
  );
  try {
    await app.ready();
    for (const [id, name, role] of [
      ["michael", "Michael", "Orchestrator"],
      ["nova", "Nova", "Frontend Engineer"],
      ["atlas", "Atlas", "Backend Engineer"],
    ] as const)
      await app.runtime.create({ id, name, role, providerId: "fake" });
    const goal = await app.orchestration.create({
      title: "Build frontend and backend",
      description: "Create a small frontend and API in separate agent workspaces.",
      orchestratorAgentId: "michael",
    });
    await app.orchestration.plan(goal.id);
    await expect
      .poll(() => app.orchestration.get(goal.id).status, { timeout: 15000 })
      .toBe("planned");
    const planned = app.orchestration.get(goal.id);
    await app.orchestration.run(goal.id);
    await expect
      .poll(() => app.orchestration.get(goal.id).status, { timeout: 15000 })
      .toBe("completed");
    return {
      planned,
      completed: app.orchestration.get(goal.id),
      tasks: app.tasks.list(),
      agents: app.agents.list(),
    };
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
}
export async function checkGoalParity(page: Page, fixture: GoalFixture, info: TestInfo) {
  let goal = fixture.planned;
  await page.route("**/api/orchestrations", (r) => r.fulfill({ json: { orchestrations: [goal] } }));
  await page.route("**/api/tasks", (r) =>
    r.fulfill({
      json: {
        tasks:
          goal.status === "planned"
            ? fixture.tasks.filter((task) => goal.controlTaskIds.includes(task.id))
            : fixture.tasks,
      },
    }),
  );
  await page.route("**/api/agents", (r) => r.fulfill({ json: { agents: fixture.agents } }));
  const original = page.viewportSize();
  for (const width of [original?.width ?? 1440, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    for (const phase of ["plan", "summary"] as const) {
      goal = phase === "plan" ? fixture.planned : fixture.completed;
      await page.goto(`/tasks?view=goals&goal=${goal.id}`);
      const details = page.getByRole("article", { name: "Goal details" }),
        breakdown = details.getByRole("region", { name: "Task breakdown" });
      await expect(breakdown.getByRole("listitem")).toHaveCount(2);
      const rows = await breakdown.locator("ol > li").first().boundingBox();
      expect(rows?.width).toBeGreaterThan(0);
      if (phase === "plan") {
        await expect(details.getByRole("button", { name: "Run Plan" })).toBeVisible();
        await expect(details).toContainText("Preferred role: Frontend Engineer");
      } else {
        await expect(details).toContainText("2 / 2 tasks completed");
        await expect(details.getByRole("region", { name: "Final goal summary" })).toContainText(
          "fake-result.txt",
        );
      }
      if (width === 390 && phase === "summary")
        await details.getByRole("region", { name: "Final goal summary" }).scrollIntoViewIfNeeded();
      const overflow = await details.evaluate((el) => el.scrollWidth > el.clientWidth);
      expect(overflow).toBe(false);
      if (width !== 390)
        await expect
          .poll(() =>
            page
              .locator(".duration-700")
              .evaluate(
                (bar) =>
                  bar.getBoundingClientRect().width /
                  (bar.parentElement?.getBoundingClientRect().width || 1),
              ),
          )
          .toBeCloseTo(1, 2);
      await page.screenshot({
        path: info.outputPath(`goals-${phase}-${width}.png`),
        fullPage: true,
      });
    }
  }
  if (original) await page.setViewportSize(original);
}
