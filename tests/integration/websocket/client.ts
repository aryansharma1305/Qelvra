import {
  ServerTerminalMessageSchema,
  type ClientTerminalMessage,
  type ServerTerminalMessage,
} from "@qelvra/shared";
import WebSocket from "ws";

/** Minimal protocol client for tests: records every server message and waits on events. */
export class TestTerminalClient {
  readonly messages: ServerTerminalMessage[] = [];
  private waiters: (() => void)[] = [];
  closeCode: number | null = null;

  private constructor(readonly socket: WebSocket) {
    socket.on("message", (raw) => {
      // Server messages are validated too: a malformed one fails the test here.
      this.messages.push(ServerTerminalMessageSchema.parse(JSON.parse(raw.toString())));
      this.wake();
    });
    socket.on("close", (code) => {
      this.closeCode = code;
      this.wake();
    });
  }

  static connect(url: string, origin: string | undefined): Promise<TestTerminalClient> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url, origin ? { headers: { origin } } : {});
      socket.once("open", () => resolve(new TestTerminalClient(socket)));
      socket.once("unexpected-response", (_req, res) =>
        reject(new Error(`handshake rejected with HTTP ${res.statusCode}`)),
      );
      socket.once("error", reject);
    });
  }

  send(message: ClientTerminalMessage | Record<string, unknown>): void {
    this.socket.send(JSON.stringify(message));
  }

  sendRaw(data: string | Buffer, binary = false): void {
    this.socket.send(data, { binary });
  }

  /** Concatenated terminal.output data for a session, ANSI removed. */
  output(sessionId: string): string {
    return (
      this.messages
        .filter((m) => m.type === "terminal.output" && m.sessionId === sessionId)
        .map((m) => (m.type === "terminal.output" ? m.data : ""))
        .join("")
        // eslint-disable-next-line no-control-regex
        .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    );
  }

  outputLines(sessionId: string): string[] {
    return this.output(sessionId)
      .split(/\r?\n/)
      .map((line) => line.replace(/\r/g, ""));
  }

  async next<T extends ServerTerminalMessage["type"]>(
    type: T,
    timeoutMs = 5_000,
  ): Promise<Extract<ServerTerminalMessage, { type: T }>> {
    const from = this.messages.length;
    const match = () =>
      this.messages.slice(from).find((m) => m.type === type) as
        Extract<ServerTerminalMessage, { type: T }> | undefined;
    await this.until(() => match() !== undefined, `message ${type}`, timeoutMs);
    return match() as Extract<ServerTerminalMessage, { type: T }>;
  }

  /** Like next(), but also matches a message that already arrived. */
  async received<T extends ServerTerminalMessage["type"]>(
    type: T,
    timeoutMs = 5_000,
  ): Promise<Extract<ServerTerminalMessage, { type: T }>> {
    const match = () =>
      this.messages.find((m) => m.type === type) as
        Extract<ServerTerminalMessage, { type: T }> | undefined;
    await this.until(() => match() !== undefined, `message ${type}`, timeoutMs);
    return match() as Extract<ServerTerminalMessage, { type: T }>;
  }

  waitForLine(sessionId: string, line: string, timeoutMs = 5_000): Promise<void> {
    return this.until(() => this.outputLines(sessionId).includes(line), `line ${line}`, timeoutMs);
  }

  waitForClose(timeoutMs = 5_000): Promise<number> {
    return this.until(() => this.closeCode !== null, "close", timeoutMs).then(
      () => this.closeCode as number,
    );
  }

  until(predicate: () => boolean, what: string, timeoutMs: number): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== check);
        reject(new Error(`Timed out waiting for ${what}`));
      }, timeoutMs);
      const check = () => {
        if (!predicate()) return;
        clearTimeout(timer);
        this.waiters = this.waiters.filter((w) => w !== check);
        resolve();
      };
      this.waiters.push(check);
    });
  }

  close(): Promise<number> {
    if (this.closeCode !== null) return Promise.resolve(this.closeCode);
    this.socket.close();
    return this.waitForClose();
  }

  private wake(): void {
    for (const waiter of [...this.waiters]) waiter();
  }
}
