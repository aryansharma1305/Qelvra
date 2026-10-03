export const AGENT_ERROR_CODES = {
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  AGENT_ALREADY_EXISTS: "AGENT_ALREADY_EXISTS",
  AGENT_INVALID_ID: "AGENT_INVALID_ID",
  AGENT_INVALID_NAME: "AGENT_INVALID_NAME",
  AGENT_INVALID_ROLE: "AGENT_INVALID_ROLE",
  /** start on an agent that already has a shell. */
  AGENT_ALREADY_RUNNING: "AGENT_ALREADY_RUNNING",
  /** An operation that needs a running shell (e.g. attaching a terminal). */
  AGENT_NOT_RUNNING: "AGENT_NOT_RUNNING",
  /** The shell could not be spawned; the agent is left in "error". */
  AGENT_START_FAILED: "AGENT_START_FAILED",
  /** The shell could not be confirmed dead; the agent is left in "error". */
  AGENT_STOP_FAILED: "AGENT_STOP_FAILED",
  /** A lifecycle change the state machine does not allow (server-internal). */
  AGENT_INVALID_TRANSITION: "AGENT_INVALID_TRANSITION",
  /** The registry file could not be written; the change was rolled back. */
  AGENT_PERSISTENCE_FAILED: "AGENT_PERSISTENCE_FAILED",
} as const;

export type AgentErrorCode = (typeof AGENT_ERROR_CODES)[keyof typeof AGENT_ERROR_CODES];

/** Controlled registry failure; transport layers map `code` to their own responses. */
export class AgentError extends Error {
  override name = "AgentError";

  constructor(
    readonly code: AgentErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}

/** The registry file exists but cannot be trusted; the server refuses to start. */
export class AgentRegistryLoadError extends Error {
  override name = "AgentRegistryLoadError";
}
