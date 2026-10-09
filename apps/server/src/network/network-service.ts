import {
  NETWORK_LIMITS,
  NetworkQuerySchema,
  NetworkResponseSchema,
  type NetworkResponse,
  type NetworkNode,
  type NetworkEdge,
  type NetworkObservation,
  type MessageCounts,
  type ActivityEvent,
  type ActivityStatus,
  type Agent,
  type Task,
  type Orchestration,
} from "@qelvra/shared";
import type { AgentRuntimeInfo } from "../agents/agent-runtime-manager.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { AgentRuntimeManager } from "../agents/agent-runtime-manager.js";
import type { TaskRegistry } from "../tasks/task-registry.js";
import type { OrchestrationService } from "../orchestration/orchestration-service.js";
import { AppError } from "../lib/errors.js";

const counts = (): MessageCounts => ({
  queued: 0,
  delivered: 0,
  quarantined: 0,
  deliveryFailed: 0,
});
const lifecycle = {
  "message.queued": "queued",
  "message.delivered": "delivered",
  "message.quarantined": "quarantined",
  "message.delivery_failed": "deliveryFailed",
} as const;
const terminalGoals = new Set(["completed", "failed", "cancelled"]);
const terminalTasks = new Set(["completed", "failed"]);
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Missing Network projection identity");
  return value;
}
interface Sources {
  agents: Agent[];
  runtimes: AgentRuntimeInfo[];
  tasks: Task[];
  goals: Orchestration[];
  history: {
    events: ActivityEvent[];
    retainedEvents: number;
    oldestRetainedAt: string | null;
    newestRetainedAt: string | null;
    retentionTruncated: boolean;
  };
  status: ActivityStatus;
}

