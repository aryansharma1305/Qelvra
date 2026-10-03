import { z } from "zod";

// WebSocket protocol for browser terminals. Every client message is validated against
// ClientTerminalMessageSchema before the server acts on it. Two endpoints speak it:
//
// - /ws/terminal: a scratch shell owned by the connection. The client sends
//   terminal.create; closing the socket ends the shell.
// - /ws/agents/:agentId/terminal: views a running agent's shell, which the agent owns.
//   The client sends terminal.attach; closing the socket only detaches. Output produced
//   before attaching is not replayed.

/** Largest single terminal.input payload (characters); enough for large pastes. */
export const TERMINAL_MAX_INPUT_LENGTH = 64 * 1024;
/** Largest WebSocket frame the server accepts, in bytes (input JSON plus overhead). */
export const TERMINAL_MAX_MESSAGE_BYTES = 256 * 1024;

/** Server-generated ids: the client can only refer to sessions it was given. */
const SessionIdSchema = z.string().min(1).max(64);
const DimensionSchema = z.number().int();

export const TerminalCreateMessageSchema = z.object({
  type: z.literal("terminal.create"),
  /** Initial size; bounds are enforced by the PTY layer. No command or cwd: the server decides. */
  cols: DimensionSchema.optional(),
  rows: DimensionSchema.optional(),
});

export const TerminalAttachMessageSchema = z.object({
  type: z.literal("terminal.attach"),
  /** The viewer's size; the agent's PTY is resized to it. */
  cols: DimensionSchema.optional(),
  rows: DimensionSchema.optional(),
});

export const TerminalInputMessageSchema = z.object({
  type: z.literal("terminal.input"),
  sessionId: SessionIdSchema,
  data: z.string().min(1).max(TERMINAL_MAX_INPUT_LENGTH),
});

export const TerminalResizeMessageSchema = z.object({
  type: z.literal("terminal.resize"),
  sessionId: SessionIdSchema,
  cols: DimensionSchema,
  rows: DimensionSchema,
});

export const TerminalTerminateMessageSchema = z.object({
  type: z.literal("terminal.terminate"),
  sessionId: SessionIdSchema,
});

export const ClientTerminalMessageSchema = z.discriminatedUnion("type", [
  TerminalCreateMessageSchema,
  TerminalAttachMessageSchema,
  TerminalInputMessageSchema,
  TerminalResizeMessageSchema,
  TerminalTerminateMessageSchema,
]);

export type ClientTerminalMessage = z.infer<typeof ClientTerminalMessageSchema>;

export const TerminalCreatedMessageSchema = z.object({
  type: z.literal("terminal.created"),
  sessionId: SessionIdSchema,
  pid: z.number().int().nullable(),
  shell: z.string(),
  cwd: z.string(),
  cols: z.number().int(),
  rows: z.number().int(),
});

export const TerminalOutputMessageSchema = z.object({
  type: z.literal("terminal.output"),
  sessionId: SessionIdSchema,
  /** Raw terminal data, including ANSI escape sequences. */
  data: z.string(),
});

export const TerminalExitMessageSchema = z.object({
  type: z.literal("terminal.exit"),
  sessionId: SessionIdSchema,
  exitCode: z.number().int(),
  signal: z.number().int().nullable(),
});

export const TERMINAL_ERROR_CODES = {
  /** Not JSON, unknown type, or fields of the wrong shape. */
  TERMINAL_INVALID_MESSAGE: "TERMINAL_INVALID_MESSAGE",
  /** terminal.create while this connection already has a running terminal. */
  TERMINAL_ALREADY_CREATED: "TERMINAL_ALREADY_CREATED",
  /** The session does not exist or belongs to another connection (indistinguishable). */
  TERMINAL_SESSION_NOT_FOUND: "TERMINAL_SESSION_NOT_FOUND",
  TERMINAL_SESSION_NOT_RUNNING: "TERMINAL_SESSION_NOT_RUNNING",
  TERMINAL_INVALID_SIZE: "TERMINAL_INVALID_SIZE",
  TERMINAL_SPAWN_FAILED: "TERMINAL_SPAWN_FAILED",
  /** Agent endpoint: no agent with that id. */
  TERMINAL_AGENT_NOT_FOUND: "TERMINAL_AGENT_NOT_FOUND",
  /** Agent endpoint: the agent exists but has no running shell. Start it first. */
  TERMINAL_AGENT_NOT_RUNNING: "TERMINAL_AGENT_NOT_RUNNING",
  /** Agent endpoint: another viewer attached to this agent; this one was detached. */
  TERMINAL_VIEWER_REPLACED: "TERMINAL_VIEWER_REPLACED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type TerminalErrorCode = (typeof TERMINAL_ERROR_CODES)[keyof typeof TERMINAL_ERROR_CODES];

export const TerminalErrorMessageSchema = z.object({
  type: z.literal("terminal.error"),
  sessionId: SessionIdSchema.optional(),
  code: z.enum(Object.values(TERMINAL_ERROR_CODES) as [TerminalErrorCode, ...TerminalErrorCode[]]),
  message: z.string(),
});

export const ServerTerminalMessageSchema = z.discriminatedUnion("type", [
  TerminalCreatedMessageSchema,
  TerminalOutputMessageSchema,
  TerminalExitMessageSchema,
  TerminalErrorMessageSchema,
]);

export type ServerTerminalMessage = z.infer<typeof ServerTerminalMessageSchema>;
export type TerminalCreatedMessage = z.infer<typeof TerminalCreatedMessageSchema>;
export type TerminalErrorMessage = z.infer<typeof TerminalErrorMessageSchema>;

/** Close code used when the server ends a connection for breaking the protocol. */
export const TERMINAL_CLOSE_POLICY_VIOLATION = 1008;

/** Close codes on the agent terminal endpoint (application range 4000-4999). */
export const AGENT_TERMINAL_CLOSE = {
  /** The agent's shell exited or the agent was stopped. */
  ENDED: 4000,
  /** A newer viewer attached to the same agent. */
  REPLACED: 4001,
  NOT_FOUND: 4004,
  NOT_RUNNING: 4009,
} as const;
