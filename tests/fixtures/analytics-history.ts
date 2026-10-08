import { ActivityEventSchema, type ActivityInput } from "@qelvra/shared";
export const ANALYTICS_TASK_ID = "task-00000000-0000-4000-8000-000000000001";
export const ANALYTICS_GOAL_ID = "goal-00000000-0000-4000-8000-000000000001";
export function analyticsEvent(input: ActivityInput, timestamp: string, index: number) {
  return ActivityEventSchema.parse({
    ...input,
    timestamp,
    id: `evt-00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
  });
}
export function analyticsHistory() {
  const task = {
    entity: { type: "task" as const, id: ANALYTICS_TASK_ID },
    metadata: { taskTitle: "PRIVATE_TASK_DESCRIPTION", assigneeId: "nova" },
  };
  const goal = {
    entity: { type: "orchestration" as const, id: ANALYTICS_GOAL_ID },
    metadata: { goalId: ANALYTICS_GOAL_ID },
  };
  return [
    analyticsEvent(
      {
        type: "agent.created",
        entity: { type: "agent", id: "nova" },
        metadata: { agentName: "PRIVATE_PROMPT" },
      },
      "2026-10-01T00:00:00.000Z",
      1,
    ),
    analyticsEvent({ type: "task.completed", ...task }, "2026-10-01T23:59:59.999Z", 2),
    analyticsEvent({ type: "task.completed", ...task }, "2026-10-02T00:00:00.000Z", 3),
    analyticsEvent(
      {
        type: "message.delivered",
        metadata: { from: "nova", to: "atlas", messageType: "message" },
      },
      "2026-10-02T12:00:00.000Z",
      4,
    ),
    analyticsEvent({ type: "orchestration.completed", ...goal }, "2026-10-02T16:00:00.000Z", 5),
    analyticsEvent(
      {
        type: "agent.deleted",
        entity: { type: "agent", id: "retired" },
        metadata: { agentName: "PRIVATE_ENV" },
      },
      "2026-10-02T18:00:00.000Z",
      6,
    ),
    analyticsEvent(
      {
        type: "file.updated",
        entity: { type: "agent", id: "nova" },
        metadata: { agentId: "nova", relativePath: "PRIVATE_FILE_CONTENT" },
      },
      "2026-10-04T10:00:00.000Z",
      7,
    ),
  ];
}
export const ANALYTICS_RANGE = { from: "2026-10-01", to: "2026-10-05" };
