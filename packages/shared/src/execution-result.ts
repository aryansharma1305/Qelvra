import { z } from "zod";
import { AgentIdSchema } from "./agent.js";
import { MessageIdSchema } from "./message.js";
import { ProviderIdSchema } from "./provider.js";
import { TaskIdSchema, TaskTitleSchema, TaskDescriptionSchema } from "./task.js";

export const CONTROL_RECIPIENT = "system";
export const ExecutionIdSchema = z
  .string()
  .regex(/^exec-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const text = (bytes: number) =>
  z
    .string()
    .max(bytes)
    .refine((s) => !s.includes("\0") && new TextEncoder().encode(s).length <= bytes);
export const ChangedFileSchema = z
  .string()
  .min(1)
  .max(512)
  .refine(
    (p) =>
      !/[:\\\p{Cc}\p{Cf}]/u.test(p) &&
      !p.startsWith("/") &&
      p.split("/").every((part) => part !== ".." && part !== "." && part !== ""),
    "Changed files must be safe relative paths",
  );
export const ExecutionResultSchema = z
  .strictObject({
    executionId: ExecutionIdSchema,
    requestMessageId: MessageIdSchema,
    taskId: TaskIdSchema,
    agentId: AgentIdSchema,
    status: z.enum(["completed", "failed"]),
    summary: text(8192).refine((s) => s.trim().length > 0),
    changedFiles: z.array(ChangedFileSchema).max(200),
    notes: text(16384).nullable(),
  })
  .refine(
    (r) => new TextEncoder().encode(JSON.stringify(r)).length <= 60 * 1024,
    "Result must fit in a bounded mailbox body",
  );
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
export const TaskExecutionRequestSchema = z.strictObject({
  kind: z.literal("qelvra.task.v1"),
  executionId: ExecutionIdSchema,
  taskId: TaskIdSchema,
  agentId: AgentIdSchema,
  title: TaskTitleSchema,
  description: TaskDescriptionSchema,
  workspace: z.literal("."),
  instructions: z.array(text(1024)).max(8),
  /** Server-only context; HTTP Execute accepts no fields. */
  decision: z
    .strictObject({ phase: z.enum(["plan", "review", "summary"]), context: text(48 * 1024) })
    .optional(),
});
export type TaskExecutionRequest = z.infer<typeof TaskExecutionRequestSchema>;
export const EXECUTION_STATUSES = [
  "queued",
  "starting",
  "running",
  "awaiting_result",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
] as const;
export const ExecutionSchema = z.strictObject({
  id: ExecutionIdSchema,
  taskId: TaskIdSchema,
  agentId: AgentIdSchema,
  providerId: ProviderIdSchema,
  status: z.enum(EXECUTION_STATUSES),
  requestMessageId: MessageIdSchema.nullable(),
  resultMessageId: MessageIdSchema.nullable(),
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
  errorCode: z
    .string()
    .max(80)
    .regex(/^[A-Z][A-Z0-9_]*$/)
    .nullable(),
  result: ExecutionResultSchema.nullable(),
});
export type Execution = z.infer<typeof ExecutionSchema>;
export const TaskExecutionResponseSchema = z.strictObject({
  execution: ExecutionSchema.nullable(),
  result: ExecutionResultSchema.nullable(),
});
export type TaskExecutionResponse = z.infer<typeof TaskExecutionResponseSchema>;
