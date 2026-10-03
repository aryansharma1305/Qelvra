import { z } from "zod";
import { AgentIdSchema } from "./agent.js";

/** Workflow states of a task; also the columns of the Mission Control board. */
export const TASK_STATUSES = [
  "inbox",
  "assigned",
  "working",
  "review",
  "completed",
  "failed",
] as const;

export const TaskStatusSchema = z.enum(TASK_STATUSES);

export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskIdSchema = z
  .string()
  .regex(/^task-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const TaskTitleSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .refine((value) => !/[\p{Cc}\p{Cf}]/u.test(value), "Title must contain printable text");
export const TaskDescriptionSchema = z
  .string()
  .max(16384)
  .refine(
    (value) =>
      new TextEncoder().encode(value).length <= 16384 &&
      !Array.from(value).some((char) => {
        const code = char.charCodeAt(0);
        return (code < 32 && ![9, 10, 13].includes(code)) || (code >= 127 && code <= 159);
      }),
    "Description must be at most 16 KiB and contain no invalid control characters",
  );
export const TaskSchema = z
  .strictObject({
    id: TaskIdSchema,
    title: TaskTitleSchema,
    description: TaskDescriptionSchema,
    status: TaskStatusSchema,
    assignee: AgentIdSchema.nullable(),
    createdBy: z.literal("user"),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .refine(
    (task) => (task.status === "inbox" ? task.assignee === null : task.assignee !== null),
    "Task status and assignee must agree",
  )
  .refine(
    (task) => Date.parse(task.updatedAt) >= Date.parse(task.createdAt),
    "Updated timestamp must not precede creation",
  );
export type Task = z.infer<typeof TaskSchema>;
export const CreateTaskRequestSchema = z.object({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema.default(""),
  assignee: AgentIdSchema.nullable().optional(),
});
export type CreateTaskRequest = z.input<typeof CreateTaskRequestSchema>;
export const AssignTaskRequestSchema = z.strictObject({ agentId: AgentIdSchema });
export const TaskResponseSchema = z.object({ task: TaskSchema });
export const TaskListResponseSchema = z.object({ tasks: z.array(TaskSchema) });
