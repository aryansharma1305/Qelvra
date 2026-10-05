import { z } from "zod";
import { AgentIdSchema } from "./agent.js";
import { TaskIdSchema, TaskTitleSchema, TaskDescriptionSchema } from "./task.js";
import { ChangedFileSchema, ExecutionIdSchema, ExecutionResultSchema } from "./execution-result.js";

export const GoalIdSchema = z
  .string()
  .regex(/^goal-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
const bounded = (bytes: number) =>
  z
    .string()
    .max(bytes)
    .refine((s) => !s.includes("\0") && new TextEncoder().encode(s).length <= bytes);
const nonempty = (bytes: number) => bounded(bytes).refine((s) => s.trim().length > 0);
export const PlanKeySchema = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const PlanTaskSchema = z.strictObject({
  key: PlanKeySchema,
  title: TaskTitleSchema,
  description: bounded(1024),
  preferredRole: nonempty(120),
  dependsOn: z.array(PlanKeySchema).max(19),
});
export const OrchestrationPlanSchema = z
  .strictObject({ summary: nonempty(1024), tasks: z.array(PlanTaskSchema).min(1).max(20) })
  .superRefine((plan, ctx) => {
    const keys = new Set(plan.tasks.map((t) => t.key));
    let valid = keys.size === plan.tasks.length;
    const visiting = new Set<string>(),
      visited = new Set<string>();
    function visit(key: string): boolean {
      if (visiting.has(key)) return false;
      if (visited.has(key)) return true;
      visiting.add(key);
      const task = plan.tasks.find((t) => t.key === key);
      if (!task || new Set(task.dependsOn).size !== task.dependsOn.length) return false;
      if (!task.dependsOn.every((dep) => keys.has(dep) && visit(dep))) return false;
      visiting.delete(key);
      visited.add(key);
      return true;
    }
    valid &&= plan.tasks.every((t) => visit(t.key));
    if (!valid || new TextEncoder().encode(JSON.stringify(plan)).length > 14 * 1024)
      ctx.addIssue({
        code: "custom",
        message: "Plan must have unique keys, acyclic existing dependencies and fit in 14 KiB",
      });
  });
export type OrchestrationPlan = z.infer<typeof OrchestrationPlanSchema>;
export const ReviewDecisionSchema = z
  .strictObject({
    decision: z.enum(["approve", "rework", "fail"]),
    reason: nonempty(2048),
    reworkInstructions: bounded(2048).nullable(),
  })
  .refine(
    (r) => r.decision !== "rework" || !!r.reworkInstructions?.trim(),
    "Rework requires instructions",
  );
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export const GoalSummarySchema = z
  .strictObject({
    goalId: GoalIdSchema,
    status: z.literal("completed"),
    summary: nonempty(4096),
    completedTasks: z.array(TaskIdSchema).min(1).max(20),
    artifacts: z
      .array(
        z.strictObject({
          taskId: TaskIdSchema,
          agentId: AgentIdSchema,
          files: z.array(ChangedFileSchema).max(200),
        }),
      )
      .max(20),
    limitations: bounded(2048),
  })
  .refine((v) => new TextEncoder().encode(JSON.stringify(v)).length <= 14 * 1024);
export type GoalSummary = z.infer<typeof GoalSummarySchema>;
export const OrchestrationSlotSchema = z.strictObject({
  key: PlanKeySchema,
  taskId: TaskIdSchema,
  agentId: AgentIdSchema,
  attempts: z.number().int().min(0).max(3),
  executionId: ExecutionIdSchema.nullable(),
  reviewedExecutionId: ExecutionIdSchema.nullable(),
  review: ReviewDecisionSchema.nullable(),
  result: ExecutionResultSchema.nullable(),
  reworkInstructions: bounded(2048).nullable(),
});
export type OrchestrationSlot = z.infer<typeof OrchestrationSlotSchema>;
export const ORCHESTRATION_STATUSES = [
  "draft",
  "planning",
  "planned",
  "running",
  "reviewing",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;
export const OrchestrationSchema = z
  .strictObject({
    id: GoalIdSchema,
    title: TaskTitleSchema,
    description: TaskDescriptionSchema,
    status: z.enum(ORCHESTRATION_STATUSES),
    orchestratorAgentId: AgentIdSchema,
    plan: OrchestrationPlanSchema.nullable(),
    taskIds: z.array(TaskIdSchema).max(20),
    tasks: z.array(OrchestrationSlotSchema).max(20),
    controlTaskIds: z.array(TaskIdSchema).max(100),
    decision: z
      .strictObject({
        kind: z.enum(["plan", "review", "summary"]),
        taskId: TaskIdSchema,
        key: PlanKeySchema.nullable(),
        executionId: ExecutionIdSchema.nullable(),
      })
      .nullable(),
    maxAttempts: z.number().int().min(1).max(3),
    materialized: z.boolean(),
    finalSummary: GoalSummarySchema.nullable(),
    errorCode: z
      .string()
      .max(80)
      .regex(/^[A-Z][A-Z0-9_]*$/)
      .nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    startedAt: z.iso.datetime().nullable(),
  })
  .superRefine((goal, ctx) => {
    const all = [...goal.taskIds, ...goal.controlTaskIds];
    if (
      new Set(all).size !== all.length ||
      goal.taskIds.length !== goal.tasks.length ||
      goal.tasks.some(
        (s, i) =>
          s.taskId !== goal.taskIds[i] ||
          !goal.plan?.tasks.some((t) => t.key === s.key) ||
          (s.result &&
            (s.result.taskId !== s.taskId ||
              s.result.agentId !== s.agentId ||
              s.result.executionId !== s.executionId)),
      ) ||
      new Set(goal.tasks.map((t) => t.key)).size !== goal.tasks.length ||
      (goal.decision && !goal.controlTaskIds.includes(goal.decision.taskId)) ||
      (goal.materialized && (!goal.plan || goal.tasks.length !== goal.plan.tasks.length)) ||
      (goal.finalSummary && goal.finalSummary.goalId !== goal.id)
    )
      ctx.addIssue({ code: "custom", message: "Goal identities, mapping and results must agree" });
  });
export type Orchestration = z.infer<typeof OrchestrationSchema>;
export const CreateOrchestrationRequestSchema = z.strictObject({
  title: TaskTitleSchema,
  description: TaskDescriptionSchema.default(""),
  orchestratorAgentId: AgentIdSchema,
});
export type CreateOrchestrationRequest = z.input<typeof CreateOrchestrationRequestSchema>;
export const OrchestrationResponseSchema = z.strictObject({ orchestration: OrchestrationSchema });
export const OrchestrationListResponseSchema = z.strictObject({
  orchestrations: z.array(OrchestrationSchema),
});
