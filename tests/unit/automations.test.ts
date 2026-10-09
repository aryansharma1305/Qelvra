import { required } from "../fixtures/automations";
import { mkdtemp, readFile, writeFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { AutomationInputSchema, ActivityInputSchema, type AutomationRun } from "@qelvra/shared";
import { automationFixture, template, AUTOMATION_NOW } from "../fixtures/automations";
import {
  AutomationService,
  futureOccurrence,
} from "../../apps/server/src/automations/automation-service";
import { AutomationStore } from "../../apps/server/src/automations/automation-store";
import { writeFileAtomic } from "../../apps/server/src/lib/atomic-write";
let dir: string;
let fixture: Awaited<ReturnType<typeof automationFixture>> | undefined;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-automations-"));
});
afterEach(async () => {
  await fixture?.service.stop();
  await fixture?.service.finishShutdown();
  fixture = undefined;
  vi.useRealTimers();
  await rm(dir, { recursive: true, force: true });
});
async function setup() {
  return (fixture = await automationFixture(dir));
}
async function running() {
  await expect.poll(() => fixture?.calls).toBeGreaterThan(0);
  await expect
    .poll(() =>
      fixture?.service.store
        .snapshot()
        .runs.some((r) => r.status === "running" || r.status === "failed"),
    )
    .toBe(true);
}
describe("bounded UTC automation scheduler", () => {
  it("validates explicit UTC, interval bounds, templates and unsupported controls", () => {
    for (const schedule of [
      { kind: "once", at: "2030-01-01T10:00:00+05:30" },
      { kind: "cron", expression: "* * * * *" },
      { kind: "interval", startsAt: "2030-01-01T00:00:00Z", everyMinutes: 4 },
      { kind: "interval", startsAt: "2030-01-01T00:00:00Z", everyMinutes: 43201 },
    ])
      expect(AutomationInputSchema.safeParse({ ...template(), schedule }).success).toBe(false);
    expect(AutomationInputSchema.safeParse({ ...template(), script: "echo hi" }).success).toBe(
      false,
    );
    expect(AutomationInputSchema.safeParse(template()).success).toBe(true);
  });
  it("calculates exact UTC anchored boundaries, leap days and strict future occurrences", () => {
    const schedule = template().schedule;
    expect(futureOccurrence(schedule, AUTOMATION_NOW)).toBe("2030-01-01T00:05:00.000Z");
    expect(futureOccurrence(schedule, AUTOMATION_NOW + 300000)).toBe("2030-01-01T00:10:00.000Z");
    expect(futureOccurrence(schedule, AUTOMATION_NOW + 600001)).toBe("2030-01-01T00:15:00.000Z");
    expect(
      futureOccurrence(
        { kind: "interval", startsAt: "2032-02-28T23:55:00Z", everyMinutes: 5 },
        Date.parse("2032-02-29T00:00:00Z"),
      ),
    ).toBe("2032-02-29T00:05:00.000Z");
    expect(
      futureOccurrence({ kind: "once", at: "2030-01-01T00:00:00Z" }, AUTOMATION_NOW),
    ).toBeNull();
  });
  it("persists disabled templates, validates future times/agents and does no work on reads", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    expect(a).toMatchObject({ enabled: false, nextRunAt: null, revision: 0, lastRun: null });
    const reopened = await AutomationService.open(f.options);
    expect(reopened.get(a.id)).toEqual(f.service.get(a.id));
    await reopened.stop();
    expect(f.service.list().automations).toHaveLength(1);
    expect(f.service.history(a.id).runs).toEqual([]);
    expect(f.calls).toBe(0);
    await expect(f.service.create({ ...template(), agentId: "missing" })).rejects.toMatchObject({
      code: "AUTOMATION_AGENT_NOT_FOUND",
    });
    await expect(f.service.create(template(AUTOMATION_NOW))).rejects.toMatchObject({
      code: "AUTOMATION_SCHEDULE_PAST",
    });
    expect((await stat(join(dir, "automations.json"))).mode & 0o777).toBe(0o600);
  });
  it("reserves before dispatch, deduplicates concurrent Run now and never reuses completed tasks", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const [one, two] = await Promise.all([
      f.service.runNow(a.id, a.revision),
      f.service.runNow(a.id, a.revision),
    ]);
    expect(one.run.id).toBe(two.run.id);
    expect(one.run.taskId).toBe(two.run.taskId);
    expect(one.run.status).toBe("reserved");
    const persisted = JSON.parse(await readFile(join(dir, "automations.json"), "utf8"));
    expect(persisted.runs[0].taskId).toBe(one.run.taskId);
    await running();
    if (!one.run.taskId) throw new Error("Missing task");
    await f.finish(one.run.taskId);
    expect(f.tasks.require(one.run.taskId).status).toBe("review");
    await f.tasks.complete(one.run.taskId);
    const next = await f.service.runNow(a.id, f.service.get(a.id).automation.revision);
    expect(next.run.taskId).not.toBe(one.run.taskId);
    expect(f.calls).toBeLessThanOrEqual(2);
    await expect(f.service.runNow(a.id, 0)).resolves.toMatchObject({ run: { id: one.run.id } });
  });
  it("runs one-time UTC slots exactly once; disabling stops future admissions", async () => {
    const f = await setup(),
      input = {
        ...template(),
        schedule: { kind: "once" as const, at: new Date(AUTOMATION_NOW + 1000).toISOString() },
      },
      a = (await f.service.create(input)).automation;
    await f.service.enabled(a.id, 0, true);
    f.setNow(AUTOMATION_NOW + 999);
    await f.service.tick();
    expect(f.calls).toBe(0);
    f.setNow(AUTOMATION_NOW + 1000);
    await f.service.tick();
    await running();
    await f.service.tick();
    expect(f.calls).toBe(1);
    expect(f.service.get(a.id).automation.enabled).toBe(false);
    await expect(
      f.service.enabled(a.id, f.service.get(a.id).automation.revision, true),
    ).rejects.toMatchObject({ code: "AUTOMATION_SCHEDULE_PAST" });
  });
  it("records one missed summary and advances past offline intervals, without catch-up", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    f.setNow(AUTOMATION_NOW + 1800000);
    await f.service.tick(true);
    expect(f.calls).toBe(0);
    expect(f.service.history(a.id).runs).toMatchObject([
      { status: "skipped", errorCode: "AUTOMATION_MISSED", missedOccurrences: 6, taskId: null },
    ]);
    expect(f.service.get(a.id).automation.nextRunAt).toBe("2030-01-01T00:35:00.000Z");
    await f.service.tick();
    expect(f.service.history(a.id).runs).toHaveLength(1);
    f.setNow(AUTOMATION_NOW - 1000);
    await f.service.tick();
    expect(f.calls).toBe(0);
  });
  it("allows the 60-second grace boundary and skips beyond it", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    f.setNow(AUTOMATION_NOW + 360000);
    await f.service.tick();
    await running();
    const b = (await f.service.create(template(AUTOMATION_NOW + 660000))).automation;
    await f.service.enabled(b.id, b.revision, true);
    f.setNow(AUTOMATION_NOW + 720001);
    await f.service.tick();
    expect(f.service.history(b.id).runs[0]?.errorCode).toBe("AUTOMATION_MISSED");
  });
  it("overlapping schedules reserve one global slot and record busy skips", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation,
      b = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    await f.service.enabled(b.id, 0, true);
    f.setNow(AUTOMATION_NOW + 300000);
    await Promise.all([f.service.tick(), f.service.tick()]);
    await running();
    expect(f.calls).toBe(1);
    expect(
      f.service.store
        .snapshot()
        .runs.map((r) => r.status)
        .sort(),
    ).toEqual(["running", "skipped"]);
    const skip = f.service.store.snapshot().runs.find((r) => r.status === "skipped");
    expect(skip?.errorCode).toBe("AUTOMATION_BUSY");
    await expect(
      f.service.runNow(b.id, f.service.get(b.id).automation.revision),
    ).rejects.toMatchObject({ code: "AUTOMATION_BUSY" });
  });
  it.each([
    "PROVIDER_NOT_AUTOMATION_CAPABLE",
    "PROVIDER_UNAVAILABLE",
    "PROVIDER_AUTH_REQUIRED",
    "AGENT_BUSY",
  ])("records %s without private provider errors, and disables retry bursts", async (code) => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    f.setError(code);
    await f.service.enabled(a.id, 0, true);
    await f.service.runNow(a.id, 1);
    await running();
    expect(f.service.history(a.id).runs[0]).toMatchObject({ status: "failed", errorCode: code });
    expect(f.service.get(a.id).automation.enabled).toBe(false);
    expect(JSON.stringify(f.events)).not.toMatch(/PRIVATE_/);
    f.events.forEach((e) => expect(ActivityInputSchema.safeParse(e).success).toBe(true));
  });
  it("records runtime timeout as failure and preserves review on success", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const run = (await f.service.runNow(a.id, 0)).run;
    await running();
    await f.finish(required(run.taskId), "failed");
    expect(f.service.history(a.id).runs[0]).toMatchObject({
      status: "failed",
      errorCode: "EXECUTION_TIMED_OUT",
    });
    expect(f.tasks.require(required(run.taskId)).status).toBe("assigned");
  });
  it("never launches an unsaved reservation, and preserves last durable snapshot", async () => {
    let fail = false;
    const f = (fixture = await automationFixture(dir, async (...args) => {
      if (fail) throw new Error("disk failed");
      await writeFileAtomic(...args);
    }));
    const a = (await f.service.create(template())).automation;
    fail = true;
    await expect(f.service.runNow(a.id, 0)).rejects.toMatchObject({
      code: "AUTOMATION_PERSISTENCE_FAILED",
    });
    expect(f.calls).toBe(0);
    expect(f.service.history(a.id).runs).toEqual([]);
    fail = false;
  });
  it("interrupts ambiguous reserved work on restart, requires acknowledgement and creates new identities", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const run: AutomationRun = {
      ordinal: 1,
      id: "run-" + randomUUID(),
      automationId: a.id,
      agentId: a.agentId,
      taskId: "task-" + randomUUID(),
      executionId: null,
      trigger: "manual",
      requestedRevision: 0,
      scheduledAt: null,
      startedAt: new Date(AUTOMATION_NOW).toISOString(),
      finishedAt: null,
      status: "reserved",
      errorCode: null,
      missedOccurrences: 0,
    };
    await f.service.store.save(
      [{ ...required(f.service.store.snapshot().automations[0]), runCount: 1, revision: 1 }],
      [run],
    );
    await f.service.tick(true);
    expect(f.calls).toBe(0);
    expect(f.service.get(a.id).automation.needsAttention).toBe(true);
    expect(f.service.history(a.id).runs[0]?.status).toBe("interrupted");
    const rev = f.service.get(a.id).automation.revision;
    await expect(f.service.runNow(a.id, rev)).rejects.toMatchObject({
      code: "AUTOMATION_INTERRUPTED",
    });
    await expect(f.service.enabled(a.id, rev, true)).rejects.toMatchObject({
      code: "AUTOMATION_INTERRUPTED",
    });
    const retry = await f.service.runNow(a.id, rev, true);
    expect(retry.run.taskId).not.toBe(run.taskId);
    await running();
  });
  it("restores an already durable successful execution without relaunching it", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const { run } = await f.service.runNow(a.id, 0);
    await running();
    const e = required(f.executions.get(required(run.taskId)));
    await f.tasks.review(required(run.taskId));
    f.executions.set(required(run.taskId), { ...e, status: "succeeded" });
    await f.service.tick(true);
    expect(f.service.history(a.id).runs[0]?.status).toBe("review");
    expect(f.service.get(a.id).automation.needsAttention).toBe(false);
    expect(f.calls).toBe(1);
  });
  it("shutdown drains admissions, records interruption and rejects further work", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.start();
    const { run } = await f.service.runNow(a.id, 0);
    await running();
    await f.service.stop();
    await f.service.finishShutdown();
    expect(f.service.history(a.id).runs[0]?.status).toBe("interrupted");
    expect(f.service.list().scheduler.running).toBe(false);
    await expect(
      f.service.runNow(a.id, f.service.get(a.id).automation.revision, true),
    ).rejects.toMatchObject({ code: "AUTOMATION_UNAVAILABLE" });
    expect(run.taskId).not.toBeNull();
  });
  it("protects active templates and optimistic revisions; deletion keeps generated tasks", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    await expect(f.service.update(a.id, 1, template())).rejects.toMatchObject({
      code: "AUTOMATION_ACTIVE",
    });
    await expect(f.service.enabled(a.id, 0, false)).rejects.toMatchObject({
      code: "AUTOMATION_STALE",
    });
    await f.service.enabled(a.id, 1, false);
    const { run } = await f.service.runNow(a.id, 2);
    await running();
    await expect(
      f.service.delete(a.id, f.service.get(a.id).automation.revision),
    ).rejects.toMatchObject({ code: "AUTOMATION_ACTIVE" });
    await f.finish(required(run.taskId));
    await f.service.delete(a.id, f.service.get(a.id).automation.revision);
    expect(f.tasks.get(required(run.taskId))).toBeDefined();
    expect(f.service.list().automations).toEqual([]);
  });
  it("bounds retained history and fails closed on corrupt or unsupported snapshots", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const runs: AutomationRun[] = Array.from({ length: 510 }, (_, n) => ({
      ordinal: n + 1,
      id: "run-" + randomUUID(),
      automationId: a.id,
      agentId: a.agentId,
      taskId: null,
      executionId: null,
      trigger: "scheduled",
      requestedRevision: null,
      scheduledAt: new Date(AUTOMATION_NOW + n).toISOString(),
      startedAt: new Date(AUTOMATION_NOW + n).toISOString(),
      finishedAt: new Date(AUTOMATION_NOW + n).toISOString(),
      status: "skipped",
      errorCode: "AUTOMATION_MISSED",
      missedOccurrences: 1,
    }));
    await f.service.store.save(
      [{ ...required(f.service.store.snapshot().automations[0]), runCount: 510 }],
      runs,
    );
    expect(f.service.history(a.id, 3)).toMatchObject({
      recorded: 510,
      retained: 500,
      truncated: true,
    });
    expect(f.service.history(a.id, 3).runs).toHaveLength(3);
    expect(f.service.list().automations[0]?.lastRun?.ordinal).toBe(510);
    for (const text of ["{bad", JSON.stringify({ version: 2, automations: [], runs: [] })]) {
      await writeFile(join(dir, "bad.json"), text);
      await expect(AutomationStore.open(join(dir, "bad.json"))).rejects.toMatchObject({
        code: "AUTOMATION_PERSISTENCE_FAILED",
      });
      expect(await readFile(join(dir, "bad.json"), "utf8")).toBe(text);
    }
  });
  it("skips agents already executing manual tasks, without a new task", async () => {
    const f = await setup(),
      task = await f.tasks.create({ title: "Manual task", assignee: "nova" });
    await f.options.execution.executeTask(task.id);
    const a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    f.setNow(AUTOMATION_NOW + 300000);
    await f.service.tick();
    expect(f.service.history(a.id).runs[0]?.errorCode).toBe("AUTOMATION_BUSY");
    expect(f.tasks.list()).toHaveLength(1);
  });
  it("records a deleted assigned agent honestly and disables its schedule", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    await f.agents.delete("nova");
    f.setNow(AUTOMATION_NOW + 300000);
    await f.service.tick();
    expect(f.service.history(a.id).runs[0]?.errorCode).toBe("AUTOMATION_AGENT_NOT_FOUND");
    expect(f.service.get(a.id).automation.enabled).toBe(false);
    expect(f.calls).toBe(0);
  });
  it("an exactly-due startup slot is admitted once by the next normal tick", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    f.setNow(AUTOMATION_NOW + 300000);
    await f.service.start();
    expect(f.calls).toBe(0);
    await f.service.tick();
    await running();
    expect(f.calls).toBe(1);
    expect(f.service.get(a.id).automation.nextRunAt).toBe("2030-01-01T00:10:00.000Z");
  });
  it("disabling an active automation keeps its current execution but blocks the next slot", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    await f.service.enabled(a.id, 0, true);
    await f.service.runNow(a.id, 1);
    await running();
    await f.service.enabled(a.id, f.service.get(a.id).automation.revision, false);
    f.setNow(AUTOMATION_NOW + 300000);
    await f.service.tick();
    expect(f.calls).toBe(1);
    expect(f.service.history(a.id).runs[0]?.status).toBe("running");
  });
  it("a manual admission after a backward clock jump remains the latest run", async () => {
    const f = await setup(),
      a = (await f.service.create(template())).automation;
    const first = await f.service.runNow(a.id, 0);
    await running();
    await f.finish(required(first.run.taskId));
    f.setNow(AUTOMATION_NOW - 1000);
    const second = await f.service.runNow(a.id, f.service.get(a.id).automation.revision);
    expect(f.service.get(a.id).automation.lastRun?.id).toBe(second.run.id);
    expect(f.service.history(a.id).runs[0]?.id).toBe(second.run.id);
    await expect.poll(() => f.calls).toBe(2);
  });
});
