import { randomUUID } from "node:crypto";
import websocket from "@fastify/websocket";
import {
  TERMINAL_MAX_MESSAGE_BYTES,
  type ClientTerminalMessage,
  type ServerTerminalMessage,
} from "@qelvra/shared";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { RawData, WebSocket } from "ws";
import type { AgentRuntimeManager } from "../agents/index.js";
import { PtyError, type Disposable, type PtyManager } from "../pty/index.js";
import { registerAgentTerminalRoute } from "./agent-terminal-gateway.js";
import { PTY_TO_TERMINAL_CODE, originGuard, readClientMessage } from "./protocol.js";

export const TERMINAL_WS_PATH = "/ws/terminal";

export interface TerminalGatewayOptions {
  pty: PtyManager;
  /** Serves /ws/agents/:agentId/terminal (see agent-terminal-gateway.ts). */
  runtime: AgentRuntimeManager;
  /** Browser origins allowed to open a terminal (exact match, from WEB_ORIGIN). */
  allowedOrigins: readonly string[];
}

/**
 * Bridges browser WebSockets to PtyManager. Transport concerns (origin, framing,
 * validation, ownership) live here; process concerns stay in PtyManager.
 */
export async function registerTerminalGateway(
  app: FastifyInstance,
  { pty, runtime, allowedOrigins }: TerminalGatewayOptions,
): Promise<void> {
  await app.register(websocket, { options: { maxPayload: TERMINAL_MAX_MESSAGE_BYTES } });

  app.get(
    TERMINAL_WS_PATH,
    {
      websocket: true,
      preValidation: originGuard(allowedOrigins),
    },
    (socket, request) => {
      const connectionId = randomUUID().slice(0, 8);
      new TerminalConnection(socket, pty, request.log.child({ connectionId }));
    },
  );
  registerAgentTerminalRoute(app, { runtime, allowedOrigins });
}

interface OwnedSession {
  id: string;
  subscriptions: Disposable[];
}

/** One browser connection; owns at most one live PTY session at a time. */
class TerminalConnection {
  private session: OwnedSession | null = null;
  private closed = false;

  constructor(
    private readonly socket: WebSocket,
    private readonly pty: PtyManager,
    private readonly log: FastifyBaseLogger,
  ) {
    this.log.info("Terminal WebSocket opened");
    socket.on("message", (raw, isBinary) => this.onMessage(raw, isBinary));
    socket.on("close", (code) => this.onClose(code));
    socket.on("error", (error) => this.log.warn({ err: error }, "Terminal WebSocket error"));
  }

  private onMessage(raw: RawData, isBinary: boolean): void {
    const read = readClientMessage(raw, isBinary, this.socket, this.log);
    if (!read.ok) {
      if (read.reason) this.protocolError(read.reason);
      return;
    }
    try {
      this.dispatch(read.message);
    } catch (error) {
      this.reportError(error, "sessionId" in read.message ? read.message.sessionId : undefined);
    }
  }

  private dispatch(message: ClientTerminalMessage): void {
    switch (message.type) {
      case "terminal.create":
        this.create(message.cols, message.rows);
        return;
      case "terminal.attach":
        this.protocolError("terminal.attach is only valid on an agent terminal");
        return;
      case "terminal.input":
        this.pty.write(this.owned(message.sessionId), message.data);
        return;
      case "terminal.resize":
        this.pty.resize(this.owned(message.sessionId), message.cols, message.rows);
        return;
      case "terminal.terminate": {
        const id = this.owned(message.sessionId);
        // The exit listener reports terminal.exit once the process tree is gone.
        this.pty.terminate(id).catch((error: unknown) => this.reportError(error, id));
        return;
      }
    }
  }

  private create(cols: number | undefined, rows: number | undefined): void {
    if (this.session && this.pty.has(this.session.id)) {
      this.send({
        type: "terminal.error",
        sessionId: this.session.id,
        code: "TERMINAL_ALREADY_CREATED",
        message: "This connection already has a running terminal",
      });
      return;
    }

    const id = `term-${randomUUID()}`.slice(0, 32);
    const info = this.pty.createSession({
      id,
      ...(cols === undefined ? {} : { cols }),
      ...(rows === undefined ? {} : { rows }),
    });
    const session: OwnedSession = { id, subscriptions: [] };
    this.session = session;
    session.subscriptions.push(
      this.pty.onData(id, (data) => this.send({ type: "terminal.output", sessionId: id, data })),
      this.pty.onExit(id, (exit) => {
        this.log.info({ sessionId: id, ...exit }, "Terminal session exited");
        this.send({ type: "terminal.exit", sessionId: id, ...exit });
        if (this.session === session) this.session = null;
      }),
    );

    this.log.info({ sessionId: id, pid: info.pid, shell: info.shell }, "Terminal session created");
    this.send({
      type: "terminal.created",
      sessionId: id,
      pid: info.pid,
      shell: info.shell,
      cwd: info.cwd,
      cols: info.cols,
      rows: info.rows,
    });
  }

  /**
   * Returns the session id if this connection owns it. Unknown and foreign ids get the
   * same error, so a client cannot probe other connections' sessions.
   */
  private owned(sessionId: string): string {
    if (!this.session || this.session.id !== sessionId) {
      throw new PtyError("PTY_SESSION_NOT_FOUND", "Terminal session not found");
    }
    return sessionId;
  }

  private onClose(code: number): void {
    this.closed = true;
    const session = this.session;
    this.session = null;
    this.log.info({ code }, "Terminal WebSocket closed");
    if (!session) return;
    for (const subscription of session.subscriptions) subscription.dispose();
    // A browser terminal lives only as long as its connection.
    this.pty
      .terminate(session.id)
      .catch((error: unknown) =>
        this.log.error({ err: error, sessionId: session.id }, "Failed to terminate PTY on close"),
      );
  }

  private protocolError(message: string): void {
    this.log.warn({ reason: message }, "Terminal protocol error");
    this.send({ type: "terminal.error", code: "TERMINAL_INVALID_MESSAGE", message });
  }

  private reportError(error: unknown, sessionId: string | undefined): void {
    const code = error instanceof PtyError ? PTY_TO_TERMINAL_CODE[error.code] : undefined;
    if (error instanceof PtyError && code) {
      this.send({
        type: "terminal.error",
        ...(sessionId ? { sessionId } : {}),
        code,
        message: error.message,
      });
      return;
    }
    this.log.error({ err: error, sessionId }, "Unexpected terminal gateway error");
    this.send({
      type: "terminal.error",
      ...(sessionId ? { sessionId } : {}),
      code: "INTERNAL_ERROR",
      message: "Internal server error",
    });
  }

  private send(message: ServerTerminalMessage): void {
    if (this.closed || this.socket.readyState !== this.socket.OPEN) return;
    this.socket.send(JSON.stringify(message));
  }
}
