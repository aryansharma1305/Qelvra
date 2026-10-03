import { TERMINAL_MAX_INPUT_LENGTH, TERMINAL_MAX_MESSAGE_BYTES } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as joinPath } from "node:path";

/** Never touch a real registry file from tests. */
const TEST_DATA_DIR = mkdtempSync(joinPath(tmpdir(), "qelvra-test-data-"));
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import type { PtyManager } from "../../../apps/server/src/pty/index";
import {
  cleanupManagers,
  createTestManager,
  isAlive,
  leakedPids,
  uniqueMarker,
  waitForExit,
} from "../pty/helpers";
import { TestTerminalClient } from "./client";

// The real gateway on a loopback port, a real ws client and the real PtyManager.

const ORIGIN = "http://127.0.0.1:5173";
let app: FastifyInstance;
let pty: PtyManager;
let url: string;
const clients: TestTerminalClient[] = [];

async function connect(origin: string | undefined = ORIGIN): Promise<TestTerminalClient> {
  const client = await TestTerminalClient.connect(url, origin);
  clients.push(client);
  return client;
}

async function createTerminal(client: TestTerminalClient) {
  client.send({ type: "terminal.create", cols: 100, rows: 30 });
  return client.next("terminal.created");
}

beforeEach(async () => {
  pty = createTestManager();
  app = await createApp(loadConfig({ WEB_ORIGIN: ORIGIN, DATA_DIR: TEST_DATA_DIR }), {
    logger: false,
    ptyManager: pty,
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  url = `ws://127.0.0.1:${address.port}/ws/terminal`;
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close().catch(() => undefined)));
  await app.close();
  await cleanupManagers();
});

afterAll(() => {
  rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  expect(leakedPids(), "PTY processes left running").toEqual([]);
});

describe("terminal session over WebSocket", () => {
  it("creates a shell, round-trips input and output, and terminates", async () => {
    const client = await connect();
    const created = await createTerminal(client);
    expect(created).toMatchObject({ cols: 100, rows: 30, shell: expect.any(String) });
    expect(created.sessionId).toMatch(/^term-/);
    expect(pty.size).toBe(1);

    client.send({
      type: "terminal.input",
      sessionId: created.sessionId,
      data: "echo QELVRA_WS_TEST\r",
    });
    // Line-exact: the echoed command line "echo QELVRA_WS_TEST" is not the output.
    await client.waitForLine(created.sessionId, "QELVRA_WS_TEST");

    client.send({ type: "terminal.terminate", sessionId: created.sessionId });
    const exit = await client.next("terminal.exit");
    expect(exit.sessionId).toBe(created.sessionId);
    expect(pty.size).toBe(0);
    expect(isAlive(created.pid ?? -1)).toBe(false);
  });

  it("passes ANSI sequences through untouched", async () => {
    const client = await connect();
    const { sessionId } = await createTerminal(client);
    client.send({ type: "terminal.input", sessionId, data: "printf '\\033[31mRED\\033[0m\\n'\r" });
    await client.until(
      () =>
        client.messages.some(
          (m) => m.type === "terminal.output" && m.data.includes("\u001b[31mRED\u001b[0m"),
        ),
      "raw colour sequence",
      5_000,
    );
  });

  it("applies resizes and reports invalid sizes", async () => {
    const client = await connect();
    const { sessionId } = await createTerminal(client);

    client.send({ type: "terminal.resize", sessionId, cols: 0, rows: 24 });
    expect(await client.next("terminal.error")).toMatchObject({
      code: "TERMINAL_INVALID_SIZE",
      sessionId,
    });

    client.send({ type: "terminal.resize", sessionId, cols: 90, rows: 25 });
    client.send({ type: "terminal.input", sessionId, data: "stty size\r" });
    await client.waitForLine(sessionId, "25 90");
  });

  it("lets the client start a new terminal after the shell exits", async () => {
    const client = await connect();
    const first = await createTerminal(client);
    client.send({ type: "terminal.input", sessionId: first.sessionId, data: "exit 4\r" });
    expect(await client.next("terminal.exit")).toMatchObject({
      sessionId: first.sessionId,
      exitCode: 4,
    });

    client.send({ type: "terminal.input", sessionId: first.sessionId, data: "ls\r" });
    expect(await client.next("terminal.error")).toMatchObject({
      code: "TERMINAL_SESSION_NOT_FOUND",
    });

    const second = await createTerminal(client);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(pty.size).toBe(1);
  });
});

