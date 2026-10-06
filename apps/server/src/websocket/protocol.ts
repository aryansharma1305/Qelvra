import {
  API_ERROR_CODES,
  ClientTerminalMessageSchema,
  TERMINAL_CLOSE_POLICY_VIOLATION,
  type ApiErrorResponse,
  type ClientTerminalMessage,
  type TerminalErrorCode,
} from "@qelvra/shared";
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from "fastify";
import type { RawData, WebSocket } from "ws";
import type { PtyErrorCode } from "../pty/index.js";

/**
 * Runs before the upgrade: a reply here refuses the WebSocket handshake. Browsers always
 * send Origin, so a missing or unknown origin is rejected outright.
 */
export function originGuard(allowedOrigins: readonly string[]) {
  const origins = new Set(allowedOrigins);
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    if (!origin || !origins.has(origin)) {
      request.log.warn(
        { errorCode: "WS_ORIGIN_REJECTED" },
        "Rejected WebSocket from disallowed origin",
      );
      const body: ApiErrorResponse = {
        error: { code: API_ERROR_CODES.BAD_REQUEST, message: "Origin not allowed" },
      };
      return reply.code(403).send(body);
    }
  };
}

export type ReadResult =
  | { ok: true; message: ClientTerminalMessage }
  | { ok: false; reason: string }
  /** The connection was closed (binary frame). */
  | { ok: false; reason: null };

/**
 * Parses and validates one client frame. Binary frames close the socket (the protocol is
 * JSON text only, so they mean a broken or hostile client). Never logs frame contents.
 */
export function readClientMessage(
  raw: RawData,
  isBinary: boolean,
  socket: WebSocket,
  log: FastifyBaseLogger,
): ReadResult {
  if (isBinary) {
    log.warn("Closing terminal WebSocket: binary frame received");
    socket.close(TERMINAL_CLOSE_POLICY_VIOLATION, "Binary frames are not supported");
    return { ok: false, reason: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString());
  } catch {
    return { ok: false, reason: "Message is not valid JSON" };
  }
  const result = ClientTerminalMessageSchema.safeParse(parsed);
  return result.success
    ? { ok: true, message: result.data }
    : { ok: false, reason: "Message does not match the terminal protocol" };
}

/** PTY failures as safe protocol codes; anything unexpected becomes INTERNAL_ERROR. */
export const PTY_TO_TERMINAL_CODE: Partial<Record<PtyErrorCode, TerminalErrorCode>> = {
  PTY_SESSION_NOT_FOUND: "TERMINAL_SESSION_NOT_FOUND",
  PTY_SESSION_NOT_RUNNING: "TERMINAL_SESSION_NOT_RUNNING",
  PTY_SESSION_EXISTS: "TERMINAL_ALREADY_CREATED",
  PTY_INVALID_SIZE: "TERMINAL_INVALID_SIZE",
  PTY_INVALID_INPUT: "TERMINAL_INVALID_MESSAGE",
  PTY_SPAWN_FAILED: "TERMINAL_SPAWN_FAILED",
  PTY_NO_SHELL: "TERMINAL_SPAWN_FAILED",
};
