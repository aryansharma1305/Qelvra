import { TERMINAL_MAX_INPUT_LENGTH, type ClientTerminalMessage } from "@qelvra/shared";
import { beforeAll, describe, expect, it } from "vitest";
import {
  TerminalConnection,
  type TerminalConnectionHandlers,
  type TerminalConnectionState,
} from "../../apps/web/src/features/terminal/terminal-client";
import { terminalSocketUrl, toWebSocketUrl } from "../../apps/web/src/lib/ws";

describe("WebSocket URL configuration", () => {
  it.each([
    ["http://127.0.0.1:3001", "ws://127.0.0.1:3001/ws/terminal"],
    ["http://127.0.0.1:3001/", "ws://127.0.0.1:3001/ws/terminal"],
    ["https://hive.example", "wss://hive.example/ws/terminal"],
  ])("maps %s to %s", (base, expected) => {
    expect(toWebSocketUrl(base, "/ws/terminal")).toBe(expected);
  });

  it("rejects non-http bases", () => {
    expect(() => toWebSocketUrl("ftp://host", "/ws/terminal")).toThrow(/Unsupported/);
  });

  it("derives the terminal endpoint from the API base URL", () => {
    expect(terminalSocketUrl("http://127.0.0.1:3001")).toBe("ws://127.0.0.1:3001/ws/terminal");
  });
});

// Node has no browser WebSocket constants in every version; the client only reads these.
beforeAll(() => {
  const ws = globalThis as unknown as { WebSocket?: { CONNECTING: number; OPEN: number } };
  ws.WebSocket ??= { CONNECTING: 0, OPEN: 1 };
});

class FakeSocket {
  readyState = 0;
  sent: ClientTerminalMessage[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send(data: string) {
    this.sent.push(JSON.parse(data) as ClientTerminalMessage);
  }
  close(code: number) {
    this.closedWith = code;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

function setup() {
  const socket = new FakeSocket();
  const states: TerminalConnectionState[] = [];
  const output: string[] = [];
  const errors: string[] = [];
  const handlers: TerminalConnectionHandlers = {
    onState: (state) => states.push(state),
    onCreated: () => {},
    onOutput: (data) => output.push(data),
    onExit: () => {},
    onError: (error) => errors.push(error.code),
  };
  const connection = new TerminalConnection(
    "ws://test/ws/terminal",
    handlers,
    () => socket as unknown as WebSocket,
  );
  return { socket, states, output, errors, connection };
}

const created = {
  type: "terminal.created",
  sessionId: "term-1",
  pid: 42,
  shell: "/bin/zsh",
  cwd: "/w",
  cols: 80,
  rows: 24,
};

describe("TerminalConnection", () => {
  it("requests a PTY only after the socket opens and accepts input only once created", () => {
    const { socket, states, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    connection.sendInput("too early\r");
    expect(socket.sent).toEqual([]);

    socket.open();
    expect(socket.sent).toEqual([{ type: "terminal.create", cols: 80, rows: 24 }]);
    connection.sendInput("still too early\r");
    expect(socket.sent).toHaveLength(1);

    socket.receive(created);
    connection.sendInput("pwd\r");
    connection.resize(100, 30);
    expect(socket.sent.slice(1)).toEqual([
      { type: "terminal.input", sessionId: "term-1", data: "pwd\r" },
      { type: "terminal.resize", sessionId: "term-1", cols: 100, rows: 30 },
    ]);
    expect(states).toEqual(["connecting", "creating", "connected"]);
  });

  it("splits large pastes at the protocol limit", () => {
    const { socket, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    socket.open();
    socket.receive(created);
    connection.sendInput("x".repeat(TERMINAL_MAX_INPUT_LENGTH * 2 + 5));
    const chunks = socket.sent.filter((m) => m.type === "terminal.input");
    expect(chunks.map((m) => (m.type === "terminal.input" ? m.data.length : 0))).toEqual([
      TERMINAL_MAX_INPUT_LENGTH,
      TERMINAL_MAX_INPUT_LENGTH,
      5,
    ]);
  });

  it("delivers only its own session's output and ignores malformed messages", () => {
    const { socket, output, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    socket.open();
    socket.receive(created);
    socket.receive({
      type: "terminal.output",
      sessionId: "term-1",
      data: "\u001b[31mRED\u001b[0m",
    });
    socket.receive({ type: "terminal.output", sessionId: "term-other", data: "nope" });
    socket.receive({ type: "terminal.output" });
    socket.onmessage?.({ data: "{not json" });
    expect(output).toEqual(["\u001b[31mRED\u001b[0m"]);
  });

  it("stops input after exit and reports disconnects", () => {
    const { socket, states, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    socket.open();
    socket.receive(created);
    socket.receive({ type: "terminal.exit", sessionId: "term-1", exitCode: 0, signal: null });
    connection.sendInput("ls\r");
    expect(socket.sent.filter((m) => m.type === "terminal.input")).toEqual([]);
    expect(states.at(-1)).toBe("exited");

    const second = setup();
    second.connection.start({ cols: 80, rows: 24 });
    second.socket.open();
    second.socket.receive(created);
    second.socket.drop();
    expect(second.states.at(-1)).toBe("disconnected");
  });

  it("enters the error state when the PTY cannot be created", () => {
    const { socket, states, errors, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    socket.open();
    socket.receive({ type: "terminal.error", code: "TERMINAL_SPAWN_FAILED", message: "no shell" });
    expect(errors).toEqual(["TERMINAL_SPAWN_FAILED"]);
    expect(states.at(-1)).toBe("error");
  });

  it("dispose closes the socket and silences further events", () => {
    const { socket, states, connection } = setup();
    connection.start({ cols: 80, rows: 24 });
    socket.open();
    socket.receive(created);
    const before = states.length;
    connection.dispose();
    connection.dispose();
    expect(socket.closedWith).toBe(1000);
    socket.onclose?.();
    expect(states).toHaveLength(before);
  });
});
