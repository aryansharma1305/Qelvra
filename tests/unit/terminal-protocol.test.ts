import {
  ClientTerminalMessageSchema,
  ServerTerminalMessageSchema,
  TERMINAL_MAX_INPUT_LENGTH,
} from "@qelvra/shared";
import { describe, expect, it } from "vitest";

const valid = (message: unknown) => ClientTerminalMessageSchema.safeParse(message).success;

describe("client terminal messages", () => {
  it("accepts terminal.create with or without a size", () => {
    expect(valid({ type: "terminal.create" })).toBe(true);
    expect(valid({ type: "terminal.create", cols: 120, rows: 32 })).toBe(true);
  });

  it("strips fields the protocol does not define (no command, no cwd)", () => {
    const parsed = ClientTerminalMessageSchema.parse({
      type: "terminal.create",
      shell: "/usr/bin/python3",
      cwd: "/",
    });
    expect(parsed).toEqual({ type: "terminal.create" });
  });

  it("accepts terminal.input up to the size limit, including control characters", () => {
    expect(valid({ type: "terminal.input", sessionId: "term-1", data: "pwd\r" })).toBe(true);
    expect(valid({ type: "terminal.input", sessionId: "term-1", data: "\x03\x1b[A\t" })).toBe(true);
    expect(
      valid({
        type: "terminal.input",
        sessionId: "term-1",
        data: "a".repeat(TERMINAL_MAX_INPUT_LENGTH),
      }),
    ).toBe(true);
  });

  it.each([
    [
      "oversized data",
      { type: "terminal.input", sessionId: "s", data: "a".repeat(TERMINAL_MAX_INPUT_LENGTH + 1) },
    ],
    ["empty data", { type: "terminal.input", sessionId: "s", data: "" }],
    ["non-string data", { type: "terminal.input", sessionId: "s", data: 42 }],
    ["missing sessionId", { type: "terminal.input", data: "ls\r" }],
    ["unknown type", { type: "terminal.exec", command: "rm -rf /" }],
    ["no type", { sessionId: "s", data: "x" }],
    ["fractional size", { type: "terminal.resize", sessionId: "s", cols: 80.5, rows: 24 }],
    ["string size", { type: "terminal.resize", sessionId: "s", cols: "80", rows: 24 }],
    ["missing rows", { type: "terminal.resize", sessionId: "s", cols: 80 }],
    ["oversized sessionId", { type: "terminal.terminate", sessionId: "x".repeat(65) }],
    ["not an object", "terminal.create"],
  ])("rejects %s", (_label, message) => {
    expect(valid(message)).toBe(false);
  });

  it("accepts terminal.resize and terminal.terminate", () => {
    expect(valid({ type: "terminal.resize", sessionId: "s", cols: 120, rows: 32 })).toBe(true);
    expect(valid({ type: "terminal.terminate", sessionId: "s" })).toBe(true);
  });
});

describe("server terminal messages", () => {
  it("parses created, output, exit and error events", () => {
    const messages = [
      {
        type: "terminal.created",
        sessionId: "s",
        pid: 42,
        shell: "/bin/zsh",
        cwd: "/w",
        cols: 120,
        rows: 32,
      },
      { type: "terminal.output", sessionId: "s", data: "\u001b[31mRED\u001b[0m\r\n" },
      { type: "terminal.exit", sessionId: "s", exitCode: 0, signal: null },
      { type: "terminal.exit", sessionId: "s", exitCode: 0, signal: 1 },
      { type: "terminal.error", code: "TERMINAL_INVALID_MESSAGE", message: "bad" },
      {
        type: "terminal.error",
        sessionId: "s",
        code: "TERMINAL_INVALID_SIZE",
        message: "bad size",
      },
    ];
    for (const message of messages)
      expect(ServerTerminalMessageSchema.parse(message)).toEqual(message);
  });

  it("rejects unknown error codes and malformed events", () => {
    expect(
      ServerTerminalMessageSchema.safeParse({
        type: "terminal.error",
        code: "WHATEVER",
        message: "x",
      }).success,
    ).toBe(false);
    expect(
      ServerTerminalMessageSchema.safeParse({ type: "terminal.exit", sessionId: "s" }).success,
    ).toBe(false);
    expect(
      ServerTerminalMessageSchema.safeParse({ type: "terminal.output", sessionId: "s" }).success,
    ).toBe(false);
  });
});
