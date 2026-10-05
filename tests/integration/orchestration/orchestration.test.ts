import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../apps/server/src/app.js";
import { loadConfig } from "../../../apps/server/src/config/env.js";
import {
  ProviderRegistry,
  PROVIDER_DEFINITIONS,
} from "../../../apps/server/src/providers/index.js";
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture value");
  return value;
}
let directory: string;
let app: Awaited<ReturnType<typeof createApp>>;
async function openApp(limits: { maxConcurrent?: number; timeoutMs?: number } = {}) {
  app = await createApp(
    loadConfig({
      DATA_DIR: directory,
      WORKSPACE_ROOT: directory,
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    }),
    {
      logger: false,
      orchestrationOptions: limits,
      providerRegistry: new ProviderRegistry({
        allowFake: true,
        definitions: PROVIDER_DEFINITIONS.map((d) =>
          d.id === "fake"
            ? {
                ...d,
                execution: {
                  args: [
                    "--import",
                    import.meta.resolve("tsx"),
                    resolve("tests/fixtures/orchestration-cli.ts"),
                  ],
                  input: "json" as const,
                  output: "json" as const,
                },
              }
            : d,
        ),
      }),
    },
  );
  await app.ready();
}
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-orchestration-test-"));
  await openApp();
  for (const [id, role] of [
    ["michael", "Orchestrator"],
    ["nova", "Frontend Engineer"],
    ["atlas", "Backend Engineer"],
  ])
    await app.runtime.create({
      id: required(id),
      name: required(id),
      role: required(role),
      providerId: "fake",
    });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  await rm(directory, { recursive: true, force: true });
});
describe("orchestration through real tasks, execution and mailboxes", { timeout: 30000 }, () => {
  it.each(["invalidreview", "invalidsummary"])(
    "%s cannot perform a backend action or finalize an unrelated task",
    async (mode) => {
      const goal = await planned(mode);
      await app.orchestration.run(goal.id);
      const done = await finished(goal.id);
      expect(done).toMatchObject({
        status: "failed",
        errorCode: "ORCHESTRATION_REVIEW_FAILED",
        finalSummary: null,
      });
      if (mode === "invalidreview")
        expect(done.tasks.every((s) => app.tasks.require(s.taskId).status !== "completed")).toBe(
          true,
        );
    },
  );
  it("rejects a foreign agent result and never approves the spoofed orchestration work", async () => {
    const goal = await planned("cancel");
    await app.orchestration.run(goal.id);
    const id = required(app.orchestration.get(goal.id).taskIds[0]);
    await expect.poll(() => app.execution.get(id).execution?.status).toBe("running");
    const execution = required(app.execution.get(id).execution);
    await app.mailbox.writeOutboxMessage("atlas", {
      to: "system",
      type: "result",
      body: JSON.stringify({
        executionId: execution.id,
        requestMessageId: execution.requestMessageId,
        taskId: id,
        agentId: "nova",
        status: "completed",
        summary: "Spoofed success",
        changedFiles: [],
        notes: null,
      }),
    });
    await app.router.rescan();
    await app.execution.scanResults();
    expect(app.tasks.require(id).status).toBe("working");
    expect(app.orchestration.get(goal.id).finalSummary).toBeNull();
    await app.orchestration.cancel(goal.id);
  });
  it("waits for a suitable busy agent and then schedules on its released capacity", async () => {
    const external = await app.tasks.create({
      title: "[fixture:cancel] External work",
      assignee: "nova",
    });
    await app.execution.executeTask(external.id);
    const goal = await planned();
    await app.orchestration.run(goal.id);
    const slots = app.orchestration.get(goal.id).tasks;
    const frontend = required(slots.find((s) => s.agentId === "nova")),
      backend = required(slots.find((s) => s.agentId === "atlas"));
    await expect
      .poll(() => app.tasks.require(backend.taskId).status, { timeout: 15000 })
      .toBe("completed");
    expect(app.tasks.require(frontend.taskId).status).toBe("assigned");
    expect(app.execution.get(frontend.taskId).execution).toBeNull();
    await app.execution.cancelTask(external.id);
    expect((await finished(goal.id)).status).toBe("completed");
  });
  it("rejects missing suitable workers without partially materializing a plan", async () => {
    await app.runtime.delete("atlas");
    const goal = await planned();
    await expect(app.orchestration.run(goal.id)).rejects.toMatchObject({
      code: "ORCHESTRATION_NO_AGENT_AVAILABLE",
    });
    expect(app.orchestration.get(goal.id)).toMatchObject({ status: "planned", taskIds: [] });
  });
  it("keeps resumed planning under the goal deadline after restart", async () => {
    const goal = await app.orchestration.create({
      title: "[fixture:planninghang] Build frontend and backend",
      orchestratorAgentId: "michael",
    });
    const planning = await app.orchestration.plan(goal.id);
    const taskId = required(planning.decision?.taskId);
    await expect.poll(() => app.execution.get(taskId).execution?.status).toBe("running");
    await app.close();
    await openApp({ timeoutMs: 1000 });
    const resumed = await app.orchestration.resume(goal.id);
    expect(resumed.startedAt).not.toBeNull();
    expect((await finished(goal.id)).errorCode).toBe("ORCHESTRATION_TIMED_OUT");
    await expect.poll(() => app.tasks.require(taskId).status).toBe("assigned");
    expect(app.execution.size).toBe(0);
    expect(app.orchestration.get(goal.id).controlTaskIds).toEqual(planning.controlTaskIds);
  });
  it("restarts paused without duplicating tasks and resumes only explicitly", async () => {
    const goal = await planned("cancel");
    await app.orchestration.run(goal.id);
    const before = app.orchestration.get(goal.id),
      id = required(before.taskIds[0]);
    await expect.poll(() => app.execution.isActive(id)).toBe(true);
    await app.close();
    await openApp();
    expect(app.orchestration.get(goal.id).status).toBe("paused");
    expect(app.tasks.require(id).status).toBe("assigned");
    expect(app.execution.size).toBe(0);
    expect(app.orchestration.get(goal.id).taskIds).toEqual(before.taskIds);
    expect(
      app.tasks
        .list()
        .map((t) => t.id)
        .sort(),
    ).toEqual([...before.taskIds, ...before.controlTaskIds].sort());
    await app.orchestration.resume(goal.id);
    await expect.poll(() => app.orchestration.get(goal.id).tasks[0]?.attempts).toBe(2);
    await app.orchestration.cancel(goal.id);
    expect(app.execution.size).toBe(0);
  });
  it("uses durable reserved IDs to resume visible partial materialization after storage failure", async () => {
    const goal = await planned();
    const original = app.tasks.create.bind(app.tasks);
    let calls = 0;
    vi.spyOn(app.tasks, "create").mockImplementation((...args) =>
      ++calls === 2 ? Promise.reject(new Error("Storage failure")) : original(...args),
    );
    await expect(app.orchestration.run(goal.id)).rejects.toMatchObject({
      code: "ORCHESTRATION_PERSISTENCE_FAILED",
    });
    const partial = app.orchestration.get(goal.id);
    expect(partial).toMatchObject({ status: "failed", materialized: false });
    expect(partial.taskIds).toHaveLength(2);
    expect(partial.taskIds.filter((id) => app.tasks.get(id))).toHaveLength(1);
    expect(partial.taskIds.every((id) => !app.execution.store.latest(id))).toBe(true);
    vi.restoreAllMocks();
    await app.orchestration.resume(goal.id);
    expect((await finished(goal.id)).taskIds).toEqual(partial.taskIds);
  });
  it("enforces the configured service-wide capacity without overlapping same-agent tasks", async () => {
    await app.close();
    await openApp({ maxConcurrent: 1 });
    const goal = await planned("parallel");
    let peak = 0;
    const sub = app.execution.subscribe(() => {
      peak = Math.max(
        peak,
        app.execution.store
          .list()
          .filter((e) => ["starting", "queued", "running", "awaiting_result"].includes(e.status))
          .length,
      );
    });
    await app.orchestration.run(goal.id);
    expect((await finished(goal.id)).status).toBe("completed");
    expect(peak).toBe(1);
    sub.dispose();
  });
  it("times out the goal and cleans active execution without deleting completed work", async () => {
    const goal = await planned("cancel");
    await app.close();
    await openApp({ timeoutMs: 1000 });
    await app.orchestration.run(goal.id);
    const failed = await finished(goal.id);
    expect(failed).toMatchObject({ status: "failed", errorCode: "ORCHESTRATION_TIMED_OUT" });
    await expect.poll(() => app.execution.size).toBe(0);
    await expect.poll(() => app.tasks.require(required(failed.taskIds[0])).status).toBe("assigned");
  });
  it("protects managed tasks and rejects browser command/plan overrides", async () => {
    const goal = await planned("cancel");
    await app.orchestration.run(goal.id);
    const id = required(app.orchestration.get(goal.id).taskIds[0]);
    for (const action of ["execute", "cancel-execution", "review", "complete", "fail"]) {
      const response = await app.inject({
        method: "POST",
        url: `/api/tasks/${id}/${action}`,
        payload: {},
      });
      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("ORCHESTRATION_TASK_MANAGED");
    }
    const response = await app.inject({
      method: "POST",
      url: `/api/orchestrations/${goal.id}/run`,
      payload: { command: "rm -rf /", cwd: "/", env: {}, plan: {} },
    });
    expect(response.statusCode).toBe(400);
    await app.orchestration.cancel(goal.id);
  });
  async function planned(mode = "success") {
    const goal = await app.orchestration.create({
      title: `[fixture:${mode}] Build frontend and backend`,
      orchestratorAgentId: "michael",
    });
    await app.orchestration.plan(goal.id);
    await expect
      .poll(() => app.orchestration.get(goal.id).status, { timeout: 15000 })
      .toMatch(/planned|failed/);
    return app.orchestration.get(goal.id);
  }
  async function finished(id: string) {
    await expect
      .poll(() => app.orchestration.get(id).status, { timeout: 20000 })
      .toMatch(/completed|failed|cancelled/);
    return app.orchestration.get(id);
  }
  it("requires plan approval, completes two real tasks and combines actual workspace results", async () => {
    const goal = await app.orchestration.create({
      title: "Build frontend and backend",
      description: "Small landing page and API",
      orchestratorAgentId: "michael",
    });
    expect(app.tasks.list()).toEqual([]);
    await app.orchestration.plan(goal.id);
    await expect
      .poll(() => app.orchestration.get(goal.id).status, { timeout: 15000 })
      .toBe("planned");
    expect(app.orchestration.get(goal.id).taskIds).toEqual([]);
    await app.orchestration.run(goal.id);
    await expect
      .poll(() => app.orchestration.get(goal.id).status, { timeout: 20000 })
      .toBe("completed");
    const completed = app.orchestration.get(goal.id);
    expect(completed.taskIds).toHaveLength(2);
    expect(completed.tasks.map((t) => t.agentId)).toEqual(["nova", "atlas"]);
    expect(completed.taskIds.map((id) => app.tasks.require(id).status)).toEqual([
      "completed",
      "completed",
    ]);
    expect(completed.finalSummary?.completedTasks).toEqual(completed.taskIds);
    for (const agent of ["nova", "atlas"])
      expect(
        await readFile(join(directory, "hive/agents", agent, "workspace/fake-result.txt"), "utf8"),
      ).toMatch(/Build/);
    await expect.poll(() => app.execution.size).toBe(0);
    expect(app.pty.size).toBe(0);
    expect((await app.mailbox.listMessages("system", "inbox")).messages).toEqual([]);
  });
  it("runs independent workers concurrently and rejects duplicate Run without duplicate tasks", async () => {
    const goal = await planned("parallel");
    const calls = await Promise.allSettled([
      app.orchestration.run(goal.id),
      app.orchestration.run(goal.id),
    ]);
    expect(calls.filter((c) => c.status === "fulfilled")).toHaveLength(1);
    expect(calls.find((c) => c.status === "rejected")).toMatchObject({
      reason: { code: "ORCHESTRATION_ALREADY_STARTED" },
    });
    const ids = app.orchestration.get(goal.id).taskIds;
    await expect
      .poll(() => ids.every((id) => app.execution.isActive(id)), { timeout: 5000 })
      .toBe(true);
    expect((await finished(goal.id)).taskIds).toEqual(ids);
  });
  it("blocks a dependency until the predecessor is approved and completed", async () => {
    const started: { id: string; predecessor: string | null }[] = [];
    const sub = app.tasks.subscribe((e) => {
      if (e.type === "task.started")
        started.push({
          id: e.task.id,
          predecessor:
            app.tasks
              .list()
              .find((t) => t.title.includes("frontend") && !t.title.startsWith("plan:"))?.status ??
            null,
        });
    });
    const goal = await planned("dependency");
    await app.orchestration.run(goal.id);
    const done = await finished(goal.id);
    expect(done.status).toBe("completed");
    expect(started.find((e) => e.id === required(done.tasks[1]).taskId)?.predecessor).toBe(
      "completed",
    );
    sub.dispose();
  });
  it("reworks explicitly with reviewer instructions and succeeds on attempt two", async () => {
    const goal = await planned("rework");
    await app.orchestration.run(goal.id);
    const done = await finished(goal.id);
    expect(done.status).toBe("completed");
    expect(done.tasks[0]?.attempts).toBe(2);
    expect(done.tasks[0]?.reworkInstructions).toContain("requested detail");
  });
  it("stops after attempt three when reviews keep requesting rework", async () => {
    const goal = await planned("limit");
    await app.orchestration.run(goal.id);
    const done = await finished(goal.id);
    expect(done).toMatchObject({ status: "failed", errorCode: "ORCHESTRATION_ATTEMPT_LIMIT" });
    expect(done.tasks[0]?.attempts).toBe(3);
    expect(app.execution.store.list().filter((e) => e.taskId === done.taskIds[0])).toHaveLength(3);
    expect(app.execution.size).toBe(0);
  });
  it("retries a transient worker launch failure through the same execution service", async () => {
    const goal = await planned("failure");
    await app.orchestration.run(goal.id);
    const done = await finished(goal.id);
    expect(done.status).toBe("completed");
    expect(done.tasks[0]?.attempts).toBe(2);
  });
  it("rejects invalid plans before creating workers and leaves planning retryable", async () => {
    const goal = await planned("invalidplan");
    expect(goal).toMatchObject({
      status: "failed",
      errorCode: "ORCHESTRATION_INVALID_PLAN",
      taskIds: [],
    });
    await app.orchestration.plan(goal.id);
    expect(app.orchestration.get(goal.id).status).toBe("planning");
  });
  it("does not repeatedly retry malformed worker results", async () => {
    const goal = await planned("invalidworker");
    await app.orchestration.run(goal.id);
    const done = await finished(goal.id);
    expect(done).toMatchObject({ status: "failed", errorCode: "ORCHESTRATION_EXECUTION_FAILED" });
    expect(done.tasks[0]?.attempts).toBe(1);
  });
  it("cancels active work without deleting tasks or leaving processes", async () => {
    const goal = await planned("cancel");
    await app.orchestration.run(goal.id);
    await expect
      .poll(() => app.execution.isActive(required(app.orchestration.get(goal.id).taskIds[0])))
      .toBe(true);
    await app.orchestration.cancel(goal.id);
    expect(app.orchestration.get(goal.id).status).toBe("cancelled");
    expect(app.tasks.require(required(app.orchestration.get(goal.id).taskIds[0])).status).toBe(
      "assigned",
    );
    expect(app.execution.size).toBe(0);
  });
});
