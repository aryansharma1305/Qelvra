import { z } from "zod";
import { AgentIdSchema } from "./agent.js";
import { ActivityTypeSchema, ActivityStatusSchema } from "./activity-event.js";

export const ANALYTICS_MAX_DAYS = 90;
const Time = z.union([z.iso.datetime(), z.iso.date()]);
export const AnalyticsQuerySchema = z.strictObject({
  from: Time.optional(),
  to: Time.optional(),
  agentId: AgentIdSchema.optional(),
});
const Count = z.number().int().nonnegative();
export const AnalyticsWarningSchema = z.enum([
  "RETENTION_LIMIT",
  "RANGE_BEFORE_RETAINED_HISTORY",
  "RECORDING_ERRORS",
  "INTEGRITY_WARNINGS",
  "JOURNAL_CAP",
]);
export const AnalyticsResponseSchema = z.strictObject({
  range: z.strictObject({ from: z.iso.datetime(), to: z.iso.datetime() }),
  filter: z.strictObject({ agentId: AgentIdSchema.nullable() }),
  summary: z.strictObject({
    recordedEvents: Count,
    involvedAgents: Count,
    taskOutcomeEvents: Count,
    goalOutcomeEvents: Count,
    messagesDelivered: Count,
    executionEvents: Count,
  }),
  daily: z
    .array(z.strictObject({ date: z.iso.date(), recordedEvents: Count }))
    .min(1)
    .max(91),
  byType: z.array(z.strictObject({ type: ActivityTypeSchema, count: Count })),
  taskOutcomes: z.strictObject({
    completed: Count,
    failed: Count,
    reviewRequested: Count,
    returnedToInbox: Count,
  }),
  goalOutcomes: z.strictObject({ completed: Count, failed: Count, cancelled: Count }),
  agents: z.array(
    z.strictObject({
      agentId: AgentIdSchema,
      name: z.string().nullable(),
      role: z.string().nullable(),
      registered: z.boolean(),
      recordedInvolvement: Count,
    }),
  ),
  coverage: z.strictObject({
    retainedEvents: Count,
    oldestRetainedAt: z.iso.datetime().nullable(),
    newestRetainedAt: z.iso.datetime().nullable(),
    recordingHealthy: z.boolean(),
    historyMayBeTruncated: z.boolean(),
    warnings: z.array(AnalyticsWarningSchema),
    status: ActivityStatusSchema,
  }),
  unavailable: z.strictObject({
    tokenUsage: z.null(),
    providerCost: z.null(),
    machineUtilization: z.null(),
  }),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
export type AnalyticsWarning = z.infer<typeof AnalyticsWarningSchema>;
