import { randomUUID } from "node:crypto";
import {
  AGENT_TERMINAL_CLOSE,
  AgentIdSchema,
  type ClientTerminalMessage,
  type ServerTerminalMessage,
  type TerminalErrorCode,
} from "@qelvra/shared";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { RawData, WebSocket } from "ws";
import {
  AgentError,
  type AgentRuntimeManager,
  type AgentTerminalAttachment,
} from "../agents/index.js";
import { PtyError } from "../pty/index.js";
import { PTY_TO_TERMINAL_CODE, originGuard, readClientMessage } from "./protocol.js";

export const AGENT_TERMINAL_WS_PATH = "/ws/agents/:agentId/terminal";

export interface AgentTerminalRouteOptions {
  runtime: AgentRuntimeManager;
  allowedOrigins: readonly string[];
}

/**
 * A browser view onto a running agent's shell. Unlike /ws/terminal, the connection does
 * not own the process: the agent does. Closing the socket only detaches the viewer; the
 * shell is stopped through the lifecycle API. Same origin check, framing and validation
 * as the scratch terminal.
 */
export function registerAgentTerminalRoute(
  app: FastifyInstance,
  { runtime, allowedOrigins }: AgentTerminalRouteOptions,
): void {
  app.get<{ Params: { agentId: string } }>(
    AGENT_TERMINAL_WS_PATH,
    { websocket: true, preValidation: originGuard(allowedOrigins) },
    (socket, request) => {
      const connectionId = randomUUID().slice(0, 8);
      new AgentTerminalConnection(
        socket,
        runtime,
        request.params.agentId,
        request.log.child({ connectionId }),
      );
    },
  );
}

class AgentTerminalConnection {
  private attachment: AgentTerminalAttachment | null = null;
  private closed = false;
  /** The validated agent id; null if the path held an unsafe id. */
  private readonly agentId: string | null;

  constructor(
    private readonly socket: WebSocket,
    private readonly runtime: AgentRuntimeManager,
    rawAgentId: string,
    private readonly log: FastifyBaseLogger,
  ) {
    const parsed = AgentIdSchema.safeParse(rawAgentId);
    this.agentId = parsed.success ? parsed.data : null;
    socket.on("message", (raw, isBinary) => this.onMessage(raw, isBinary));
    socket.on("close", (code) => this.onClose(code));
    socket.on("error", (error) => this.log.warn({ err: error }, "Agent terminal WebSocket error"));

    if (!this.agentId) {
      // Unsafe ids are indistinguishable from unknown ones.
      this.end("TERMINAL_AGENT_NOT_FOUND", "Agent not found", AGENT_TERMINAL_CLOSE.NOT_FOUND);
      return;
    }
    this.log.info({ agentId: this.agentId }, "Agent terminal WebSocket opened");
  }

  private onMessage(raw: RawData, isBinary: boolean): void {
    const read = readClientMessage(raw, isBinary, this.socket, this.log);
    if (!read.ok) {
      if (read.reason) this.error("TERMINAL_INVALID_MESSAGE", read.reason);
      return;
    }
    try {
      this.dispatch(read.message);
    } catch (error) {
      this.reportError(error);
    }
  }

  private dispatch(message: ClientTerminalMessage): void {
    switch (message.type) {
      case "terminal.attach":
        this.attach(message.cols, message.rows);
        return;
      case "terminal.input":
        this.owned(message.sessionId).write(message.data);
        return;
      case "terminal.resize":
        this.owned(message.sessionId).resize(message.cols, message.rows);
        return;
      case "terminal.create":
      case "terminal.terminate":
        // The agent owns its shell: start and stop go through the lifecycle API.
        this.error("TERMINAL_INVALID_MESSAGE", `${message.type} is not valid on an agent terminal`);
        return;
    }
  }

