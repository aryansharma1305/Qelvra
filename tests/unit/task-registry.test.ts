import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { TaskRegistry, TaskRegistryLoadError, TASK_TRANSITIONS } from "../../apps/server/src/tasks";
import { writeFileAtomic } from "../../apps/server/src/lib/atomic-write";
import type { TaskEvent } from "../../apps/server/src/tasks";
const dirs: string[] = [];
const clock = () => new Date("2026-10-04T10:00:00.000Z");
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
async function setup(persist?: typeof writeFileAtomic) {
  const dir = mkdtempSync(join(tmpdir(), "qelvra-tasks-"));
  dirs.push(dir);
  const registry = await AgentRegistry.open({ file: join(dir, "agents.json"), clock });
  for (const name of ["Nova", "Atlas"]) await registry.create({ name, role: "Test" });
  const file = join(dir, "tasks.json");
  const tasks = await TaskRegistry.open({ file, registry, clock, ...(persist ? { persist } : {}) });
  return { dir, file, registry, tasks };
}
describe("TaskRegistry", () => {
  it("creates server-owned immutable snapshots, orders deterministically and reloads", async () => {
    const { tasks, file, registry, dir } = await setup();
    expect(tasks.list()).toEqual([]);
    const a = await tasks.create({ title: "  Zed  " });
    const b = await tasks.create({ title: "Alpha", description: "Line\nTwo", assignee: "nova" });
    expect(a).toMatchObject({
      title: "Zed",
      status: "inbox",
      assignee: null,
      createdBy: "user",
      description: "",
    });
    expect(a.id).toMatch(/^task-[a-f0-9-]{36}$/);
    expect(a.createdAt).toBe(a.updatedAt);
    expect(b.createdAt > a.createdAt).toBe(true);
    expect(Object.isFrozen(a)).toBe(true);
    expect(tasks.get(a.id)).toEqual(a);
    expect(tasks.get("unknown")).toBeUndefined();
    const reload = await TaskRegistry.open({ file, registry, clock });
    expect(reload.list()).toEqual([a, b]);
    expect((await reload.create({ title: "After restart" })).createdAt > b.createdAt).toBe(true);
    expect(readdirSync(dir).sort()).toEqual(["agents.json", "tasks.json"]);
  });
  it("enforces the whole lifecycle, return from review, timestamps and ordered events", async () => {
    const { tasks, registry } = await setup();
    const events: TaskEvent[] = [];
    const subscription = tasks.subscribe((event) => events.push(event));
    let task = await tasks.create({ title: "Build login" });
    const createdAt = task.createdAt;
    for (const operation of [
      () => tasks.assign(task.id, "nova"),
      () => tasks.start(task.id),
      () => tasks.review(task.id),
      () => tasks.start(task.id),
      () => tasks.review(task.id),
      () => tasks.complete(task.id),
    ]) {
      const next = await operation();
      expect(next.updatedAt > task.updatedAt).toBe(true);
      task = next;
      expect(task.createdAt).toBe(createdAt);
    }
    expect(task.status).toBe("completed");
    expect(registry.get("nova")?.status).toBe("stopped");
    expect(events.map((e) => e.type)).toEqual([
      "task.created",
      "task.assigned",
      "task.started",
      "task.review_requested",
      "task.started",
      "task.review_requested",
      "task.completed",
    ]);
    subscription.dispose();
    await tasks.create({ title: "Not observed" });
    expect(events).toHaveLength(7);
  });
  it.each(["assigned", "working", "review"] as const)(
    "fails from %s and terminal tasks reject all actions without timestamp changes",
    async (status) => {
      const { tasks } = await setup();
      let task = await tasks.create({ title: "Failed", assignee: "nova" });
      if (status !== "assigned") task = await tasks.start(task.id);
      if (status === "review") task = await tasks.review(task.id);
      task = await tasks.fail(task.id);
      expect(task.status).toBe("failed");
      for (const action of ["start", "review", "complete", "fail"] as const)
        await expect(tasks[action](task.id)).rejects.toMatchObject({
          code: "TASK_INVALID_TRANSITION",
        });
      await expect(tasks.assign(task.id, "atlas")).rejects.toMatchObject({
        code: "TASK_ALREADY_ASSIGNED",
      });
      expect(tasks.get(task.id)).toEqual(task);
    },
  );
  it("rejects unknown task/agent, malformed data and illegal shortcuts", async () => {
    const { tasks } = await setup();
    const t = await tasks.create({ title: "Task" });
    await expect(tasks.assign(t.id, "ghost")).rejects.toMatchObject({
      code: "TASK_AGENT_NOT_FOUND",
    });
    await expect(tasks.start(t.id)).rejects.toMatchObject({ code: "TASK_INVALID_TRANSITION" });
    await expect(tasks.complete(t.id)).rejects.toMatchObject({ code: "TASK_INVALID_TRANSITION" });
    await expect(tasks.start("unknown")).rejects.toMatchObject({ code: "TASK_NOT_FOUND" });
    await expect(tasks.create({ title: "" })).rejects.toMatchObject({ code: "TASK_INVALID_TITLE" });
    await expect(tasks.create({ title: "x", description: "\0" })).rejects.toMatchObject({
      code: "TASK_INVALID_DESCRIPTION",
    });
    await expect(tasks.create({ title: "x", assignee: "ghost" })).rejects.toMatchObject({
      code: "TASK_AGENT_NOT_FOUND",
    });
    expect(tasks.get(t.id)).toEqual(t);
    expect(TASK_TRANSITIONS.completed).toEqual([]);
  });
  it("serializes competing assignments and starts, preserving every concurrent create", async () => {
    const { tasks, file, registry } = await setup();
    const t = await tasks.create({ title: "Competing" });
    const assigned = await Promise.allSettled([
      tasks.assign(t.id, "nova"),
      tasks.assign(t.id, "atlas"),
    ]);
    expect(assigned.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(tasks.get(t.id)?.assignee).toBe("nova");
    const started = await Promise.allSettled([tasks.start(t.id), tasks.start(t.id)]);
    expect(started.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await Promise.all(Array.from({ length: 20 }, (_, i) => tasks.create({ title: `Task ${i}` })));
    expect(tasks.list()).toHaveLength(21);
    expect((await TaskRegistry.open({ file, registry })).list()).toEqual(tasks.list());
  });
  it("never publishes uncommitted data and rolls back disk/memory/events on persistence failure", async () => {
    let fail = false;
    let release: (() => void) | undefined;
    let blocked = false;
    const { tasks, file } = await setup(async (file, data) => {
      if (fail) throw new Error("disk secret");
      if (blocked)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      await writeFileAtomic(file, data);
    });
    const events = vi.fn();
    tasks.subscribe(events);
    const t = await tasks.create({ title: "Durable", assignee: "nova" });
    const disk = readFileSync(file, "utf8");
    blocked = true;
    const start = tasks.start(t.id);
    await vi.waitFor(() => expect(release).toBeDefined());
    expect(tasks.get(t.id)).toEqual(t);
    expect(readFileSync(file, "utf8")).toBe(disk);
    if (!release) throw new Error("Missing persistence barrier");
    release();
    await start;
    blocked = false;
    fail = true;
    const committed = tasks.get(t.id);
    const persisted = readFileSync(file, "utf8");
    await expect(tasks.review(t.id)).rejects.toMatchObject({ code: "TASK_PERSISTENCE_FAILED" });
    await expect(tasks.create({ title: "Lost" })).rejects.toMatchObject({
      code: "TASK_PERSISTENCE_FAILED",
    });
    expect(tasks.get(t.id)).toEqual(committed);
    expect(readFileSync(file, "utf8")).toBe(persisted);
    expect(events).toHaveBeenCalledTimes(3);
    fail = false;
    expect((await tasks.review(t.id)).status).toBe("review");
  });
  it.each([
    "not json",
    JSON.stringify({ version: 2, tasks: [] }),
    JSON.stringify({ version: 1, tasks: [{ id: "../escape" }] }),
  ])("fails closed on corrupt snapshots", async (raw) => {
    const { file, registry } = await setup();
    writeFileSync(file, raw);
    await expect(TaskRegistry.open({ file, registry })).rejects.toBeInstanceOf(
      TaskRegistryLoadError,
    );
    expect(readFileSync(file, "utf8")).toBe(raw);
  });
  it("rejects duplicate persisted IDs and uses ID as a timestamp tie-breaker", async () => {
    const { tasks, file, registry } = await setup();
    const a = await tasks.create({ title: "a" });
    const b = await tasks.create({ title: "b" });
    writeFileSync(file, JSON.stringify({ version: 1, tasks: [a, a] }));
    await expect(TaskRegistry.open({ file, registry })).rejects.toBeInstanceOf(
      TaskRegistryLoadError,
    );
    const same = { ...b, createdAt: a.createdAt };
    writeFileSync(file, JSON.stringify({ version: 1, tasks: [same, a] }));
    expect((await TaskRegistry.open({ file, registry })).list().map((t) => t.id)).toEqual(
      [a.id, b.id].sort(),
    );
  });
  it("deletion resets all active tasks, preserves content and terminal history, and repairs bypassed deletion on load", async () => {
    const { tasks, file, registry } = await setup();
    const active = [];
    for (const state of ["assigned", "working", "review"]) {
      let t = await tasks.create({ title: state, description: "Keep me", assignee: "atlas" });
      if (state !== "assigned") t = await tasks.start(t.id);
      if (state === "review") t = await tasks.review(t.id);
      active.push(t);
    }
    let completed = await tasks.create({ title: "Done", assignee: "atlas" });
    completed = await tasks.start(completed.id);
    completed = await tasks.review(completed.id);
    completed = await tasks.complete(completed.id);
    const failed = await tasks.fail((await tasks.create({ title: "Fail", assignee: "atlas" })).id);
    await tasks.deleteAgent("atlas");
    for (const t of active) {
      expect(tasks.get(t.id)).toMatchObject({
        title: t.title,
        description: t.description,
        status: "inbox",
        assignee: null,
        createdAt: t.createdAt,
      });
      expect(tasks.require(t.id).updatedAt > t.updatedAt).toBe(true);
    }
    expect(tasks.get(completed.id)).toEqual(completed);
    expect(tasks.get(failed.id)).toEqual(failed);
    const orphan = await tasks.create({ title: "Orphan", assignee: "nova" });
    await registry.delete("nova");
    const reload = await TaskRegistry.open({ file, registry });
    expect(reload.get(orphan.id)).toMatchObject({ status: "inbox", assignee: null });
    expect((await TaskRegistry.open({ file, registry })).list()).toEqual(reload.list());
  });
  it("refuses agent deletion if task persistence fails; rolls back if agent persistence fails", async () => {
    let fail = false;
    const { tasks, file, registry } = await setup(async (file, data) => {
      if (fail) throw new Error("disk");
      await writeFileAtomic(file, data);
    });
    const t = await tasks.create({ title: "Keep", assignee: "atlas" });
    fail = true;
    await expect(tasks.deleteAgent("atlas")).rejects.toMatchObject({
      code: "TASK_PERSISTENCE_FAILED",
    });
    expect(registry.get("atlas")).toBeDefined();
    expect(tasks.get(t.id)).toEqual(t);
    fail = false;
    const disk = readFileSync(file, "utf8");
    vi.spyOn(registry, "delete").mockRejectedValueOnce(new Error("Agent disk"));
    await expect(tasks.deleteAgent("atlas")).rejects.toThrow("Agent disk");
    expect(tasks.get(t.id)).toEqual(t);
    expect(readFileSync(file, "utf8")).toBe(disk);
    expect(registry.get("atlas")).toBeDefined();
  });
  it("serializes deletion against assignment in either order", async () => {
    const { tasks, registry } = await setup();
    const a = await tasks.create({ title: "A" });
    await Promise.all([tasks.assign(a.id, "atlas"), tasks.deleteAgent("atlas")]);
    expect(tasks.get(a.id)).toMatchObject({ status: "inbox", assignee: null });
    const b = await tasks.create({ title: "B" });
    const outcomes = await Promise.allSettled([
      tasks.deleteAgent("nova"),
      tasks.assign(b.id, "nova"),
    ]);
    expect(outcomes[1]).toMatchObject({
      status: "rejected",
      reason: { code: "TASK_AGENT_NOT_FOUND" },
    });
    expect(registry.list()).toHaveLength(0);
    expect(tasks.get(b.id)?.status).toBe("inbox");
  });
  it("listener exceptions cannot undo committed tasks", async () => {
    const { tasks } = await setup();
    tasks.subscribe(() => {
      throw new Error("Consumer failed");
    });
    const t = await tasks.create({ title: "Still committed" });
    expect(tasks.get(t.id)).toEqual(t);
  });
});
