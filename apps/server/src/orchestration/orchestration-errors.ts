export const ORCHESTRATION_ERROR_MESSAGES = {
  ORCHESTRATION_NOT_FOUND: "Goal does not exist.",
  ORCHESTRATION_ALREADY_STARTED: "This goal has already started. Open its current state.",
  ORCHESTRATION_INVALID_PLAN: "The planner returned an invalid plan. Generate a new plan.",
  ORCHESTRATION_NO_AGENT_AVAILABLE:
    "No suitable automation-capable agent is available. Configure an agent for each planned role, then try again.",
  ORCHESTRATION_CANCELLED: "This goal was cancelled.",
  ORCHESTRATION_REVIEW_FAILED:
    "The review or final summary could not be validated. Inspect the task results.",
  ORCHESTRATION_ATTEMPT_LIMIT:
    "The execution attempt limit was reached. Inspect the tasks before starting a new goal.",
  ORCHESTRATION_PROVIDER_UNAVAILABLE:
    "The orchestrator provider cannot execute. Check installation, authentication and automation support.",
  ORCHESTRATION_EXECUTION_FAILED: "A worker execution failed. Inspect the task's controlled error.",
  ORCHESTRATION_TASK_CHANGED:
    "An orchestration task or assigned agent changed unexpectedly. Inspect Mission Control.",
  ORCHESTRATION_TIMED_OUT: "The goal reached its wall-time limit. Active work was cancelled.",
  ORCHESTRATION_PERSISTENCE_FAILED:
    "Goal state could not be saved. Repair server storage before continuing.",
  ORCHESTRATION_TASK_MANAGED:
    "This task is managed by a goal. Cancel the goal before manually changing this task.",
  ORCHESTRATION_SHUTTING_DOWN: "Orchestration is shutting down.",
} as const;
export type OrchestrationErrorCode = keyof typeof ORCHESTRATION_ERROR_MESSAGES;
export class OrchestrationError extends Error {
  constructor(readonly code: OrchestrationErrorCode) {
    super(ORCHESTRATION_ERROR_MESSAGES[code]);
  }
}
