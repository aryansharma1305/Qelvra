import { z } from "zod";

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
