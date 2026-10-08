import {
  AgentSchema,
  OrchestrationSchema,
  TaskSchema,
  parseActivityEvent,
  type ActivityEvent,
  type Orchestration,
  type Task,
  type Agent,
  type NetworkWindow,
} from "@qelvra/shared";
import { projectNetwork } from "../../apps/server/src/network/network-service";
export const NETWORK_NOW = "2026-10-09T12:00:00.000Z";
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function agent(id: string, patch: Partial<Agent> = {}) {
  return AgentSchema.parse({
    id,
    name: id.toUpperCase(),
    role: "Engineer",
    status: "stopped",
    providerId: "codex",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: NETWORK_NOW,
    ...patch,
  });
}
export function task(n: number, assignee: string | null, patch: Partial<Task> = {}) {
  return TaskSchema.parse({
    id: `task-${uuid(n)}`,
    title: `Task ${n}`,
    description: "PRIVATE_TASK_DESCRIPTION",
    status: assignee ? "assigned" : "inbox",
    assignee,
    createdBy: "user",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-10-09T11:00:00.000Z",
    ...patch,
  });
}
export function goal(n: number, workers: string[], patch: Partial<Orchestration> = {}) {
  const tasks = workers.map((agentId, i) => ({
    key: `step-${i}`,
    taskId: `task-${uuid(n * 100 + i)}`,
    agentId,
    attempts: 0,
    executionId: null,
    reviewedExecutionId: null,
    review: null,
    result: null,
    reworkInstructions: null,
  }));
  return OrchestrationSchema.parse({
    id: `goal-${uuid(n)}`,
    title: `Goal ${n}`,
    description: "PRIVATE_GOAL_DESCRIPTION",
    status: "running",
    orchestratorAgentId: "lead",
    plan: workers.length
      ? {
          summary: "PRIVATE_PLAN_SUMMARY",
          tasks: tasks.map((s) => ({
            key: s.key,
            title: "Work",
            description: "PRIVATE_PLAN",
            preferredRole: "Engineer",
            dependsOn: [],
          })),
        }
      : null,
    taskIds: tasks.map((s) => s.taskId),
    tasks,
    controlTaskIds: [],
    decision: null,
    maxAttempts: 3,
    materialized: !!workers.length,
    finalSummary: null,
    errorCode: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-09T11:30:00.000Z",
    startedAt: "2026-10-09T11:00:00.000Z",
    ...patch,
  });
}
export function observation(
  n: number,
  from: string,
  to: string | undefined,
  type:
    | "message.queued"
    | "message.delivered"
    | "message.quarantined"
    | "message.delivery_failed" = "message.delivered",
  timestamp = "2026-10-09T11:00:00.000Z",
  message = n,
): ActivityEvent {
  const event = parseActivityEvent({
    id: `evt-${uuid(n)}`,
    timestamp,
    type,
    ...(message >= 0 ? { entity: { type: "message", id: `msg-${uuid(message)}` } } : {}),
    metadata: {
      from,
      ...(to ? { to } : {}),
      messageType: "message",
      ...(type === "message.delivery_failed" ? { errorCode: "DELIVERY_FAILED" } : {}),
    },
  });
  if (!event) throw new Error("Invalid Network fixture");
  return event;
}
export function sources(events: ActivityEvent[] = []): Parameters<typeof projectNetwork>[1] {
  return {
    agents: [agent("lead"), agent("worker", { status: "running" }), agent("isolated")],
    runtimes: [
      {
        agentId: "worker",
        sessionId: "PRIVATE_SESSION",
        pid: 123456,
        startedAt: "2026-10-09T10:00:00.000Z",
        attached: true,
      },
    ],
    tasks: [task(1, "worker")],
    goals: [goal(1, ["worker"])],
    history: {
      events,
      retainedEvents: events.length,
      oldestRetainedAt: events.at(0)?.timestamp ?? null,
      newestRetainedAt: events.at(-1)?.timestamp ?? null,
      retentionTruncated: false,
    },
    status: { degraded: false, consecutiveFailures: 0, integrityWarnings: 0, capped: false },
  };
}
export function networkFixture(window: NetworkWindow = "24h") {
  return projectNetwork(
    { window },
    sources([
      observation(1, "lead", "worker", "message.queued"),
      observation(2, "lead", "worker", "message.delivered", "2026-10-09T11:01:00.000Z", 1),
      observation(3, "worker", "lead"),
    ]),
    new Date(NETWORK_NOW),
  );
}
