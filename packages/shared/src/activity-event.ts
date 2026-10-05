import { z } from "zod";
import { ProviderIdSchema } from "./provider.js";
import { AgentIdSchema, AgentNameSchema } from "./agent.js";
import { MessageIdSchema, MessageTypeSchema } from "./message.js";
import { TaskIdSchema, TaskTitleSchema } from "./task.js";
import { ExecutionIdSchema } from "./execution-result.js";
import { GoalIdSchema } from "./orchestration.js";

export const AGENT_ACTIVITY_TYPES = [
  "agent.created",
  "agent.started",
  "agent.stopped",
  "agent.restarted",
  "agent.deleted",
  "agent.error",
] as const;
export const MESSAGE_ACTIVITY_TYPES = [
  "message.queued",
  "message.delivered",
  "message.quarantined",
  "message.delivery_failed",
] as const;
export const TASK_ACTIVITY_TYPES = [
  "task.created",
  "task.assigned",
  "task.started",
  "task.review_requested",
  "task.completed",
  "task.failed",
  "task.returned_to_inbox",
] as const;
export const ROUTER_ACTIVITY_TYPES = ["router.started", "router.stopped", "router.error"] as const;
export const EXECUTION_ACTIVITY_TYPES = [
  "execution.started",
  "execution.completed",
  "execution.failed",
  "execution.cancelled",
] as const;
export const ORCHESTRATION_ACTIVITY_TYPES = [
  "orchestration.created",
  "orchestration.planning",
  "orchestration.planned",
  "orchestration.started",
  "orchestration.task_started",
  "orchestration.task_approved",
  "orchestration.task_rework",
  "orchestration.completed",
  "orchestration.failed",
  "orchestration.cancelled",
  "orchestration.paused",
  "orchestration.resumed",
] as const;
export const ACTIVITY_TYPES = [
  ...AGENT_ACTIVITY_TYPES,
  ...MESSAGE_ACTIVITY_TYPES,
  ...TASK_ACTIVITY_TYPES,
  ...ROUTER_ACTIVITY_TYPES,
  ...EXECUTION_ACTIVITY_TYPES,
  ...ORCHESTRATION_ACTIVITY_TYPES,
] as const;
export const ActivityTypeSchema = z.enum(ACTIVITY_TYPES);
export const ActivityIdSchema = z
  .string()
  .regex(/^evt-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const ErrorCode = z
  .string()
  .max(80)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const actor = z
  .strictObject({
    type: z.enum(["user", "agent", "system"]),
    id: AgentIdSchema.optional(),
    name: AgentNameSchema.optional(),
  })
  .optional();
// Strict allowlists: never accept bodies, descriptions, terminal data, env or arbitrary blobs.
export const ActivityInputSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.enum(ORCHESTRATION_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("orchestration"), id: GoalIdSchema }),
    metadata: z.strictObject({
      goalId: GoalIdSchema,
      taskId: TaskIdSchema.optional(),
      agentId: AgentIdSchema.optional(),
      attempt: z.number().int().min(1).max(3).optional(),
      errorCode: ErrorCode.optional(),
    }),
  }),
  z.strictObject({
    type: z.enum(EXECUTION_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("task"), id: TaskIdSchema }),
    metadata: z.strictObject({
      executionId: ExecutionIdSchema,
      taskId: TaskIdSchema,
      agentId: AgentIdSchema,
      providerId: ProviderIdSchema,
      errorCode: ErrorCode.optional(),
    }),
  }),
  z.strictObject({
    type: z.enum(AGENT_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("agent"), id: AgentIdSchema }),
    metadata: z.strictObject({
      agentName: AgentNameSchema,
      providerId: ProviderIdSchema.optional(),
      errorCode: ErrorCode.optional(),
    }),
  }),
  z.strictObject({
    type: z.enum(TASK_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("task"), id: TaskIdSchema }),
    metadata: z.strictObject({
      taskTitle: TaskTitleSchema,
      assigneeId: AgentIdSchema.nullable(),
      assigneeName: AgentNameSchema.optional(),
    }),
  }),
  z.strictObject({
    type: z.enum(MESSAGE_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("message"), id: MessageIdSchema }).optional(),
    metadata: z.strictObject({
      from: AgentIdSchema,
      to: AgentIdSchema.optional(),
      messageType: MessageTypeSchema.optional(),
      errorCode: ErrorCode.optional(),
    }),
  }),
  z.strictObject({
    type: z.enum(ROUTER_ACTIVITY_TYPES),
    actor,
    entity: z.strictObject({ type: z.literal("router"), id: z.literal("router") }),
    metadata: z.strictObject({ errorCode: ErrorCode.optional() }),
  }),
]);
// Input's strictness also applies to persisted events: parse the two server fields separately.
export function parseActivityEvent(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { id, timestamp, ...input } = value as Record<string, unknown>;
  const fields = z
    .strictObject({ id: ActivityIdSchema, timestamp: z.iso.datetime() })
    .safeParse({ id, timestamp });
  const payload = ActivityInputSchema.safeParse(input);
  return fields.success && payload.success ? { ...payload.data, ...fields.data } : null;
}
export const ActivityEventSchema = z.unknown().transform((value, ctx) => {
  const parsed = parseActivityEvent(value);
  if (!parsed) {
    ctx.addIssue({ code: "custom", message: "Invalid activity event" });
    return z.NEVER;
  }
  return parsed;
});
export const ValidatedActivityEventSchema = ActivityEventSchema;
export type ActivityInput = z.infer<typeof ActivityInputSchema>;
export type ActivityEvent = NonNullable<ReturnType<typeof parseActivityEvent>>;
export type ActivityType = z.infer<typeof ActivityTypeSchema>;
export const ActivityStatusSchema = z.strictObject({
  degraded: z.boolean(),
  consecutiveFailures: z.number().int().nonnegative(),
  integrityWarnings: z.number().int().nonnegative(),
  capped: z.boolean(),
});
export type ActivityStatus = z.infer<typeof ActivityStatusSchema>;
export const ActivityListResponseSchema = z.strictObject({
  events: z.array(ValidatedActivityEventSchema).max(100),
  nextCursor: ActivityIdSchema.nullable(),
  status: ActivityStatusSchema,
});
export type ActivityListResponse = z.infer<typeof ActivityListResponseSchema>;
export const ActivityStreamMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("activity.event"), event: ValidatedActivityEventSchema }),
  z.strictObject({ type: z.literal("activity.status"), status: ActivityStatusSchema }),
]);

export const ActivitySummarySchema = z.strictObject({
  activeAgents: z.number().int().nonnegative(),
  completedToday: z.number().int().nonnegative(),
  workingTasks: z.number().int().nonnegative(),
  recordedDeliveriesToday: z.number().int().nonnegative(),
});
export type ActivitySummary = z.infer<typeof ActivitySummarySchema>;
