import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityEventSchema, type ActivityInput } from "@qelvra/shared";
import { ActivityStore, ActivityPublisher, ActivityError } from "../../apps/server/src/activity";
import { silentLogger } from "../../apps/server/src/lib/logger";
let dir: string;
let store: ActivityStore;
let activity: ActivityPublisher;
const input: ActivityInput = {
  type: "agent.created",
  entity: { type: "agent", id: "nova" },
  metadata: { agentName: "Nova" },
};
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-activity-"));
  store = await ActivityStore.open(join(dir, "events.jsonl"));
  activity = new ActivityPublisher(store);
});
afterEach(async () => {
  await activity.close();
  await rm(dir, { recursive: true, force: true });
});
describe("serialized activity persistence", () => {
  it("degrades unreadable history without preventing domain startup", async () => {
    await activity.close();
    store = await ActivityStore.open(dir);
    activity = new ActivityPublisher(store);
    expect(activity.status().degraded).toBe(true);
    expect(await activity.publish(input)).toBeNull();
  });
  it("appends 100 concurrent mixed events with unique IDs, deterministic order and restart history", async () => {
    const delivered = vi.fn();
    activity.subscribe(delivered);
    const inputs: ActivityInput[] = Array.from({ length: 100 }, (_, n): ActivityInput =>
      n % 3 === 0
        ? input
        : n % 3 === 1
          ? { type: "router.started", entity: { type: "router", id: "router" }, metadata: {} }
          : {
              type: "task.created",
              entity: { type: "task", id: "task-00000000-0000-4000-8000-000000000001" },
              metadata: { taskTitle: `Task ${n}`, assigneeId: null },
            },
    );
    const results = await Promise.all(inputs.map((event) => activity.publish(event)));
    expect(results.every(Boolean)).toBe(true);
    expect(delivered).toHaveBeenCalledTimes(100);
    const lines = (await readFile(store.file, "utf8"))
      .trim()
      .split("\n")
      .map((line) => ActivityEventSchema.parse(JSON.parse(line)));
    expect(lines).toEqual(results);
    expect(new Set(lines.map((e) => e.id)).size).toBe(100);
    expect(lines.every((e, n) => n === 0 || e.timestamp > (lines[n - 1]?.timestamp ?? ""))).toBe(
      true,
    );
    expect(store.listEvents({ limit: 100 }).events).toEqual([...lines].reverse());
    await activity.close();
    store = await ActivityStore.open(store.file);
    activity = new ActivityPublisher(store);
    expect(store.listEvents({ limit: 100 }).events).toEqual([...lines].reverse());
  });
  it("paginates newest first and applies entity/type filters without leaking mutable records", async () => {
    for (let n = 0; n < 6; n++)
      await activity.publish({ ...input, type: n % 2 ? "agent.started" : "agent.created" });
    const first = store.listEvents({ limit: 2 });
    expect(first.nextCursor).not.toBeNull();
    const second = store.listEvents({ limit: 2, cursor: first.nextCursor ?? "" });
    expect(second.events.some((e) => first.events.some((a) => a.id === e.id))).toBe(false);
    expect(store.listEvents({ type: "agent.started", agentId: "nova" }).events).toHaveLength(3);
    expect(store.listEvents({ agentId: "atlas" }).events).toEqual([]);
    if (first.events[0]) first.events[0].timestamp = "invalid";
    expect(store.listEvents().events[0]?.timestamp).not.toBe("invalid");
  });
  it("skips corrupt lines, duplicates and incomplete tails without rewriting their bytes", async () => {
    const event = await activity.publish(input);
    await activity.close();
    const before =
      (await readFile(store.file, "utf8")) +
      JSON.stringify(event) +
      '\nPRIVATE_CORRUPTION\n{"unfinished":';
    await writeFile(store.file, before);
    const log = { ...silentLogger, warn: vi.fn() };
    store = await ActivityStore.open(store.file, log);
    activity = new ActivityPublisher(store);
    expect(activity.status().integrityWarnings).toBe(3);
    expect(activity.status().degraded).toBe(true);
    await activity.publish(input);
    expect((await readFile(store.file, "utf8")).startsWith(before + "\n")).toBe(true);
    expect(JSON.stringify(log.warn.mock.calls)).not.toContain("PRIVATE_CORRUPTION");
    const reopened = await ActivityStore.open(store.file);
    expect(reopened.listEvents().events).toHaveLength(2);
    await reopened.close();
  });
  it("caps disk growth, never notifies an unpersisted event, and reports repeated failures", async () => {
    await activity.close();
    store = await ActivityStore.open(store.file, silentLogger, 1);
    const log = { ...silentLogger, error: vi.fn() };
    activity = new ActivityPublisher(store, log);
    const listener = vi.fn();
    activity.subscribe(listener);
    for (let n = 0; n < 3; n++) expect(await activity.publish(input)).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    expect(activity.status()).toMatchObject({
      degraded: true,
      capped: true,
      consecutiveFailures: 3,
    });
    expect(log.error).toHaveBeenCalledTimes(3);
  });
  it("deduplicates only explicitly once-owned message facts, including after reload", async () => {
    const message: ActivityInput = {
      type: "message.delivered",
      entity: { type: "message", id: "msg-00000000-0000-4000-8000-000000000001" },
      metadata: { from: "nova", to: "atlas", messageType: "message" },
    };
    await Promise.all(Array.from({ length: 20 }, () => activity.publish(message, true)));
    expect(store.listEvents().events).toHaveLength(1);
    await activity.close();
    store = await ActivityStore.open(store.file);
    activity = new ActivityPublisher(store);
    expect(await activity.publish(message, true)).toBeNull();
    expect(store.listEvents().events).toHaveLength(1);
  });
  it("recovers after append failure; rejects malformed input without logging payloads", async () => {
    const log = { ...silentLogger, error: vi.fn() };
    activity = new ActivityPublisher(store, log);
    vi.spyOn(store, "append").mockRejectedValueOnce(new ActivityError("ACTIVITY_WRITE_FAILED"));
    expect(await activity.publish(input)).toBeNull();
    expect(await activity.publish(input)).not.toBeNull();
    expect(activity.status().consecutiveFailures).toBe(0);
    expect(
      await activity.publish({
        ...input,
        metadata: { ...input.metadata, body: "PRIVATE_SENTINEL" },
      } as ActivityInput),
    ).toBeNull();
    expect(JSON.stringify(log.error.mock.calls)).not.toContain("PRIVATE_SENTINEL");
  });
});
