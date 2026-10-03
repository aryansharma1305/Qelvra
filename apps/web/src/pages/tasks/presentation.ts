import type { Agent, TaskStatus } from "@qelvra/shared";
export const TASK_LABEL: Record<TaskStatus, string> = {
  inbox: "Inbox",
  assigned: "Assigned",
  working: "Working",
  review: "Review",
  completed: "Completed",
  failed: "Failed",
};
export const taskLabelId = (id: string) => id.slice(0, 13);
export const taskDate = (date: string) => date.slice(0, 10);
export function assigneeName(id: string | null, agents: readonly Agent[]) {
  return id ? (agents.find((agent) => agent.id === id)?.name ?? `${id} (deleted)`) : "Unassigned";
}
