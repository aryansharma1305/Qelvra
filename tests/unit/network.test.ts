import { describe, expect, it } from "vitest";
import { NetworkQuerySchema, NetworkResponseSchema } from "@qelvra/shared";
import { projectNetwork } from "../../apps/server/src/network/network-service";
import {
  agent,
  task,
  goal,
  observation,
  sources,
  networkFixture,
  NETWORK_NOW,
} from "../fixtures/network";
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing fixture record");
  return value;
}
const now = new Date(NETWORK_NOW);
describe("Network contracts and projection", () => {
  it.each(["", "2h", null, 24, ["1h", "7d"]])("rejects invalid windows %j", (window) =>
    expect(NetworkQuerySchema.safeParse({ window }).success).toBe(false),
  );
  it("defaults to 24h and rejects unknown filters", () => {
    expect(NetworkQuerySchema.parse({}).window).toBe("24h");
    expect(() => projectNetwork({ limit: 100 }, sources(), now)).toThrow(/Network filters/);
  });
  it.each([
    ["1h", 3600000],
    ["24h", 86400000],
    ["7d", 604800000],
  ])("resolves UTC boundaries for %s", (window, ms) => {
    const at = new Date(now.getTime() - Number(ms)).toISOString();
    const s = sources([
      observation(1, "lead", "worker", "message.delivered", at),
      observation(2, "lead", "worker", "message.delivered", NETWORK_NOW),
      observation(
        3,
        "lead",
        "worker",
        "message.delivered",
        new Date(Date.parse(at) - 1).toISOString(),
      ),
    ]);
    const p = projectNetwork({ window }, s, now);
    expect(p.range.from).toBe(at);
    expect(p.timeline.map((e) => e.id)).toEqual([required(s.history.events[0]).id]);
  });
  it("has zero, one and isolated real agents, with separate runtime facts", () => {
    const s = sources();
    s.agents = [];
    s.tasks = [];
    s.goals = [];
    expect(projectNetwork({}, s, now).nodes).toEqual([]);
    s.agents = [agent("solo")];
    const one = projectNetwork({}, s, now);
    expect(one.nodes).toHaveLength(1);
    expect(one.edges).toEqual([]);
    const p = networkFixture();
    expect(p.nodes.map((n) => n.id)).toEqual(["isolated", "lead", "worker"]);
    expect(p.nodes.find((n) => n.id === "worker")?.runtime).toMatchObject({
      present: true,
      attached: true,
    });
    expect(p.nodes[0]?.runtime.present).toBe(false);
  });
  it("keeps directed/bidirectional edges, deduplicates each lifecycle and records self-observations", () => {
    const s = sources([
      observation(1, "lead", "worker", "message.queued"),
      observation(2, "lead", "worker", "message.delivered", "2026-10-09T11:01:00.000Z", 1),
      observation(3, "lead", "worker", "message.delivered", "2026-10-09T11:02:00.000Z", 1),
      observation(4, "worker", "lead"),
      observation(5, "worker", "worker"),
      observation(6, "lead", "worker", "message.quarantined"),
      observation(7, "lead", "worker", "message.delivery_failed"),
    ]);
    s.history.events.push(required(s.history.events[0]));
    const p = projectNetwork({}, s, now),
      edges = p.edges.filter((e) => e.kind === "message");
    expect(edges).toHaveLength(2);
    expect(edges.find((e) => e.from === "lead")).toMatchObject({
      counts: { queued: 1, delivered: 1, quarantined: 1, deliveryFailed: 1 },
    });
    expect(p.timeline).toHaveLength(6);
    expect(p.nodes.find((n) => n.id === "worker")?.selfMessages.delivered).toBe(1);
    expect(p.timeline[0]?.id).toBe(s.history.events[2]?.id);
  });
  it("counts observations without message IDs independently", () => {
    const p = projectNetwork(
      {},
      sources([
        observation(1, "lead", "worker", "message.queued", undefined, -1),
        observation(2, "lead", "worker", "message.queued", undefined, -1),
      ]),
      now,
    );
    expect(p.timeline).toHaveLength(2);
    expect(p.edges.find((e) => e.kind === "message")).toMatchObject({ counts: { queued: 2 } });
  });
  it("omits missing/deleted/system/reused participants without ghost nodes", () => {
    const s = sources([
      observation(1, "deleted", "lead"),
      observation(2, "system", "lead"),
      observation(3, "lead", undefined),
      observation(4, "lead", "worker"),
    ]);
    s.agents = s.agents.map((a) =>
      a.id === "worker" ? { ...a, createdAt: "2026-10-09T11:15:00.000Z" } : a,
    );
    const p = projectNetwork({}, s, now);
    expect(p.timeline).toEqual([]);
    expect(p.edges).toEqual([]);
    expect(p.coverage.omittedEvidence).toEqual({
      unregistered: 2,
      missingRecipient: 1,
      reusedIdentity: 3,
    });
  });
  it("does not derive traffic edges from generic agent association", () => {
    const s = sources();
    s.history.events = [
      {
        id: "evt-00000000-0000-4000-8000-000000000001",
        timestamp: "2026-10-09T11:00:00.000Z",
        type: "task.assigned",
        actor: { type: "agent", id: "lead" },
        entity: { type: "task", id: required(s.tasks[0]).id },
        metadata: { assigneeId: "worker", taskTitle: "Work" },
      },
    ];
    const p = projectNetwork({}, s, now);
    expect(p.edges.every((e) => e.kind === "orchestration")).toBe(true);
  });
  it("retains old current assignments and only recent terminal tasks/goals", () => {
    const s = sources();
    s.tasks = [
      task(1, "worker", { updatedAt: "2026-10-01T00:00:00.000Z" }),
      task(2, "worker", { status: "completed" }),
      task(3, "worker", { status: "failed", updatedAt: "2026-10-01T00:00:00.000Z" }),
    ];
    s.goals = [
      goal(1, ["worker"], { updatedAt: "2026-10-01T00:00:00.000Z" }),
      goal(2, ["worker"], { status: "completed" }),
      goal(3, ["worker"], { status: "cancelled", updatedAt: "2026-10-01T00:00:00.000Z" }),
    ];
    const p = projectNetwork({}, s, now);
    expect(p.nodes.find((n) => n.id === "worker")).toMatchObject({ taskTotal: 2, goalTotal: 2 });
    expect(p.edges[0]).toMatchObject({ kind: "orchestration", goalTotal: 2, taskTotal: 2 });
  });
  it("shows drafts on orchestrator only and never creates a worker clique", () => {
    const s = sources();
    s.agents.push(agent("other"));
    s.goals = [goal(1, [], { status: "draft", startedAt: null }), goal(2, ["worker", "other"])];
    const p = projectNetwork({}, s, now);
    expect(p.nodes.find((n) => n.id === "lead")?.goalTotal).toBe(2);
    expect(p.edges).toHaveLength(2);
    expect(p.edges.every((e) => e.from === "lead")).toBe(true);
  });
  it("exposes safe metadata only and strict schemas reject secret fields", () => {
    const p = networkFixture();
    expect(JSON.stringify(p)).not.toMatch(/PRIVATE|description|pid|sessionId|body|finalSummary/);
    expect(NetworkResponseSchema.safeParse({ ...p, secret: "bad" }).success).toBe(false);
    expect(
      NetworkResponseSchema.safeParse({ ...p, nodes: [{ ...p.nodes[0], pid: 123 }] }).success,
    ).toBe(false);
    expect(
      NetworkResponseSchema.safeParse({
        ...p,
        edges: [
          {
            kind: "message",
            from: "ghost",
            to: "worker",
            lastObservedAt: NETWORK_NOW,
            counts: { queued: 0, delivered: 1, quarantined: 0, deliveryFailed: 0 },
          },
        ],
      }).success,
    ).toBe(false);
  });
  it("caps 100 nodes, 200 edges and 50 observations over 10,000 events, deterministically", () => {
    const s = sources();
    s.agents = Array.from({ length: 110 }, (_, i) => agent(`agent-${String(i).padStart(3, "0")}`));
    s.tasks = [];
    s.goals = [];
    s.runtimes = [];
    s.history.events = Array.from({ length: 10000 }, (_, i) =>
      observation(
        i + 1,
        required(s.agents[i % 110]).id,
        required(s.agents[(i + 1 + (Math.floor(i / 110) % 7)) % 110]).id,
      ),
    );
    s.history.retainedEvents = 10000;
    const p = projectNetwork({}, s, now);
    expect(p.nodes).toHaveLength(100);
    expect(p.edges).toHaveLength(200);
    expect(p.timeline).toHaveLength(50);
    expect(p.totals.eligibleObservations).toBe(10000);
    expect(p.coverage.truncated).toMatchObject({ nodes: true, edges: true, timeline: true });
    expect(
      p.edges.every(
        (e) => p.nodes.some((n) => n.id === e.from) && p.nodes.some((n) => n.id === e.to),
      ),
    ).toBe(true);
    expect(
      projectNetwork(
        {},
        {
          ...s,
          agents: [...s.agents].reverse(),
          history: { ...s.history, events: [...s.history.events].reverse() },
        },
        now,
      ),
    ).toEqual(p);
  });
  it("caps task/goal details and edge references while preserving full totals", () => {
    const s = sources();
    s.tasks = Array.from({ length: 25 }, (_, i) => task(i, "worker"));
    s.goals = Array.from({ length: 25 }, (_, i) => goal(i, ["worker"]));
    const p = projectNetwork({}, s, now),
      worker = required(p.nodes.find((n) => n.id === "worker"));
    expect(worker.tasks).toHaveLength(20);
    expect(worker.goals).toHaveLength(20);
    expect(worker).toMatchObject({ taskTotal: 25, goalTotal: 25 });
    expect(p.edges[0]).toMatchObject({
      kind: "orchestration",
      goalTotal: 25,
      taskTotal: 25,
      referenceTotal: 25,
    });
    expect(p.coverage.truncated).toMatchObject({ tasks: true, goals: true, references: true });
  });
  it("discloses retention, integrity, cap and even one recording failure", () => {
    const s = sources([observation(1, "lead", "worker")]);
    s.history.retentionTruncated = true;
    s.status = { degraded: true, consecutiveFailures: 1, integrityWarnings: 1, capped: true };
    expect(projectNetwork({}, s, now).coverage.warnings).toEqual([
      "RETENTION_LIMIT",
      "RANGE_BEFORE_RETAINED_HISTORY",
      "RECORDING_ERRORS",
      "INTEGRITY_WARNINGS",
      "JOURNAL_CAP",
    ]);
  });
  it("does not mutate sources", () => {
    const s = sources([observation(1, "lead", "worker")]);
    const before = structuredClone(s);
    projectNetwork({}, s, now);
    expect(s).toEqual(before);
  });
});
