import { required } from "../../fixtures/automations";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, it, expect, vi } from "vitest";
import {
  AutomationResponseSchema,
  AutomationHistorySchema,
  AutomationListSchema,
} from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { ProviderRegistry, PROVIDER_DEFINITIONS } from "../../../apps/server/src/providers";
import { ProviderError } from "../../../apps/server/src/providers/provider-errors";
let dir: string, app: Awaited<ReturnType<typeof createApp>> | undefined;
const config = () =>
  loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" });
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
  app = await createApp(config(), {
    logger: false,
    providerRegistry: new ProviderRegistry({ definitions, allowFake: true }),
    executionOptions: { timeoutMs },
  });
  await app.ready();
  return app;
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-automations-api-"));
});
afterEach(async () => {
  vi.restoreAllMocks();
  await app?.close();
  app = undefined;
  await rm(dir, { recursive: true, force: true });
});
const input = () => ({
  title: "PRIVATE_AUTOMATION_TITLE",
  taskTitle: "PRIVATE_TASK_TITLE",
  description: "PRIVATE_INSTRUCTIONS",
  agentId: "nova",
  schedule: { kind: "once", at: new Date(Date.now() + 3600000).toISOString() },
});
async function create(providerId: "fake" | "shell" = "fake") {
  const server = required(app);
  if (!server.agents.get("nova"))
    await server.runtime.create({ id: "nova", name: "Nova", role: "Disposable", providerId });
  const res = await server.inject({ method: "POST", url: "/api/automations", payload: input() });
  expect(res.statusCode).toBe(201);
  return AutomationResponseSchema.parse(res.json()).automation;
}
async function run(id: string, revision: number) {
  const res = await required(app).inject({
    method: "POST",
    url: `/api/automations/${id}/run`,
    payload: { revision },
  });
  expect(res.statusCode).toBe(200);
  return res.json().run as { id: string; taskId: string };
}
async function finished(id: string) {
  await expect
    .poll(() => required(app).automations.history(id).runs[0]?.status, { timeout: 12000 })
    .toMatch(/review|failed|interrupted/);
  return required(required(app).automations.history(id).runs[0]);
}
it("complete persisted API CRUD, enable/disable and bounded run reads", async () => {
  const server = await start(),
    a = await create();
  expect(a.enabled).toBe(false);
  let res = await server.inject(`/api/automations/${a.id}`);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(AutomationResponseSchema.parse(res.json()).automation.id).toBe(a.id);
  res = await server.inject({
    method: "POST",
    url: `/api/automations/${a.id}/enable`,
    payload: { revision: 0 },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().automation.nextRunAt).toBe(a.schedule.kind === "once" ? a.schedule.at : null);
  expect(
    (
      await server.inject({
        method: "PUT",
        url: `/api/automations/${a.id}`,
        payload: { ...input(), revision: 1 },
      })
    ).statusCode,
  ).toBe(409);
  await server.inject({
    method: "POST",
    url: `/api/automations/${a.id}/disable`,
    payload: { revision: 1 },
  });
  res = await server.inject({
    method: "PUT",
    url: `/api/automations/${a.id}`,
    payload: { ...input(), title: "Updated", revision: 2 },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().automation.title).toBe("Updated");
  expect(
    AutomationListSchema.parse((await server.inject("/api/automations")).json()).automations,
  ).toHaveLength(1);
  expect(
    AutomationHistorySchema.parse(
      (await server.inject(`/api/automations/${a.id}/runs?limit=1`)).json(),
    ).runs,
  ).toEqual([]);
  await server.close();
  await start();
  expect(required(app).automations.get(a.id).automation).toMatchObject({
    title: "Updated",
    enabled: false,
    revision: 3,
  });
  expect(
    (
      await required(app).inject({
        method: "DELETE",
        url: `/api/automations/${a.id}`,
        payload: { revision: 3 },
      })
    ).statusCode,
  ).toBe(204);
  expect((await required(app).inject(`/api/automations/${a.id}`)).statusCode).toBe(404);
});
it("Fake provider generates fresh tasks and workspace results, never completes automatically, and keeps Activity private", async () => {
  await start();
  const a = await create();
  const [one, two] = await Promise.all([run(a.id, 0), run(a.id, 0)]);
  expect(one.id).toBe(two.id);
  expect((await finished(a.id)).status).toBe("review");
  expect(required(app).tasks.require(one.taskId)).toMatchObject({
    status: "review",
    createdBy: "automation",
    title: "PRIVATE_TASK_TITLE",
  });
  expect(await readFile(join(dir, "hive/agents/nova/workspace/fixture.txt"), "utf8")).toBe(
    "HELLO_QELVRA",
  );
  await required(app).tasks.complete(one.taskId);
  await required(app).activity.flush();
  const activity = await required(app).inject("/api/activity?entityType=automation");
  expect(activity.statusCode).toBe(200);
  expect(activity.json().events.length).toBeGreaterThan(0);
  expect(JSON.stringify(activity.json())).not.toMatch(/PRIVATE_|HELLO_QELVRA/);
  expect(await readFile(join(dir, "events.jsonl"), "utf8")).not.toMatch(/PRIVATE_|HELLO_QELVRA/);
  await required(app).close();
  await start();
  expect(required(app).automations.history(a.id).runs[0]?.status).toBe("review");
  expect(required(app).tasks.require(one.taskId).status).toBe("completed");
  const next = await run(a.id, required(app).automations.get(a.id).automation.revision);
  expect(next.taskId).not.toBe(one.taskId);
  await finished(a.id);
});
it.each(["shell", "unavailable", "auth"])(
  "preserves %s provider admission checks",
  async (mode) => {
    await start();
    const a = await create(mode === "shell" ? "shell" : "fake");
    if (mode !== "shell")
      vi.spyOn(required(app).providers, "resolve").mockRejectedValue(
        new ProviderError(
          mode === "auth" ? "PROVIDER_AUTH_REQUIRED" : "PROVIDER_UNAVAILABLE",
          "PRIVATE_ERROR",
        ),
      );
    const admitted = await run(a.id, 0),
      record = await finished(a.id);
    expect(record.status).toBe("failed");
    expect(record.errorCode).toBe(
      mode === "shell"
        ? "PROVIDER_NOT_AUTOMATION_CAPABLE"
        : mode === "auth"
          ? "PROVIDER_AUTH_REQUIRED"
          : "PROVIDER_UNAVAILABLE",
    );
    expect(required(app).tasks.require(admitted.taskId).status).toBe("assigned");
  },
);
it.each(["failure", "timeout"])(
  "records real provider %s and retryable task state",
  async (mode) => {
    await start(mode, 3000);
    const a = await create(),
      admitted = await run(a.id, 0),
      record = await finished(a.id);
    expect(record.status).toBe("failed");
    expect(record.errorCode).toBe(
      mode === "timeout" ? "EXECUTION_TIMED_OUT" : "EXECUTION_AGENT_FAILED",
    );
    expect(required(app).tasks.require(admitted.taskId).status).toBe("assigned");
  },
  15000,
);
it("graceful shutdown interrupts active work and requires explicit recovery without launch", async () => {
  await start("timeout");
  const a = await create(),
    admitted = await run(a.id, 0);
  await expect
    .poll(() => required(app).execution.get(admitted.taskId).execution?.status)
    .toMatch(/running|queued/);
  await required(app).close();
  await start();
  const recovered = required(app).automations.get(a.id).automation;
  expect(recovered).toMatchObject({ enabled: false, needsAttention: true });
  expect(required(app).automations.history(a.id).runs[0]?.status).toBe("interrupted");
  expect(required(app).execution.size).toBe(0);
  expect(
    (
      await required(app).inject({
        method: "POST",
        url: `/api/automations/${a.id}/run`,
        payload: { revision: recovered.revision },
      })
    ).statusCode,
  ).toBe(409);
  const res = await required(app).inject({
    method: "POST",
    url: `/api/automations/${a.id}/run`,
    payload: { revision: recovered.revision, acknowledgeInterruption: true },
  });
  expect(res.statusCode).toBe(200);
  expect(res.json().run.taskId).not.toBe(admitted.taskId);
  await finished(a.id);
});
it("rejects unknown fields, goals, cron, invalid IDs, timestamps, revisions and history limits", async () => {
  await start();
  const a = await create();
  for (const payload of [
    { ...input(), enabled: true },
    { ...input(), script: "echo hi" },
    { ...input(), schedule: { kind: "cron", expression: "* * * * *" } },
    { ...input(), schedule: { kind: "once", at: "2030-01-01T10:00:00+01:00" } },
    {
      ...input(),
      schedule: { kind: "interval", startsAt: "2030-01-01T10:00:00Z", everyMinutes: 4 },
    },
    { ...input(), goalId: "goal" },
  ])
    expect(
      (await required(app).inject({ method: "POST", url: "/api/automations", payload })).statusCode,
    ).toBe(400);
  for (const url of [
    "/api/automations/invalid",
    `/api/automations/${a.id}/runs?limit=51`,
    `/api/automations/${a.id}/runs?command=x`,
    `/api/automations?secret=x`,
  ])
    expect((await required(app).inject(url)).statusCode).toBe(400);
  expect(
    (
      await required(app).inject({
        method: "POST",
        url: `/api/automations/${a.id}/run`,
        payload: {},
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await required(app).inject({
        method: "POST",
        url: `/api/automations/${a.id}/run`,
        payload: { revision: 999 },
      })
    ).statusCode,
  ).toBe(409);
});
