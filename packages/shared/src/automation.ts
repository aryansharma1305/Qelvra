import { z } from "zod";
import { AgentIdSchema } from "./agent.js";
import { TaskIdSchema, TaskTitleSchema, TaskDescriptionSchema } from "./task.js";
import { ExecutionIdSchema } from "./execution-result.js";

export const AUTOMATION_LIMITS = {
  automations: 100,
  runs: 500,
  history: 50,
  concurrent: 1,
  minMinutes: 5,
  maxMinutes: 43200,
} as const;
export const AutomationIdSchema = z
  .string()
  .regex(/^auto-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const AutomationRunIdSchema = z
  .string()
  .regex(/^run-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const AutomationScheduleSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("once"), at: z.iso.datetime() }),
  z.strictObject({
    kind: z.literal("interval"),
    startsAt: z.iso.datetime(),
    everyMinutes: z
      .number()
      .int()
      .min(AUTOMATION_LIMITS.minMinutes)
      .max(AUTOMATION_LIMITS.maxMinutes),
  }),
]);
export const AutomationInputSchema = z.strictObject({
  title: TaskTitleSchema,
  taskTitle: TaskTitleSchema,
  description: TaskDescriptionSchema,
  agentId: AgentIdSchema,
  schedule: AutomationScheduleSchema,
});
export const AutomationRevisionSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER - 1);
export const AutomationMutationSchema = z.strictObject({ revision: AutomationRevisionSchema });
export const AutomationAdmissionSchema = z.strictObject({
  revision: AutomationRevisionSchema,
  acknowledgeInterruption: z.boolean().default(false),
});
export const AutomationUpdateSchema = AutomationInputSchema.extend({
  revision: AutomationRevisionSchema,
});
export const AutomationSchema = AutomationInputSchema.extend({
  id: AutomationIdSchema,
  enabled: z.boolean(),
  needsAttention: z.boolean(),
  nextRunAt: z.iso.datetime().nullable(),
  revision: AutomationRevisionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  runCount: z
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER - 1),
});
export const AUTOMATION_RUN_STATUSES = [
  "reserved",
  "running",
  "review",
  "failed",
  "interrupted",
  "skipped",
] as const;
export const AutomationRunSchema = z.strictObject({
  ordinal: z
    .number()
    .int()
    .min(1)
    .max(Number.MAX_SAFE_INTEGER - 1),
  id: AutomationRunIdSchema,
  automationId: AutomationIdSchema,
  agentId: AgentIdSchema,
  taskId: TaskIdSchema.nullable(),
  executionId: ExecutionIdSchema.nullable(),
  trigger: z.enum(["scheduled", "manual"]),
  requestedRevision: AutomationRevisionSchema.nullable(),
  scheduledAt: z.iso.datetime().nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  status: z.enum(AUTOMATION_RUN_STATUSES),
  errorCode: z
    .string()
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .max(80)
    .nullable(),
  missedOccurrences: z.number().int().nonnegative(),
});
export const AutomationViewSchema = AutomationSchema.extend({
  lastRun: AutomationRunSchema.nullable(),
});
export const AutomationListSchema = z.strictObject({
  automations: z.array(AutomationViewSchema).max(AUTOMATION_LIMITS.automations),
  scheduler: z.strictObject({ running: z.boolean(), healthy: z.boolean() }),
  limits: z.strictObject({
    automations: z.literal(100),
    runs: z.literal(500),
    history: z.literal(50),
    concurrent: z.literal(1),
    minMinutes: z.literal(5),
    maxMinutes: z.literal(43200),
  }),
});
export const AutomationResponseSchema = z.strictObject({ automation: AutomationViewSchema });
export const AutomationRunResponseSchema = z.strictObject({ run: AutomationRunSchema });
export const AutomationHistoryQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(50).default(50),
});
export const AutomationHistorySchema = z.strictObject({
  runs: z.array(AutomationRunSchema).max(50),
  retained: z.number().int().nonnegative(),
  recorded: z.number().int().nonnegative(),
  truncated: z.boolean(),
});
export type Automation = z.infer<typeof AutomationSchema>;
export type AutomationInput = z.infer<typeof AutomationInputSchema>;
export type AutomationSchedule = z.infer<typeof AutomationScheduleSchema>;
export type AutomationRun = z.infer<typeof AutomationRunSchema>;
export type AutomationView = z.infer<typeof AutomationViewSchema>;
