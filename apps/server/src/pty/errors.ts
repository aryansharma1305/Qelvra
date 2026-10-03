export const PTY_ERROR_CODES = {
  PTY_INVALID_ID: "PTY_INVALID_ID",
  PTY_SESSION_EXISTS: "PTY_SESSION_EXISTS",
  PTY_SESSION_NOT_FOUND: "PTY_SESSION_NOT_FOUND",
  PTY_SESSION_NOT_RUNNING: "PTY_SESSION_NOT_RUNNING",
  PTY_SPAWN_FAILED: "PTY_SPAWN_FAILED",
  PTY_INVALID_SIZE: "PTY_INVALID_SIZE",
  PTY_INVALID_CWD: "PTY_INVALID_CWD",
  PTY_INVALID_INPUT: "PTY_INVALID_INPUT",
  PTY_NO_SHELL: "PTY_NO_SHELL",
} as const;

export type PtyErrorCode = (typeof PTY_ERROR_CODES)[keyof typeof PTY_ERROR_CODES];

/**
 * Controlled PTY failure. `message` is safe to show to clients; native/OS details are kept
 * in `cause` for server logs only.
 */
export class PtyError extends Error {
  override name = "PtyError";

  constructor(
    readonly code: PtyErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }
}