  private attach(cols: number | undefined, rows: number | undefined): void {
    const agentId = this.agentId;
    if (!agentId || this.closed) return;
    if (this.attachment) {
      this.error("TERMINAL_ALREADY_CREATED", "This connection is already attached", agentId);
      return;
    }
    const size = cols !== undefined && rows !== undefined ? { cols, rows } : undefined;
    try {
      this.attachment = this.runtime.attach(
        agentId,
        {
          onData: (data) => this.send({ type: "terminal.output", sessionId: agentId, data }),
          onExit: (exit) => {
            this.attachment = null;
            this.send({ type: "terminal.exit", sessionId: agentId, ...exit });
            this.close(AGENT_TERMINAL_CLOSE.ENDED, "Agent terminal ended");
          },
          onReplaced: () => {
            this.attachment = null;
            this.end(
              "TERMINAL_VIEWER_REPLACED",
              "This agent's terminal was opened somewhere else",
              AGENT_TERMINAL_CLOSE.REPLACED,
            );
          },
        },
        size,
      );
    } catch (error) {
      if (error instanceof AgentError && error.code === "AGENT_NOT_FOUND") {
        this.end("TERMINAL_AGENT_NOT_FOUND", "Agent not found", AGENT_TERMINAL_CLOSE.NOT_FOUND);
      } else if (error instanceof AgentError && error.code === "AGENT_NOT_RUNNING") {
        this.end(
          "TERMINAL_AGENT_NOT_RUNNING",
          "Agent is not running. Start it first.",
          AGENT_TERMINAL_CLOSE.NOT_RUNNING,
        );
      } else {
        this.reportError(error);
      }
      return;
    }

    const { session } = this.attachment;
    this.log.info({ agentId, pid: session.pid }, "Agent terminal attached");
    // Output produced before this point is not replayed (no backend scrollback).
    this.send({
      type: "terminal.created",
      sessionId: agentId,
      pid: session.pid,
      shell: session.shell,
      cwd: session.cwd,
      cols: session.cols,
      rows: session.rows,
    });
  }

  /** The attachment, if `sessionId` names this connection's agent. */
  private owned(sessionId: string): AgentTerminalAttachment {
    if (!this.attachment || sessionId !== this.agentId) {
      throw new PtyError("PTY_SESSION_NOT_FOUND", "Terminal session not found");
    }
    return this.attachment;
  }

  private onClose(code: number): void {
    this.closed = true;
    // Detach only: the agent keeps running without a viewer.
    this.attachment?.detach();
    this.attachment = null;
    this.log.info({ code, agentId: this.agentId }, "Agent terminal WebSocket closed");
  }

  private reportError(error: unknown): void {
    const sessionId = this.agentId ?? undefined;
    if (error instanceof PtyError && PTY_TO_TERMINAL_CODE[error.code]) {
      this.error(PTY_TO_TERMINAL_CODE[error.code] as TerminalErrorCode, error.message, sessionId);
      return;
    }
    if (error instanceof AgentError && error.code === "AGENT_NOT_RUNNING") {
      this.error("TERMINAL_SESSION_NOT_RUNNING", "Agent is not running", sessionId);
      return;
    }
    this.log.error({ err: error, agentId: this.agentId }, "Unexpected agent terminal error");
    this.error("INTERNAL_ERROR", "Internal server error", sessionId);
  }

  private error(code: TerminalErrorCode, message: string, sessionId?: string): void {
    if (code === "TERMINAL_INVALID_MESSAGE") {
      this.log.warn({ reason: message }, "Agent terminal protocol error");
    }
    this.send({ type: "terminal.error", ...(sessionId ? { sessionId } : {}), code, message });
  }

  /** Reports a final error, then closes with an application close code. */
  private end(code: TerminalErrorCode, message: string, closeCode: number): void {
    this.error(code, message, this.agentId ?? undefined);
    this.close(closeCode, message);
  }

  private close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = true;
    this.socket.close(code, reason);
  }

  private send(message: ServerTerminalMessage): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }
}
