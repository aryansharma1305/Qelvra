// Disposable release lifecycle/load/soak verification. Never opens the developer DATA_DIR.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
const soak = process.argv.includes("--soak");
const directory = await mkdtemp(join(tmpdir(), "qelvra-release-"));
const config = loadConfig({
  DATA_DIR: directory,
  WORKSPACE_ROOT: directory,
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
});
const started = Date.now();
let interrupted = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => {
    interrupted = true;
  });
const samples: unknown[] = [];
let app = await createApp(config, { logger: false });
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function wait(check: () => boolean | Promise<boolean>, label: string) {
  const deadline = Date.now() + 45000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(`Timed out: ${label}`);
    await pause(25);
  }
}
async function start() {
  await app.listen({ host: "127.0.0.1", port: 0 });
}
async function close() {
  await app.close();
  assert.equal(app.execution.size, 0);
  assert.equal(app.pty.size, 0);
  assert.equal(app.router.isRunning(), false);
  assert.equal(app.router.status().inFlight, 0);
}
try {
  await start();
  for (const [id, role] of [
    ["planner", "Orchestrator"],
    ["frontend", "Frontend Engineer"],
    ["backend", "Backend Engineer"],
    ["qa", "QA Engineer"],
    ["ops", "DevOps Engineer"],
  ] as const)
    await app.runtime.create({ id, name: id, role, providerId: "fake" });
  let cycles = 0;
  do {
    cycles++;
    const runtime = await app.runtime.start("qa");
    assert.equal(runtime.status, "running");
    await app.runtime.stop("qa");
    assert.equal(app.pty.size, 0);
    const message = await app.mailbox.writeOutboxMessage("ops", {
      to: "qa",
      type: "status",
      body: `Release cycle ${cycles}`,
    });
    await wait(
      () => app.router.status().inFlight === 0 && app.router.status().delivered > 0,
      "router idle",
    );
    await wait(
      async () =>
        (await app.mailbox.listMessages("qa", "inbox")).messages.some((m) => m.id === message.id),
      "message delivery",
    );
    await app.mailbox.acknowledgeMessage("qa", "inbox", message.id, message);
    const tasks = await Promise.all(
      ["frontend", "backend", "ops"].map((assignee) =>
        app.tasks.create({ title: `Release task ${cycles} ${assignee}`, assignee }),
      ),
    );
    for (const task of tasks) await app.execution.executeTask(task.id);
    await wait(() => tasks.every((t) => app.tasks.require(t.id).status === "review"), "fake tasks");
    for (const task of tasks) await app.tasks.complete(task.id);
    const goal = await app.orchestration.create({
      title: `Build frontend and backend ${cycles}`,
      description: "Tiny release verification in isolated workspaces.",
      orchestratorAgentId: "planner",
    });
    await app.orchestration.plan(goal.id);
    await wait(() => app.orchestration.get(goal.id).status === "planned", "goal plan");
    assert.equal(app.orchestration.get(goal.id).taskIds.length, 0);
    await app.orchestration.run(goal.id);
    await wait(() => app.orchestration.get(goal.id).status === "completed", "goal complete");
    assert.equal(app.orchestration.get(goal.id).finalSummary?.completedTasks.length, 2);
    await wait(() => app.execution.size === 0 && app.router.status().inFlight === 0, "cleanup");
    await app.activity.flush();
    const events = app.activity.store.listEvents({ limit: 100 }).events;
    assert.equal(new Set(events.map((e) => e.id)).size, events.length);
    assert.equal(
      events.filter((e) => e.type === "orchestration.completed" && e.entity?.id === goal.id).length,
      1,
    );
    assert.equal(app.activity.status().degraded, false);
    const transient = await app.runtime.create({
      id: `transient-${cycles}`,
      name: "Transient",
      role: "Disposable",
    });
    await app.runtime.delete(transient.id);
    const resources = process
      .getActiveResourcesInfo()
      .reduce<Record<string, number>>((out, key) => {
        out[key] = (out[key] ?? 0) + 1;
        return out;
      }, {});
    const sample = {
      cycle: cycles,
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      rssMiB: Math.round(process.memoryUsage().rss / 1048576),
      heapMiB: Math.round(process.memoryUsage().heapUsed / 1048576),
      resources,
      router: app.router.status(),
      execution: app.execution.size,
      ptys: app.pty.size,
    };
    samples.push(sample);
    console.log(JSON.stringify(sample));
    if (!soak || cycles % 5 === 0) {
      const taskCount = app.tasks.list().length;
      await close();
      app = await createApp(config, { logger: false });
      await start();
      assert.equal(app.agents.list().length, 5);
      assert.equal(app.tasks.list().length, taskCount);
      assert.equal(app.orchestration.get(goal.id).status, "completed");
    }
    if (soak && Date.now() - started < 1800000) await pause(20000);
  } while (!interrupted && (soak ? Date.now() - started < 1800000 : cycles < 5));
  await close();
  if (interrupted) throw new Error("Soak interrupted before completion");
  console.log(
    JSON.stringify({
      result: "PASS",
      soak,
      cycles,
      elapsedSeconds: Math.round((Date.now() - started) / 1000),
      samples: samples.length,
      finalResources: process.getActiveResourcesInfo(),
    }),
  );
} finally {
  await app.close();
  await rm(directory, { recursive: true, force: true });
}
