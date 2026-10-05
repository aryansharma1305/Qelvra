import { ExecutionResultSchema, type Execution, type Message, type Task } from "@qelvra/shared";

/** Pure admission check. Never trusts provider claims about identity, paths or workflow. */
export function correlatedResult(message: Message, execution: Execution, task: Task) {
  if (
    message.type !== "result" ||
    message.to !== "system" ||
    execution.status !== "awaiting_result"
  )
    return null;
  let body: unknown;
  try {
    body = JSON.parse(message.body);
  } catch {
    return null;
  }
  const parsed = ExecutionResultSchema.safeParse(body);
  if (!parsed.success) return null;
  const result = parsed.data;
  return message.from === execution.agentId &&
    task.assignee === execution.agentId &&
    result.agentId === execution.agentId &&
    result.taskId === execution.taskId &&
    task.id === execution.taskId &&
    result.executionId === execution.id &&
    result.requestMessageId === execution.requestMessageId &&
    (task.status === "working" || task.status === "review")
    ? result
    : null;
}