describe("protocol validation", () => {
  it.each([
    ["not JSON", "{oops"],
    ["unknown type", JSON.stringify({ type: "terminal.exec", command: "/bin/rm" })],
    ["missing fields", JSON.stringify({ type: "terminal.input" })],
    [
      "wrong field types",
      JSON.stringify({ type: "terminal.resize", sessionId: "x", cols: "80", rows: 24 }),
    ],
    [
      "oversized input",
      JSON.stringify({
        type: "terminal.input",
        sessionId: "x",
        data: "a".repeat(TERMINAL_MAX_INPUT_LENGTH + 1),
      }),
    ],
  ])("answers %s with TERMINAL_INVALID_MESSAGE and keeps the connection", async (_label, raw) => {
    const client = await connect();
    client.sendRaw(raw);
    expect(await client.next("terminal.error")).toMatchObject({ code: "TERMINAL_INVALID_MESSAGE" });
    expect(pty.size).toBe(0);

    await createTerminal(client); // still usable
  });

  it("does not let the client choose the program or working directory", async () => {
    const client = await connect();
    client.send({ type: "terminal.create", shell: "/usr/bin/python3", cwd: "/" });
    const created = await client.next("terminal.created");
    expect(created.shell).not.toContain("python");
    expect(created.cwd).toBe(pty.workspaceRoot);
  });

  it("rejects input before a terminal exists", async () => {
    const client = await connect();
    client.send({ type: "terminal.input", sessionId: "term-anything", data: "ls\r" });
    expect(await client.next("terminal.error")).toMatchObject({
      code: "TERMINAL_SESSION_NOT_FOUND",
    });
  });

  it("rejects a second create while a terminal is running", async () => {
    const client = await connect();
    const { sessionId } = await createTerminal(client);
    client.send({ type: "terminal.create" });
    expect(await client.next("terminal.error")).toMatchObject({
      code: "TERMINAL_ALREADY_CREATED",
      sessionId,
    });
    expect(pty.size).toBe(1);
  });

  it("closes the connection on binary frames and cleans up its PTY", async () => {
    const client = await connect();
    const { sessionId } = await createTerminal(client);
    const exited = waitForExit(pty, sessionId);
    client.sendRaw(Buffer.from([1, 2, 3]), true);
    expect(await client.waitForClose()).toBe(1008);
    await exited;
    expect(pty.size).toBe(0);
  });

  it("closes the connection when a frame exceeds the size limit", async () => {
    const client = await connect();
    const { sessionId } = await createTerminal(client);
    const exited = waitForExit(pty, sessionId);
    client.sendRaw("x".repeat(TERMINAL_MAX_MESSAGE_BYTES + 1));
    expect(await client.waitForClose()).toBe(1009);
    await exited;
    expect(pty.size).toBe(0);
  });
});

describe("ownership and isolation", () => {
  it("keeps two connections' terminals isolated", async () => {
    const a = await connect();
    const b = await connect();
    const sessionA = (await createTerminal(a)).sessionId;
    const sessionB = (await createTerminal(b)).sessionId;
    const markerA = uniqueMarker("SOCKET_A");
    const markerB = uniqueMarker("SOCKET_B");

    a.send({ type: "terminal.input", sessionId: sessionA, data: `echo ${markerA}\r` });
    b.send({ type: "terminal.input", sessionId: sessionB, data: `echo ${markerB}\r` });
    await Promise.all([a.waitForLine(sessionA, markerA), b.waitForLine(sessionB, markerB)]);

    expect(JSON.stringify(a.messages)).not.toContain(markerB);
    expect(JSON.stringify(b.messages)).not.toContain(markerA);
    expect(a.messages.some((m) => "sessionId" in m && m.sessionId === sessionB)).toBe(false);
  });

  it("refuses to touch another connection's session", async () => {
    const owner = await connect();
    const intruder = await connect();
    const { sessionId } = await createTerminal(owner);

    for (const message of [
      { type: "terminal.input", sessionId, data: "exit\r" },
      { type: "terminal.resize", sessionId, cols: 10, rows: 10 },
      { type: "terminal.terminate", sessionId },
    ] as const) {
      intruder.send(message);
      expect(await intruder.next("terminal.error")).toMatchObject({
        code: "TERMINAL_SESSION_NOT_FOUND",
      });
    }

    expect(pty.has(sessionId)).toBe(true);
    const marker = uniqueMarker("OWNER_OK");
    owner.send({ type: "terminal.input", sessionId, data: `echo ${marker}\r` });
    await owner.waitForLine(sessionId, marker);
  });

  it("terminates the PTY when the socket disconnects", async () => {
    const client = await connect();
    const created = await createTerminal(client);
    const exited = waitForExit(pty, created.sessionId);
    await client.close();
    await exited;
    expect(pty.size).toBe(0);
    expect(isAlive(created.pid ?? -1)).toBe(false);
  });

  it("closing the app closes sockets and terminates their PTYs", async () => {
    const client = await connect();
    const created = await createTerminal(client);
    await app.close();
    await client.waitForClose();
    expect(pty.size).toBe(0);
    expect(isAlive(created.pid ?? -1)).toBe(false);
  });
});

describe("origin check", () => {
  it.each([
    ["a foreign origin", "http://evil.example"],
    ["no origin", undefined],
  ])("refuses the handshake from %s", async (_label, origin) => {
    await expect(TestTerminalClient.connect(url, origin)).rejects.toThrow(/HTTP 403/);
  });
});
