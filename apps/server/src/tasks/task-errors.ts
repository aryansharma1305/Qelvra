export type TaskErrorCode =
  | "TASK_NOT_FOUND"
  | "TASK_INVALID_ID"
  | "TASK_INVALID_TITLE"
  | "TASK_INVALID_DESCRIPTION"
  | "TASK_INVALID_TRANSITION"
  | "TASK_AGENT_NOT_FOUND"
  | "TASK_ALREADY_ASSIGNED"
  | "TASK_PERSISTENCE_FAILED";
export class TaskError extends Error {
  override name = "TaskError";
  constructor(
    readonly code: TaskErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
export class TaskRegistryLoadError extends Error {
  override name = "TaskRegistryLoadError";
}
