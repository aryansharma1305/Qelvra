import { z } from "zod";
import { AgentIdSchema, AgentNameSchema, AgentRoleSchema, AgentStatusSchema } from "./agent.js";
import { TaskIdSchema, TaskTitleSchema, TaskStatusSchema } from "./task.js";
import { GoalIdSchema, ORCHESTRATION_STATUSES } from "./orchestration.js";
import {
  ActivityIdSchema,
  ActivityStatusSchema,
  MESSAGE_ACTIVITY_TYPES,
} from "./activity-event.js";
import { MessageIdSchema, MessageTypeSchema } from "./message.js";

export const NETWORK_LIMITS = {
  nodes: 100,
  edges: 200,
  tasks: 20,
  goals: 20,
  timeline: 50,
  references: 20,
} as const;
export const NetworkWindowSchema = z.enum(["1h", "24h", "7d"]);
export type NetworkWindow = z.infer<typeof NetworkWindowSchema>;
export const NetworkQuerySchema = z.strictObject({ window: NetworkWindowSchema.default("24h") });
export type NetworkQuery = z.input<typeof NetworkQuerySchema>;
const count = z.number().int().nonnegative();
export const MessageCountsSchema = z.strictObject({
  queued: count,
  delivered: count,
  quarantined: count,
  deliveryFailed: count,
});
const TaskDetailSchema = z.strictObject({
  id: TaskIdSchema,
  title: TaskTitleSchema,
  status: TaskStatusSchema,
  updatedAt: z.iso.datetime(),
});
const GoalDetailSchema = z.strictObject({
  id: GoalIdSchema,
  title: TaskTitleSchema,
  status: z.enum(ORCHESTRATION_STATUSES),
  updatedAt: z.iso.datetime(),
  participation: z.enum(["orchestrator", "worker", "both"]),
});
export const NetworkNodeSchema = z.strictObject({
  id: AgentIdSchema,
  name: AgentNameSchema,
  role: AgentRoleSchema,
  status: AgentStatusSchema,
  providerId: z.string().min(1).max(64).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  runtime: z.strictObject({
    present: z.boolean(),
    startedAt: z.iso.datetime().nullable(),
    attached: z.boolean(),
  }),
  tasks: z.array(TaskDetailSchema).max(NETWORK_LIMITS.tasks),
  taskTotal: count,
  goals: z.array(GoalDetailSchema).max(NETWORK_LIMITS.goals),
  goalTotal: count,
  selfMessages: MessageCountsSchema,
});
const endpoints = { from: AgentIdSchema, to: AgentIdSchema, lastObservedAt: z.iso.datetime() };
export const NetworkEdgeSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("message"), ...endpoints, counts: MessageCountsSchema }),
  z.strictObject({
    kind: z.literal("orchestration"),
    ...endpoints,
    goalTotal: count,
    taskTotal: count,
    references: z
      .array(z.strictObject({ goalId: GoalIdSchema, taskId: TaskIdSchema }))
      .max(NETWORK_LIMITS.references),
    referenceTotal: count,
  }),
]);
export const NetworkObservationSchema = z.strictObject({
  id: ActivityIdSchema,
  timestamp: z.iso.datetime(),
  type: z.enum(MESSAGE_ACTIVITY_TYPES),
  from: AgentIdSchema,
  to: AgentIdSchema,
  messageId: MessageIdSchema.nullable(),
  messageType: MessageTypeSchema.nullable(),
  errorCode: z
    .string()
    .max(80)
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .nullable(),
});
export const NETWORK_WARNINGS = [
  "RETENTION_LIMIT",
  "RANGE_BEFORE_RETAINED_HISTORY",
  "RECORDING_ERRORS",
  "INTEGRITY_WARNINGS",
  "JOURNAL_CAP",
] as const;
export const NetworkResponseSchema = z
  .strictObject({
    observedAt: z.iso.datetime(),
    window: NetworkWindowSchema,
    range: z.strictObject({ from: z.iso.datetime(), to: z.iso.datetime() }),
    nodes: z.array(NetworkNodeSchema).max(NETWORK_LIMITS.nodes),
    edges: z.array(NetworkEdgeSchema).max(NETWORK_LIMITS.edges),
    timeline: z.array(NetworkObservationSchema).max(NETWORK_LIMITS.timeline),
    totals: z.strictObject({
      eligibleNodes: count,
      displayedNodes: count,
      eligibleEdges: count,
      displayedEdges: count,
      eligibleObservations: count,
      displayedObservations: count,
    }),
    coverage: z.strictObject({
      retainedEvents: count,
      oldestRetainedAt: z.iso.datetime().nullable(),
      newestRetainedAt: z.iso.datetime().nullable(),
      status: ActivityStatusSchema,
      warnings: z.array(z.enum(NETWORK_WARNINGS)).max(NETWORK_WARNINGS.length),
      omittedEvidence: z.strictObject({
        unregistered: count,
        reusedIdentity: count,
        missingRecipient: count,
      }),
      limits: z.strictObject({
        nodes: z.literal(100),
        edges: z.literal(200),
        tasks: z.literal(20),
        goals: z.literal(20),
        timeline: z.literal(50),
        references: z.literal(20),
      }),
      truncated: z.strictObject({
        nodes: z.boolean(),
        edges: z.boolean(),
        tasks: z.boolean(),
        goals: z.boolean(),
        timeline: z.boolean(),
        references: z.boolean(),
      }),
    }),
  })
  .superRefine((value, ctx) => {
    const ids = new Set(value.nodes.map((n) => n.id));
    const edgeIds = new Set(value.edges.map((e) => `${e.kind}:${e.from}:${e.to}`));
    if (
      ids.size !== value.nodes.length ||
      edgeIds.size !== value.edges.length ||
      value.edges.some((e) => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to) ||
      value.timeline.some((e) => !ids.has(e.from) || !ids.has(e.to)) ||
      value.totals.displayedNodes !== value.nodes.length ||
      value.totals.displayedEdges !== value.edges.length ||
      value.totals.displayedObservations !== value.timeline.length ||
      value.totals.eligibleNodes < value.nodes.length ||
      value.totals.eligibleEdges < value.edges.length ||
      value.totals.eligibleObservations < value.timeline.length ||
      value.nodes.some(
        (n) =>
          n.taskTotal < n.tasks.length ||
          n.goalTotal < n.goals.length ||
          n.runtime.present !== (n.runtime.startedAt !== null) ||
          (!n.runtime.present && n.runtime.attached),
      ) ||
      value.edges.some(
        (e) => e.kind === "orchestration" && e.referenceTotal < e.references.length,
      ) ||
      value.observedAt !== value.range.to ||
      Date.parse(value.range.from) >= Date.parse(value.range.to)
    )
      ctx.addIssue({
        code: "custom",
        message: "Network identities, bounds and displayed totals must agree",
      });
  });
export type NetworkResponse = z.infer<typeof NetworkResponseSchema>;
export type NetworkNode = z.infer<typeof NetworkNodeSchema>;
export type NetworkEdge = z.infer<typeof NetworkEdgeSchema>;
export type NetworkObservation = z.infer<typeof NetworkObservationSchema>;
export type MessageCounts = z.infer<typeof MessageCountsSchema>;
