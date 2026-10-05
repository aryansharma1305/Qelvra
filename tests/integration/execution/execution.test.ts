import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { PROVIDER_DEFINITIONS, ProviderRegistry } from "../../../apps/server/src/providers";
import { ExecutionError, ExecutionProcessManager } from "../../../apps/server/src/execution";
import { ProviderError } from "../../../apps/server/src/providers/provider-errors";

let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
const pids = new Set<number>();
const alive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
async function start(mode = "success", timeoutMs = 10000) {
  const definitions = PROVIDER_DEFINITIONS.map((d) =>
    d.id === "fake"
      ? {
          ...d,
          execution: {
            args: [resolve("tests/fixtures/execution-cli.mjs"), mode],
            input: "json" as const,
            output: "json" as const,
          },
        }
      : d,
  );
  app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
    {
      logger: false,
      providerRegistry: new ProviderRegistry({
        definitions,
        allowFake: true,
        env: {
          ...process.env,
          UNRELATED_SECRET: "PRIVATE_SECRET_MARKER",
          NODE_OPTIONS: "--invalid",
        },
      }),
      executionOptions: { timeoutMs, processes: new ExecutionProcessManager(1024 * 1024) },
    },
  );
  await app.ready();
  return app;
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-execution-test-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  for (const pid of pids) await expect.poll(() => alive(pid)).toBe(false);
  pids.clear();
  await rm(dir, { recursive: true, force: true });
});
async function task(agentId = "nova", providerId: "fake" | "shell" = "fake") {
  if (!app.agents.get(agentId))
    await app.runtime.create({ id: agentId, name: agentId, role: "Execution test", providerId });
  return app.tasks.create({
    title: "Build login form",
    description: "Bounded task content",
    assignee: agentId,
  });
}
async function processes(agentId = "nova") {
  const file = join(dir, "hive/agents", agentId, "workspace/fixture-process.json");
  await expect
    .poll(
      async () => {
        try {
          return JSON.parse(await readFile(file, "utf8"));
        } catch {
          return null;
        }
      },
      { timeout: 6000 },
    )
    .not.toBeNull();
  const info = JSON.parse(await readFile(file, "utf8")) as {
    pid: number;
    childPid: number;
    cwd: string;
    secretPresent: boolean;
    loaderPresent: boolean;
  };
  pids.add(info.pid);
  pids.add(info.childPid);
  return info;
}
async function terminal(taskId: string) {
  await expect
    .poll(() => app.execution.get(taskId).execution?.status, { timeout: 10000 })
    .toMatch(/succeeded|failed|cancelled|interrupted/);
  return app.execution.get(taskId);
}
describe(
  "real execution coordinator, provider process and mailbox router",
  { timeout: 10000 },
  () => {
    it("cleans a published request after a transient execution snapshot failure, without launching work", async () => {
      await start();
      const t = await task();
      const save = app.execution.store.save.bind(app.execution.store);
      let calls = 0;
      vi.spyOn(app.execution.store, "save").mockImplementation((record) =>
        ++calls === 2
          ? Promise.reject(new ExecutionError("EXECUTION_PERSISTENCE_FAILED"))
          : save(record),
      );
      await expect(app.execution.executeTask(t.id)).rejects.toMatchObject({
        code: "EXECUTION_PERSISTENCE_FAILED",
      });
      expect(app.tasks.require(t.id).status).toBe("assigned");
      expect(app.execution.get(t.id).execution?.status).toBe("failed");
      expect(app.execution.size).toBe(0);
      expect((await app.mailbox.listMessages("system", "outbox")).messages).toEqual([]);
      expect((await app.mailbox.listMessages("nova", "inbox")).messages).toEqual([]);
    });
    it.each(["PROVIDER_UNAVAILABLE", "PROVIDER_AUTH_REQUIRED"] as const)(
      "%s is rejected before changing assignment or persisting execution",
      async (code) => {
        await start();
        const t = await task();
        vi.spyOn(app.providers, "resolve").mockRejectedValueOnce(
          new ProviderError(code, "Controlled provider admission error"),
        );
        await expect(app.execution.executeTask(t.id)).rejects.toMatchObject({ code });
        expect(app.tasks.require(t.id).status).toBe("assigned");
        expect(app.execution.get(t.id).execution).toBeNull();
        expect(app.execution.size).toBe(0);
      },
    );
    it("processes a durable correlated result before interrupting restart work and ignores later duplicates", async () => {
      await start();
      const t = await task();
      await app.execution.executeTask(t.id);
      const response = await terminal(t.id);
      const execution = response.execution,
        result = response.result;
      if (!execution || !result) throw new Error("Missing successful result");
      await app.tasks.start(t.id);
      await app.close();
      await app.execution.store.save({
        ...execution,
        status: "running",
        result: null,
        resultMessageId: null,
        finishedAt: null,
      });
      await app.mailbox.writeOutboxMessage("nova", {
        to: "system",
        type: "result",
        body: JSON.stringify(result),
      });
      await start();
      expect(app.tasks.require(t.id).status).toBe("review");
      expect(app.execution.get(t.id).execution?.status).toBe("succeeded");
      const timestamp = app.tasks.require(t.id).updatedAt;
      await app.activity.flush();
      const before = (await readFile(join(dir, "events.jsonl"), "utf8")).match(
        /"execution.completed"/g,
      )?.length;
      await app.mailbox.writeOutboxMessage("nova", {
        to: "system",
        type: "result",
        body: JSON.stringify(result),
      });
      await app.router.rescan();
      await app.execution.scanResults();
      await app.activity.flush();
      expect(app.tasks.require(t.id).updatedAt).toBe(timestamp);
      expect(
        (await readFile(join(dir, "events.jsonl"), "utf8")).match(/"execution.completed"/g)?.length,
      ).toBe(before);
      expect((await app.mailbox.listMessages("system", "inbox")).messages).toEqual([]);
      expect(app.execution.size).toBe(0);
    }, 10000);
    it("explicitly executes in the workspace through task/result mailboxes and stops at Review", async () => {
      await start();
      const t = await task();
      expect(app.execution.get(t.id).execution).toBeNull();
      expect(app.tasks.require(t.id).status).toBe("assigned");
      const response = await app.inject({
        method: "POST",
        url: `/api/tasks/${t.id}/execute`,
        payload: {},
      });
      expect(response.statusCode).toBe(202);
      expect(app.tasks.require(t.id).status).toBe("working");
      const info = await processes();
      expect(info).toMatchObject({ secretPresent: false, loaderPresent: false });
      expect(info.cwd).toContain("hive/agents/nova/workspace");
      const result = await terminal(t.id);
      expect(result.execution?.status).toBe("succeeded");
      expect(result.result).toMatchObject({
        taskId: t.id,
        agentId: "nova",
        status: "completed",
        changedFiles: ["fixture.txt"],
      });
      expect(app.tasks.require(t.id).status).toBe("review");
      expect(await readFile(join(info.cwd, "fixture.txt"), "utf8")).toBe("HELLO_QELVRA");
      await app.activity.flush();
      const events = await readFile(join(dir, "events.jsonl"), "utf8");
      expect(events).toContain('"execution.completed"');
      expect(events).toContain('"message.delivered"');
      expect(events).toContain('"messageType":"task"');
      expect(events).toContain('"messageType":"result"');
      expect(events).not.toMatch(/PRIVATE_SECRET_MARKER|Bounded task content|HELLO_QELVRA/);
      expect(app.agents.get("system")).toBeUndefined();
      expect(app.pty.size).toBe(0);
      await app.tasks.complete(t.id);
      expect(app.tasks.require(t.id).status).toBe("completed");
    });
    it.each([
      ["invalid", "EXECUTION_INVALID_RESULT"],
      ["traversal", "EXECUTION_INVALID_RESULT"],
      ["failure", "EXECUTION_AGENT_FAILED"],
      ["large", "EXECUTION_OUTPUT_LIMIT"],
      ["auth", "PROVIDER_AUTH_REQUIRED"],
      ["exit", "EXECUTION_START_FAILED"],
    ])("%s keeps the task retryable with controlled errors", async (mode, code) => {
      await start(mode);
      const t = await task();
      await app.execution.executeTask(t.id);
      await processes();
      const data = await terminal(t.id);
      expect(data.execution?.errorCode).toBe(code);
      expect(app.tasks.require(t.id).status).toBe("assigned");
      expect(app.execution.size).toBe(0);
    });
    it("times out and stops both processes", async () => {
      await start("timeout", 3000);
      const t = await task();
      await app.execution.executeTask(t.id);
      await processes();
      expect((await terminal(t.id)).execution?.errorCode).toBe("EXECUTION_TIMED_OUT");
      expect(app.tasks.require(t.id).status).toBe("assigned");
    });
    it("cancels without failing the task and rejects inactive cancellation", async () => {
      await start("timeout");
      const t = await task();
      await app.execution.executeTask(t.id);
      await processes();
      expect((await app.execution.cancelTask(t.id)).execution?.status).toBe("cancelled");
      expect(app.tasks.require(t.id).status).toBe("assigned");
      await expect(app.execution.cancelTask(t.id)).rejects.toMatchObject({
        code: "EXECUTION_NOT_ACTIVE",
      });
    });
    it("allows three agents independently, rejects double Execute and same-agent work", async () => {
      await start("timeout");
      const tasks = await Promise.all(["nova", "atlas", "scout"].map((id) => task(id)));
      const first = tasks[0];
      if (!first) throw new Error("Missing test task");
      const double = await Promise.allSettled([
        app.execution.executeTask(first.id),
        app.execution.executeTask(first.id),
      ]);
      expect(double.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(double.find((r) => r.status === "rejected")).toMatchObject({
        reason: { code: "TASK_ALREADY_EXECUTING" },
      });
      await Promise.all(tasks.slice(1).map((t) => app.execution.executeTask(t.id)));
      await Promise.all(["nova", "atlas", "scout"].map(processes));
      const another = await task();
      await expect(app.execution.executeTask(another.id)).rejects.toMatchObject({
        code: "AGENT_BUSY",
      });
      expect(tasks.map((t) => app.tasks.require(t.id).status)).toEqual([
        "working",
        "working",
        "working",
      ]);
      await Promise.all(tasks.map((t) => app.execution.cancelTask(t.id)));
    });
    it("rejects inbox tasks, interactive-only providers, and browser process settings", async () => {
      await start();
      const inbox = await app.tasks.create({ title: "Unassigned" });
      await expect(app.execution.executeTask(inbox.id)).rejects.toMatchObject({
        code: "TASK_NOT_ASSIGNED",
      });
      const shell = await task("shell-agent", "shell");
      await expect(app.execution.executeTask(shell.id)).rejects.toMatchObject({
        code: "PROVIDER_NOT_AUTOMATION_CAPABLE",
      });
      const t = await task();
      const res = await app.inject({
        method: "POST",
        url: `/api/tasks/${t.id}/execute`,
        payload: { command: "evil", executable: "/evil", args: [], cwd: "/evil" },
      });
      expect(res.statusCode).toBe(400);
      expect(app.tasks.require(t.id).status).toBe("assigned");
    });
    it("blocks manual transitions during execution and preserves an existing interactive runtime", async () => {
      await start("timeout");
      const t = await task();
      await app.runtime.start("nova");
      const interactive = app.runtime.get("nova");
      await app.execution.executeTask(t.id);
      await processes();
      const res = await app.inject({ method: "POST", url: `/api/tasks/${t.id}/review` });
      expect(res.statusCode).toBe(409);
      await app.execution.cancelTask(t.id);
      expect(app.runtime.get("nova")?.pid).toBe(interactive?.pid);
      expect(app.agents.require("nova").status).toBe("running");
    });
    it("shutdown interrupts, persists and restores retryable work without relaunch", async () => {
      await start("timeout");
      const t = await task();
      await app.execution.executeTask(t.id);
      await processes();
      await app.close();
      await start("success");
      expect(app.tasks.require(t.id).status).toBe("assigned");
      expect(app.execution.get(t.id).execution?.status).toBe("interrupted");
      expect(app.execution.size).toBe(0);
      expect(app.runtime.size).toBe(0);
    });
    it("returns Review to Working without executing until another explicit request", async () => {
      await start();
      const t = await task();
      await app.execution.executeTask(t.id);
      await terminal(t.id);
      await app.tasks.start(t.id);
      const before = app.execution.get(t.id).execution?.id;
      expect(app.execution.size).toBe(0);
      await app.execution.executeTask(t.id);
      await terminal(t.id);
      expect(app.execution.get(t.id).execution?.id).not.toBe(before);
      expect(app.tasks.require(t.id).status).toBe("review");
    });
    it("deleting an executing agent stops work before returning its task to Inbox", async () => {
      await start("timeout");
      const t = await task();
      await app.execution.executeTask(t.id);
      await processes();
      await app.runtime.delete("nova");
      expect(app.tasks.require(t.id)).toMatchObject({ status: "inbox", assignee: null });
      expect(app.execution.size).toBe(0);
    });
  },
);
