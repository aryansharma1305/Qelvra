import { mkdtemp, writeFile, readFile, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsResponseSchema, type ActivityInput } from "@qelvra/shared";
import { ActivityStore, ActivityPublisher, ActivityError } from "../../apps/server/src/activity";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { AnalyticsService } from "../../apps/server/src/analytics";
import {
  analyticsEvent,
  analyticsHistory,
  ANALYTICS_RANGE,
  ANALYTICS_TASK_ID,
  ANALYTICS_GOAL_ID,
} from "../fixtures/analytics-history";
let dir: string,
  store: ActivityStore,
  publisher: ActivityPublisher,
  agents: AgentRegistry,
  service: AnalyticsService;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-analytics-"));
  agents = await AgentRegistry.open({ file: join(dir, "agents.json") });
  for (const name of ["Nova", "Atlas"]) await agents.create({ name, role: "Engineer" });
  store = await ActivityStore.open(join(dir, "events.jsonl"));
  publisher = new ActivityPublisher(store);
  service = new AnalyticsService(publisher, agents, () => new Date("2026-10-05T12:00:00.000Z"));
});
afterEach(async () => {
  await publisher.close();
  await rm(dir, { recursive: true, force: true });
});
async function seed(events = analyticsHistory(), suffix = "") {
  await publisher.close();
  await writeFile(
    store.file,
    events.map((event) => JSON.stringify(event)).join("\n") + "\n" + suffix,
  );
  store = await ActivityStore.open(store.file);
  publisher = new ActivityPublisher(store);
  service = new AnalyticsService(publisher, agents);
}
describe("retained Activity analytics", () => {
  it("deduplicates one live event identity and treats equivalent ISO precision as the same UTC boundary", async () => {
    const event = analyticsEvent(
      {
        type: "agent.started",
        entity: { type: "agent", id: "nova" },
        metadata: { agentName: "Nova" },
      },
      "2026-10-01T00:00:00Z",
      99,
    );
    await store.append(event);
    await store.append(event);
    const result = await service.get({ from: "2026-10-01T00:00:00.000Z", to: "2026-10-02" });
    expect(result.summary.recordedEvents).toBe(1);
    expect(result.coverage.retainedEvents).toBe(1);
    expect(result.coverage.warnings).toEqual([]);
  });
  it("accepts exactly 90 elapsed UTC days and rejects a longer range", async () => {
    const result = await service.get({
      from: "2026-01-01T12:00:00.000Z",
      to: "2026-04-01T12:00:00.000Z",
    });
    expect(result.daily).toHaveLength(91);
    await expect(service.get({ from: "2026-01-01", to: "2026-04-02" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });
  it("reports real zeros and default seven-day UTC range, never fabricated metrics", async () => {
    const result = await service.get();
    expect(result.range).toEqual({
      from: "2026-09-28T12:00:00.000Z",
      to: "2026-10-05T12:00:00.000Z",
    });
    expect(result.daily).toHaveLength(8);
    expect(result.daily.every((day) => day.recordedEvents === 0)).toBe(true);
    expect(result.summary.recordedEvents).toBe(0);
    expect(result.coverage).toMatchObject({
      retainedEvents: 0,
      oldestRetainedAt: null,
      recordingHealthy: true,
      historyMayBeTruncated: false,
    });
    expect(result.unavailable).toEqual({
      tokenUsage: null,
      providerCost: null,
      machineUtilization: null,
    });
  });
  it("counts multiple types, repeated outcomes and zero days with stable ordering", async () => {
    await seed();
    const result = AnalyticsResponseSchema.parse(await service.get(ANALYTICS_RANGE));
    expect(result.summary).toEqual({
      recordedEvents: 7,
      involvedAgents: 3,
      taskOutcomeEvents: 2,
      goalOutcomeEvents: 1,
      messagesDelivered: 1,
      executionEvents: 0,
    });
    expect(result.daily.map((day) => day.recordedEvents)).toEqual([2, 4, 0, 1]);
    expect(result.byType[0]).toEqual({ type: "task.completed", count: 2 });
    expect(result.byType.slice(1).map((item) => item.type)).toEqual([
      "agent.created",
      "agent.deleted",
      "file.updated",
      "message.delivered",
      "orchestration.completed",
    ]);
    expect(result.taskOutcomes.completed).toBe(2);
    expect(result.agents.find((agent) => agent.agentId === "retired")).toMatchObject({
      registered: false,
      name: null,
      role: null,
      recordedInvolvement: 1,
    });
  });
  it("includes the start and excludes the end at exact UTC boundaries", async () => {
    await seed();
    const result = await service.get({ from: "2026-10-02T00:00:00Z", to: "2026-10-02T12:00:00Z" });
    expect(result.summary.recordedEvents).toBe(1);
    expect(result.daily).toEqual([{ date: "2026-10-02", recordedEvents: 1 }]);
    expect(result.coverage.warnings).not.toContain("RANGE_BEFORE_RETAINED_HISTORY");
  });
  it("uses Activity associations including both message participants without double-counting one agent", async () => {
    await seed();
    for (const id of ["nova", "atlas"]) {
      const result = await service.get({ ...ANALYTICS_RANGE, agentId: id });
      expect(result.summary.recordedEvents).toBe(
        store.listEvents({ agentId: id, limit: 100 }).events.length,
      );
      expect(result.summary.messagesDelivered).toBe(1);
    }
    const nova = await service.get({ ...ANALYTICS_RANGE, agentId: "nova" });
    expect(nova.summary.recordedEvents).toBe(5);
    expect(nova.agents.find((agent) => agent.agentId === "nova")?.recordedInvolvement).toBe(5);
    expect(nova.agents.find((agent) => agent.agentId === "atlas")?.recordedInvolvement).toBe(1);
    const event = analyticsEvent(
      {
        type: "memory.updated",
        actor: { type: "agent", id: "nova" },
        entity: { type: "agent", id: "nova" },
        metadata: { agentId: "nova", size: 1 },
      },
      "2026-10-03T00:00:00.000Z",
      40,
    );
    await store.append(event);
    expect(
      (await service.get(ANALYTICS_RANGE)).agents.find((agent) => agent.agentId === "nova")
        ?.recordedInvolvement,
    ).toBe(6);
  });
  it("preserves deduplicated restart history and safe coverage warnings without repairing corrupt bytes", async () => {
    const events = analyticsHistory();
    const firstEvent = events[0];
    if (!firstEvent) throw new Error("Missing Analytics seed event");
    await seed([...events, firstEvent], "PRIVATE_CORRUPTION\n{unfinished");
    const before = await readFile(store.file);
    const metadata = await stat(store.file);
    const first = await service.get({ from: "2026-09-30", to: "2026-10-05" });
    expect(first.summary.recordedEvents).toBe(7);
    expect(first.coverage).toMatchObject({
      recordingHealthy: false,
      historyMayBeTruncated: true,
      retainedEvents: 7,
    });
    expect(first.coverage.warnings).toEqual(
      expect.arrayContaining([
        "INTEGRITY_WARNINGS",
        "RANGE_BEFORE_RETAINED_HISTORY",
        "RECORDING_ERRORS",
      ]),
    );
    const snap = store.getSnapshot();
    if (snap.events[0]) snap.events[0].timestamp = "invalid";
    expect(store.getSnapshot().events[0]?.timestamp).not.toBe("invalid");
    await publisher.close();
    store = await ActivityStore.open(store.file);
    publisher = new ActivityPublisher(store);
    service = new AnalyticsService(publisher, agents);
    expect((await service.get({ from: "2026-09-30", to: "2026-10-05" })).summary).toEqual(
      first.summary,
    );
    expect(await readFile(store.file)).toEqual(before);
    expect((await stat(store.file)).mtimeMs).toBe(metadata.mtimeMs);
    expect(JSON.stringify(first)).not.toMatch(/PRIVATE|unfinished/);
  });
  it("reports recording failure and journal cap from actual health", async () => {
    vi.spyOn(store, "append").mockRejectedValue(new ActivityError("ACTIVITY_WRITE_FAILED"));
    const input: ActivityInput = {
      type: "router.started",
      entity: { type: "router", id: "router" },
      metadata: {},
    };
    await publisher.publish(input);
    expect((await service.get(ANALYTICS_RANGE)).coverage).toMatchObject({
      recordingHealthy: false,
      warnings: ["RECORDING_ERRORS"],
    });
    vi.restoreAllMocks();
    await publisher.close();
    store = await ActivityStore.open(store.file, undefined, 1);
    publisher = new ActivityPublisher(store);
    service = new AnalyticsService(publisher, agents);
    await publisher.publish(input);
    expect((await service.get(ANALYTICS_RANGE)).coverage.warnings).toContain("JOURNAL_CAP");
  });
  it("aggregates 10,000 retained events in a bounded linear pass and exposes truncation", async () => {
    await seed(
      Array.from({ length: 10_001 }, (_, index) =>
        analyticsEvent(
          {
            type: "agent.started",
            entity: { type: "agent", id: "nova" },
            metadata: { agentName: "Nova" },
          },
          "2026-10-02T12:00:00.000Z",
          index,
        ),
      ),
    );
    const start = performance.now();
    const result = await service.get(ANALYTICS_RANGE);
    const elapsed = performance.now() - start;
    console.info(
      JSON.stringify({
        retainedEvents: result.coverage.retainedEvents,
        analyticsMs: Math.round(elapsed * 100) / 100,
      }),
    );
    expect(result.summary.recordedEvents).toBe(10_000);
    expect(result.coverage.warnings).toContain("RETENTION_LIMIT");
    expect(result.coverage.historyMayBeTruncated).toBe(true);
    expect(elapsed).toBeLessThan(1500);
  });
  it("counts every supported task/goal outcome and future additive types without title or payload exposure", async () => {
    const types = ["task.failed", "task.review_requested", "task.returned_to_inbox"] as const;
    for (const [index, type] of types.entries())
      await store.append(
        analyticsEvent(
          {
            type,
            entity: { type: "task", id: ANALYTICS_TASK_ID },
            metadata: { taskTitle: "PRIVATE_MESSAGE_BODY", assigneeId: "nova" },
            actor: { type: "agent", id: "atlas", name: "PRIVATE_TERMINAL_OUTPUT" },
          },
          "2026-10-02T01:00:00.000Z",
          index,
        ),
      );
    for (const [index, type] of (
      ["orchestration.failed", "orchestration.cancelled", "orchestration.planned"] as const
    ).entries())
      await store.append(
        analyticsEvent(
          {
            type,
            entity: { type: "orchestration", id: ANALYTICS_GOAL_ID },
            metadata: { goalId: ANALYTICS_GOAL_ID, agentId: "nova" },
          },
          "2026-10-02T01:00:00.000Z",
          index + 10,
        ),
      );
    const result = await service.get(ANALYTICS_RANGE);
    expect(result.taskOutcomes).toEqual({
      completed: 0,
      failed: 1,
      reviewRequested: 1,
      returnedToInbox: 1,
    });
    expect(result.goalOutcomes).toEqual({ completed: 0, failed: 1, cancelled: 1 });
    expect(result.byType).toContainEqual({ type: "orchestration.planned", count: 1 });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it.each([
    { from: "invalid" },
    { from: "2026-02-30", to: "2026-03-02" },
    { from: "2026-10-05", to: "2026-10-01" },
    { from: "2026-01-01", to: "2026-10-05" },
    { from: "2026-10-01", to: "2026-10-01" },
    { agentId: "../nova" },
    { path: "/secret" },
  ])("rejects invalid/broad queries %j", async (query) => {
    await expect(service.get(query)).rejects.toMatchObject({
      statusCode: 400,
      code: "ANALYTICS_INVALID_QUERY",
    });
  });
  it("returns controlled not-found for an unregistered agent filter", async () => {
    await expect(service.get({ agentId: "retired" })).rejects.toMatchObject({
      statusCode: 404,
      code: "AGENT_NOT_FOUND",
    });
  });
});