/** Pure, allowlisted projection. Relationship evidence is not current queue state. */
export function projectNetwork(raw: unknown, source: Sources, now = new Date()): NetworkResponse {
  const query = NetworkQuerySchema.safeParse(raw);
  if (!query.success)
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Choose window=1h, 24h or 7d; no other Network filters are supported",
    );
  const to = now.getTime(),
    from = to - { "1h": 3600000, "24h": 86400000, "7d": 604800000 }[query.data.window];
  const inRange = (at: string) => Date.parse(at) >= from && Date.parse(at) < to;
  const agents = new Map(source.agents.map((a) => [a.id, a]));
  const runtime = new Map(source.runtimes.map((r) => [r.agentId, r]));
  const nodeMap = new Map<string, NetworkNode>();
  for (const a of [...source.agents].sort((a, b) => compare(a.id, b.id))) {
    const r = runtime.get(a.id);
    nodeMap.set(a.id, {
      id: a.id,
      name: a.name,
      role: a.role,
      status: a.status,
      providerId: a.providerId,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      runtime: { present: !!r, startedAt: r?.startedAt ?? null, attached: r?.attached ?? false },
      tasks: [],
      taskTotal: 0,
      goals: [],
      goalTotal: 0,
      selfMessages: counts(),
    });
  }
  const omittedEvidence = { unregistered: 0, reusedIdentity: 0, missingRecipient: 0 };
  function participant(id: string, at: string): boolean {
    const a = agents.get(id);
    if (!a) {
      omittedEvidence.unregistered++;
      return false;
    }
    if (Date.parse(at) < Date.parse(a.createdAt)) {
      omittedEvidence.reusedIdentity++;
      return false;
    }
    return true;
  }
  for (const t of [...source.tasks].sort(
    (a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.id, b.id),
  )) {
    if (!t.assignee || (terminalTasks.has(t.status) && !inRange(t.updatedAt))) continue;
    if (!participant(t.assignee, t.updatedAt)) continue;
    const n = required(nodeMap.get(t.assignee));
    n.taskTotal++;
    if (n.tasks.length < NETWORK_LIMITS.tasks)
      n.tasks.push({ id: t.id, title: t.title, status: t.status, updatedAt: t.updatedAt });
  }
  const edgeMap = new Map<string, NetworkEdge>();
  const observations: NetworkObservation[] = [];
  const seenEvents = new Set<string>(),
    seenLifecycle = new Set<string>();
  // Newest first ensures duplicate lifecycle records keep deterministic newest evidence.
  for (const e of [...source.history.events].sort(
    (a, b) => compare(b.timestamp, a.timestamp) || compare(a.id, b.id),
  )) {
    if (!inRange(e.timestamp) || !(e.type in lifecycle) || seenEvents.has(e.id)) continue;
    seenEvents.add(e.id);
    if (!("from" in e.metadata)) continue;
    const { from: sender, to: target } = e.metadata;
    if (!target) {
      omittedEvidence.missingRecipient++;
      continue;
    }
    const senderValid = participant(sender, e.timestamp),
      targetValid = participant(target, e.timestamp);
    if (!senderValid || !targetValid) continue;
    const type = e.type as keyof typeof lifecycle;
    const messageId = e.entity?.type === "message" ? e.entity.id : null;
    const key = messageId ? `${sender}:${target}:${messageId}:${type}` : e.id;
    if (seenLifecycle.has(key)) continue;
    seenLifecycle.add(key);
    observations.push({
      id: e.id,
      timestamp: e.timestamp,
      type,
      from: sender,
      to: target,
      messageId,
      messageType: e.metadata.messageType ?? null,
      errorCode: e.metadata.errorCode ?? null,
    });
    if (sender === target) {
      required(nodeMap.get(sender)).selfMessages[lifecycle[type]]++;
      continue;
    }
    const edgeKey = `message:${sender}:${target}`;
    let edge = edgeMap.get(edgeKey);
    if (!edge) {
      edge = {
        kind: "message",
        from: sender,
        to: target,
        lastObservedAt: e.timestamp,
        counts: counts(),
      };
      edgeMap.set(edgeKey, edge);
    }
    if (edge.kind === "message") edge.counts[lifecycle[type]]++;
  }
  const goalSets = new Map<string, Set<string>>(),
    taskSets = new Map<string, Set<string>>();
  for (const g of [...source.goals].sort(
    (a, b) => compare(b.updatedAt, a.updatedAt) || compare(a.id, b.id),
  )) {
    if (terminalGoals.has(g.status) && !inRange(g.updatedAt)) continue;
    const members = new Map<string, "orchestrator" | "worker" | "both">();
    if (participant(g.orchestratorAgentId, g.createdAt))
      members.set(g.orchestratorAgentId, "orchestrator");
    for (const s of g.materialized ? g.tasks : []) {
      if (!participant(s.agentId, g.createdAt)) continue;
      members.set(s.agentId, s.agentId === g.orchestratorAgentId ? "both" : "worker");
      if (!members.has(g.orchestratorAgentId) || s.agentId === g.orchestratorAgentId) continue;
      const key = `orchestration:${g.orchestratorAgentId}:${s.agentId}`;
      let edge = edgeMap.get(key);
      if (!edge) {
        edge = {
          kind: "orchestration",
          from: g.orchestratorAgentId,
          to: s.agentId,
          lastObservedAt: g.updatedAt,
          goalTotal: 0,
          taskTotal: 0,
          references: [],
          referenceTotal: 0,
        };
        edgeMap.set(key, edge);
        goalSets.set(key, new Set());
        taskSets.set(key, new Set());
      }
      if (edge.kind !== "orchestration") continue;
      const refs = required(taskSets.get(key));
      if (refs.has(`${g.id}:${s.taskId}`)) continue;
      refs.add(`${g.id}:${s.taskId}`);
      required(goalSets.get(key)).add(g.id);
      edge.goalTotal = required(goalSets.get(key)).size;
      edge.taskTotal = refs.size;
      edge.referenceTotal++;
      if (edge.references.length < NETWORK_LIMITS.references)
        edge.references.push({ goalId: g.id, taskId: s.taskId });
    }
    for (const [id, participation] of members) {
      const n = required(nodeMap.get(id));
      n.goalTotal++;
      if (n.goals.length < NETWORK_LIMITS.goals)
        n.goals.push({
          id: g.id,
          title: g.title,
          status: g.status,
          updatedAt: g.updatedAt,
          participation,
        });
    }
  }
  const nodes = [...nodeMap.values()].slice(0, NETWORK_LIMITS.nodes),
    returned = new Set(nodes.map((n) => n.id));
  const eligibleEdges = [...edgeMap.values()];
  const edges = eligibleEdges
    .filter((e) => returned.has(e.from) && returned.has(e.to))
    .sort(
      (a, b) =>
        compare(b.lastObservedAt, a.lastObservedAt) ||
        compare(a.kind, b.kind) ||
        compare(a.from, b.from) ||
        compare(a.to, b.to),
    )
    .slice(0, NETWORK_LIMITS.edges);
  const timeline = observations
    .filter((e) => returned.has(e.from) && returned.has(e.to))
    .slice(0, NETWORK_LIMITS.timeline);
  const warnings: NetworkResponse["coverage"]["warnings"] = [];
  if (source.history.retentionTruncated) warnings.push("RETENTION_LIMIT");
  if (source.history.oldestRetainedAt && from < Date.parse(source.history.oldestRetainedAt))
    warnings.push("RANGE_BEFORE_RETAINED_HISTORY");
  if (source.status.degraded || source.status.consecutiveFailures > 0)
    warnings.push("RECORDING_ERRORS");
  if (source.status.integrityWarnings > 0) warnings.push("INTEGRITY_WARNINGS");
  if (source.status.capped) warnings.push("JOURNAL_CAP");
  return NetworkResponseSchema.parse({
    observedAt: now.toISOString(),
    window: query.data.window,
    range: { from: new Date(from).toISOString(), to: now.toISOString() },
    nodes,
    edges,
    timeline,
    totals: {
      eligibleNodes: agents.size,
      displayedNodes: nodes.length,
      eligibleEdges: eligibleEdges.length,
      displayedEdges: edges.length,
      eligibleObservations: observations.length,
      displayedObservations: timeline.length,
    },
    coverage: {
      retainedEvents: source.history.retainedEvents,
      oldestRetainedAt: source.history.oldestRetainedAt,
      newestRetainedAt: source.history.newestRetainedAt,
      status: source.status,
      warnings,
      omittedEvidence,
      limits: NETWORK_LIMITS,
      truncated: {
        nodes: agents.size > nodes.length,
        edges: eligibleEdges.length > edges.length,
        tasks: [...nodeMap.values()].some((n) => n.taskTotal > n.tasks.length),
        goals: [...nodeMap.values()].some((n) => n.goalTotal > n.goals.length),
        timeline: observations.length > timeline.length,
        references: eligibleEdges.some(
          (e) => e.kind === "orchestration" && e.referenceTotal > e.references.length,
        ),
      },
    },
  });
}

export class NetworkService {
  constructor(
    private readonly activity: ActivityPublisher,
    private readonly agents: AgentRegistry,
    private readonly runtime: AgentRuntimeManager,
    private readonly tasks: TaskRegistry,
    private readonly goals: OrchestrationService,
    private readonly now: () => Date = () => new Date(),
  ) {}
  async get(raw: unknown = {}) {
    const query = NetworkQuerySchema.safeParse(raw);
    if (!query.success)
      throw new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid Network query; choose window=1h, 24h or 7d",
      );
    await this.activity.flush();
    return projectNetwork(
      query.data,
      {
        history: this.activity.store.getSnapshot(),
        status: this.activity.status(),
        agents: this.agents.list(),
        runtimes: this.runtime.list(),
        tasks: this.tasks.list(),
        goals: this.goals.list(),
      },
      this.now(),
    );
  }
}
