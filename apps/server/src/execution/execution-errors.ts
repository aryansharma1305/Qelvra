export const EXECUTION_ERROR_CODES = [
  "TASK_NOT_ASSIGNED",
  "TASK_ALREADY_EXECUTING",
  "AGENT_BUSY",
  "PROVIDER_NOT_AUTOMATION_CAPABLE",
  "EXECUTION_START_FAILED",
  "EXECUTION_NOT_ACTIVE",
  "EXECUTION_TIMED_OUT",
  "EXECUTION_CANCELLED",
  "EXECUTION_INTERRUPTED",
  "EXECUTION_INVALID_RESULT",
  "EXECUTION_AGENT_FAILED",
  "EXECUTION_OUTPUT_LIMIT",
  "EXECUTION_PERSISTENCE_FAILED",
  "EXECUTION_SHUTTING_DOWN",
] as const;
export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[number];
const messages: Record<ExecutionErrorCode, string> = {
  TASK_NOT_ASSIGNED:
    "Assign this task before executing it. Only assigned tasks or work returned from review can execute.",
  TASK_ALREADY_EXECUTING: "This task already has an active execution.",
  AGENT_BUSY: "This agent is executing another task. Wait or cancel that execution.",
  PROVIDER_NOT_AUTOMATION_CAPABLE:
    "This provider supports terminal use only. Choose an execution-capable provider.",
  EXECUTION_START_FAILED:
    "The provider could not execute this task. Check its installation and try again.",
  EXECUTION_NOT_ACTIVE: "This task has no active execution to cancel.",
  EXECUTION_TIMED_OUT: "Execution timed out. The process was stopped; this task can be retried.",
  EXECUTION_CANCELLED:
    "Execution was cancelled. Workspace edits may remain; this task can be retried.",
  EXECUTION_INTERRUPTED:
    "Execution was interrupted by server shutdown or restart. Execute again to retry.",
  EXECUTION_INVALID_RESULT: "The provider returned an invalid result. This task can be retried.",
  EXECUTION_AGENT_FAILED: "The agent reported a failure. Review its result and retry this task.",
  EXECUTION_OUTPUT_LIMIT:
    "Provider output exceeded the allowed size. The process was stopped; this task can be retried.",
  EXECUTION_PERSISTENCE_FAILED:
    "Execution state could not be saved. Check server storage before retrying.",
  EXECUTION_SHUTTING_DOWN: "The server is shutting down and cannot start an execution.",
};
export class ExecutionError extends Error {
  constructor(readonly code: ExecutionErrorCode) {
    super(messages[code]);
  }
}
export const executionErrorMessage = (code: string) =>
  messages[code as ExecutionErrorCode] ??
  "Execution failed. Check provider availability and retry.";
