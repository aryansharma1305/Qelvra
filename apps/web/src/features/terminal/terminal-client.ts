import {
  ServerTerminalMessageSchema,
  TERMINAL_MAX_INPUT_LENGTH,
  type ClientTerminalMessage,
  type TerminalCreatedMessage,
  type TerminalErrorMessage,
} from "@qelvra/shared";

export type TerminalConnectionState =
  "connecting" | "creating" | "connected" | "exited" | "disconnected" | "error";

export interface TerminalExitInfo {
  exitCode: number;
  signal: number | null;
}

export interface TerminalConnectionHandlers {
  onState(state: TerminalConnectionState): void;
  onCreated(session: TerminalCreatedMessage): void;
  onOutput(data: string): void;
  onExit(exit: TerminalExitInfo): void;
  onError(error: TerminalErrorMessage): void;
}

type SocketFactory = (url: string) => WebSocket;

/**
 * One browser terminal over the terminal protocol. Input is only sent once the server
 * confirms the PTY (socket open is not PTY ready); a closed connection is never reused.
 *
 * - "create" (/ws/terminal): the connection owns a new scratch shell; closing it ends
 *   the shell, and reconnecting means a new shell.
 * - "attach" (/ws/agents/:id/terminal): views a running agent's shell; closing only
 *   detaches, and reconnecting reattaches to the same shell.
 */
export class TerminalConnection {
  private socket: WebSocket | null = null;
  private sessionId: string | null = null;
  private state: TerminalConnectionState = "connecting";
  private disposed = false;

  constructor(
    private readonly url: string,
    private readonly handlers: TerminalConnectionHandlers,
    private readonly createSocket: SocketFactory = (target) => new WebSocket(target),
  ) {}

  get currentState(): TerminalConnectionState {
    return this.state;
  }

  start(size: { cols: number; rows: number }, mode: "create" | "attach" = "create"): void {
    if (this.socket || this.disposed) return;
    this.setState("connecting");
    const socket = this.createSocket(this.url);
    this.socket = socket;

    socket.onopen = () => {
      this.setState("creating");
      this.send({
        type: mode === "attach" ? "terminal.attach" : "terminal.create",
        cols: size.cols,
        rows: size.rows,
      });
    };
    socket.onmessage = (event: MessageEvent) => this.onMessage(event.data);
    socket.onclose = () => {
      if (this.disposed) return;
      this.sessionId = null;
      if (this.state !== "exited" && this.state !== "error") this.setState("disconnected");
    };
    // Errors are followed by close; the state change there is what the UI shows.
    socket.onerror = () => {};
  }

  /** Raw terminal input from xterm. Large pastes are split to the protocol's limit. */
  sendInput(data: string): void {
    const sessionId = this.sessionId;
    if (!sessionId || this.state !== "connected" || data.length === 0) return;
    for (let offset = 0; offset < data.length; offset += TERMINAL_MAX_INPUT_LENGTH) {
      this.send({
        type: "terminal.input",
        sessionId,
        data: data.slice(offset, offset + TERMINAL_MAX_INPUT_LENGTH),
      });
    }
  }

  resize(cols: number, rows: number): void {
    if (!this.sessionId || this.state !== "connected") return;
    this.send({ type: "terminal.resize", sessionId: this.sessionId, cols, rows });
  }

  /** Closes the socket: ends a scratch shell, or detaches from an agent's shell. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const socket = this.socket;
    this.socket = null;
    if (!socket) return;
    socket.onopen = socket.onmessage = socket.onclose = socket.onerror = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      socket.close(1000, "terminal closed");
    }
  }

  private onMessage(raw: unknown): void {
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const result = ServerTerminalMessageSchema.safeParse(parsed);
    if (!result.success) return;
    const message = result.data;

    switch (message.type) {
      case "terminal.created":
        this.sessionId = message.sessionId;
        this.handlers.onCreated(message);
        this.setState("connected");
        return;
      case "terminal.output":
        if (message.sessionId === this.sessionId) this.handlers.onOutput(message.data);
        return;
      case "terminal.exit":
        if (message.sessionId !== this.sessionId) return;
        this.sessionId = null;
        this.setState("exited");
        this.handlers.onExit({ exitCode: message.exitCode, signal: message.signal });
        return;
      case "terminal.error":
        this.handlers.onError(message);
        // Without a session (e.g. the shell failed to start) there is nothing to drive.
        if (!this.sessionId) this.setState("error");
        return;
    }
  }

  private send(message: ClientTerminalMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }

  private setState(state: TerminalConnectionState): void {
    if (this.state === state && state !== "connecting") return;
    this.state = state;
    if (!this.disposed) this.handlers.onState(state);
  }
}
