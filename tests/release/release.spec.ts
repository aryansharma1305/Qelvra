import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, expect } from "@playwright/test";
const api = "http://127.0.0.1:3097/api";
test("fresh beta → agent → task → goal → backend disconnect/restart → persisted results", async ({
  page,
  request,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const screenshots = resolve(".impeccable/review");
  if (!process.env.CI) await mkdir(screenshots, { recursive: true });
  const data = await mkdtemp(join(tmpdir(), "qelvra-release-browser-"));
  let child: ChildProcess | undefined;
  async function start() {
    child = spawn(process.execPath, [resolve("apps/server/dist/index.js")], {
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATA_DIR: data,
        WORKSPACE_ROOT: data,
        WEB_ORIGIN: "http://127.0.0.1:5197",
        PORT: "3097",
        LOG_LEVEL: "warn",
      },
      stdio: "ignore",
    });
    await expect
      .poll(async () => {
        try {
          return (await request.get(api + "/health")).ok();
        } catch {
          return false;
        }
      })
      .toBe(true);
  }
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const current = child;
    const exited = new Promise<void>((r) => current.once("exit", () => r()));
    current.kill("SIGINT");
    await exited;
  }
  try {
    await start();
    for (const path of ["agents", "tasks", "orchestrations"]) {
      const body = await (await request.get(api + "/" + path)).json();
      expect(body[path]).toEqual([]);
    }
    expect(
      (await (await request.get(api + "/activity")).json()).events.map(
        (e: { type: string }) => e.type,
      ),
    ).toEqual(["router.started"]);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Create your first agent" })).toBeVisible();
    if (!process.env.CI)
      await page.screenshot({ path: join(screenshots, "first-run-1440.png"), fullPage: true });
    await page.getByRole("link", { name: "Create Agent", exact: true }).click();
    await page.locator("#input-agent-name").fill("Beta Frontend");
    await page.locator("#input-agent-role").fill("Frontend Engineer");
    await page.locator("#btn-next-step").click();
    await page.getByRole("radio", { name: /Fake agent/ }).click();
    await page.locator("#step-pill-5").click();
    await page.locator("#btn-create-agent").click();
    await expect(page).toHaveURL(/\/agents$/);
    await page.locator('.btn-inspect[data-agent="beta-frontend"]').click();
    await page.getByRole("button", { name: "Start", exact: true }).click();
    await expect(page.getByRole("button", { name: "Stop", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(page.getByRole("button", { name: "Start", exact: true })).toBeVisible();
    await page.goto("/tasks");
    await page.getByRole("button", { name: "Create Task", exact: true }).click();
    const form = page.getByRole("dialog");
    await form.getByLabel("Title", { exact: true }).fill("Beta tiny task");
    await form.getByLabel("Assignee (optional)").selectOption("beta-frontend");
    await form.getByRole("button", { name: "Create", exact: true }).click();
    await page.getByRole("button", { name: "Inspect Beta tiny task", exact: true }).click();
    const task = page.getByRole("region", { name: "Task details" });
    await task.getByRole("button", { name: "Execute", exact: true }).click();
    await expect(task.getByTestId("task-status")).toHaveText("Review", { timeout: 20000 });
    await expect(task).toContainText("fake-result.txt");
    await task.getByRole("button", { name: "Complete", exact: true }).click();
    await expect(task.getByTestId("task-status")).toHaveText("Completed");
    const taskUrl = page.url();
    for (const [name, role] of [
      ["Beta Planner", "Orchestrator"],
      ["Beta Backend", "Backend Engineer"],
    ])
      expect(
        (
          await request.post(api + "/agents", { data: { name, role, providerId: "fake" } })
        ).status(),
      ).toBe(201);
    await page.goto("/", { waitUntil: "networkidle" });
    await page.getByLabel("Goal draft").fill("Build frontend and backend");
    await page.getByRole("button", { name: "Create Goal", exact: true }).click();
    const goalForm = page.getByRole("form", { name: "New Goal" });
    await expect(goalForm.getByLabel("Goal description")).toHaveValue("Build frontend and backend");
    await goalForm
      .getByRole("combobox", { name: "Orchestrator", exact: true })
      .selectOption("beta-planner");
    await goalForm.getByRole("button", { name: "Create Goal" }).click();
    const goal = page.getByRole("article", { name: "Goal details" });
    await goal.getByRole("button", { name: "Generate Plan" }).click();
    await expect(goal.getByRole("button", { name: "Run Plan" })).toBeVisible({ timeout: 20000 });
    await goal.getByRole("button", { name: "Run Plan" }).click();
    await expect(goal.getByRole("region", { name: "Final goal summary" })).toBeVisible({
      timeout: 30000,
    });
    const goalUrl = page.url();
    await stop();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(
      page.getByRole("alert").filter({ hasText: "Displayed records are last known state" }),
    ).toBeVisible();
    await start();
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.reload();
    await expect(goal.getByRole("region", { name: "Final goal summary" })).toBeVisible();
    await expect(page).toHaveURL(goalUrl);
    await page.goto(taskUrl);
    await expect(task.getByTestId("task-status")).toHaveText("Completed");
    await page.setViewportSize({ width: 700, height: 900 });
    await page.goto("/agents", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Your AI Team" })).toBeVisible();
    await expect(page.locator("aside nav").getByRole("link", { name: "Tasks" })).toBeVisible();
    expect(errors).toEqual([]);
    if (!process.env.CI) {
      for (const width of [1280, 1440, 1920, 700, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/agents", { waitUntil: "networkidle" });
        await page.screenshot({ path: join(screenshots, `agents-${width}.png`), fullPage: true });
      }
      for (const [route, label] of [
        [goalUrl, "goals"],
        [taskUrl, "tasks"],
        ["/", "home"],
      ]) {
        for (const width of [1440, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(route ?? "/", { waitUntil: "networkidle" });
          await page.screenshot({
            path: join(screenshots, `${label}-${width}.png`),
            fullPage: true,
          });
        }
      }
    }
  } finally {
    await stop();
    await rm(data, { recursive: true, force: true });
  }
});
