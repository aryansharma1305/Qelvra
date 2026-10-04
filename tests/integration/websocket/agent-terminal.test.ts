import { ProviderRegistry } from "../../../apps/server/src/providers/index";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AGENT_TERMINAL_CLOSE, type Agent } from "@qelvra/shared";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import type { PtyManager } from "../../../apps/server/src/pty/index";
import {
  cleanupManagers,
  createTestManager,
  isAlive,
  leakedPids,
  uniqueMarker,
} from "../pty/helpers";
import { TestTerminalClient } from "./client";

// Agent runtimes with real shells: lifecycle over REST (app.inject), terminals over a real
// WebSocket on a loopback port.

const ORIGIN = "http://127.0.0.1:5173";
let app: FastifyInstance;
let pty: PtyManager;
let base: string;
let dataDir: string;
const clients: TestTerminalClient[] = [];

beforeEach(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "qelvra-agent-runtime-"));
  pty = createTestManager({ workspaceRoot: dataDir });
  app = await createApp(loadConfig({ WEB_ORIGIN: ORIGIN, DATA_DIR: dataDir }), {
    logger: false,
    ptyManager: pty,
    providerRegistry: new ProviderRegistry({
      env: {
        PATH: process.env.PATH,
        HOME: dataDir,
        SHELL: process.env.QELVRA_TEST_SHELL ?? "/bin/sh",
        LANG: "C",
      },
    }),
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  const address = app.server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  base = `ws://127.0.0.1:${address.port}`;
});

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close().catch(() => undefined)));
  await app.close();
  await cleanupManagers();
  rmSync(dataDir, { recursive: true, force: true });
});

afterAll(() => {
  expect(leakedPids(), "PTY processes left running").toEqual([]);
});

async function api(method: "GET" | "POST" | "DELETE", url: string, payload?: object) {
  const res = await app.inject({ method, url, ...(payload ? { payload } : {}) });
  return { status: res.statusCode, body: res.body ? (JSON.parse(res.body) as unknown) : null };
}

async function create(name: string): Promise<Agent> {
  const res = await api("POST", "/api/agents", { name, role: "Test" });
  expect(res.status).toBe(201);
  return (res.body as { agent: Agent }).agent;
}

async function lifecycle(id: string, action: "start" | "stop" | "restart") {
  const res = await api("POST", `/api/agents/${id}/${action}`);
  return { status: res.status, body: res.body as { agent: Agent; error?: { code: string } } };
}

function pidOf(id: string): number {
  const pid = app.runtime.get(id)?.pid;
  if (!pid) throw new Error(`${id} has no shell`);
  return pid;
}

async function attach(id: string, origin = ORIGIN) {
  const client = await TestTerminalClient.connect(`${base}/ws/agents/${id}/terminal`, origin);
  clients.push(client);
  client.send({ type: "terminal.attach", cols: 100, rows: 30 });
  return client;
}

async function attached(id: string) {
  const client = await attach(id);
  const created = await client.received("terminal.created");
  expect(created.sessionId).toBe(id);
  return client;
}

async function run(client: TestTerminalClient, id: string, marker: string) {
  client.send({ type: "terminal.input", sessionId: id, data: `echo ${marker}\r` });
  await client.waitForLine(id, marker);
}

describe("agent lifecycle with real shells", () => {
  it("runs Nova and Atlas side by side, isolated, through stop, restart and delete", async () => {
    await create("Nova");
    await create("Atlas");
    expect((await lifecycle("nova", "start")).body.agent.status).toBe("running");
    expect((await lifecycle("atlas", "start")).body.agent.status).toBe("running");
    expect(pty.size).toBe(2);
    const novaPid = pidOf("nova");
    const atlasPid = pidOf("atlas");
    expect(novaPid).not.toBe(atlasPid);

    const nova = await attached("nova");
    const atlas = await attached("atlas");
    const novaMarker = uniqueMarker("NOVA_RUNTIME");
    const atlasMarker = uniqueMarker("ATLAS_RUNTIME");
    await run(nova, "nova", novaMarker);
    await run(atlas, "atlas", atlasMarker);
    expect(nova.output("nova")).not.toContain(atlasMarker);
    expect(atlas.output("atlas")).not.toContain(novaMarker);

    // Stop Nova: its shell is gone, its viewer is told, Atlas is untouched.
    expect((await lifecycle("nova", "stop")).body.agent.status).toBe("stopped");
    expect(isAlive(novaPid)).toBe(false);
    await nova.received("terminal.exit");
    expect(await nova.waitForClose()).toBe(AGENT_TERMINAL_CLOSE.ENDED);
    expect(app.agents.require("atlas").status).toBe("running");
    await run(atlas, "atlas", uniqueMarker("ATLAS_STILL"));

    // Restart Nova: a fresh shell that works.
    expect((await lifecycle("nova", "restart")).body.agent.status).toBe("running");
    expect(pidOf("nova")).not.toBe(novaPid);
    await run(await attached("nova"), "nova", uniqueMarker("NOVA_AGAIN"));

    // Delete Atlas while running: its shell dies before the record goes.
    let aliveAtDelete: boolean | null = null;
    app.agents.subscribe((event) => {
      if (event.type === "agent.deleted") aliveAtDelete = isAlive(atlasPid);
    });
    expect((await api("DELETE", "/api/agents/atlas")).status).toBe(204);
    expect(aliveAtDelete).toBe(false);
    expect(isAlive(atlasPid)).toBe(false);
    expect((await api("GET", "/api/agents/atlas")).status).toBe(404);
    expect(pty.size).toBe(1);
  });

  it("maps lifecycle errors to the API envelope", async () => {
    await create("Nova");
    expect((await lifecycle("ghost", "start")).status).toBe(404);
    expect((await api("POST", "/api/agents/..%2Fx/start")).status).toBe(400);
    await lifecycle("nova", "start");
    const again = await lifecycle("nova", "start");
    expect(again.status).toBe(409);
    expect(again.body.error?.code).toBe("AGENT_ALREADY_RUNNING");
    expect(pty.size).toBe(1);
    // stop is idempotent
    expect((await lifecycle("nova", "stop")).status).toBe(200);
    expect((await lifecycle("nova", "stop")).body.agent.status).toBe("stopped");
  });

  it("concurrent start requests create exactly one shell", async () => {
    await create("Nova");
    const results = await Promise.all([
      lifecycle("nova", "start"),
      lifecycle("nova", "start"),
      lifecycle("nova", "start"),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
    expect(pty.size).toBe(1);
  });

  it("a shell that exits by itself marks the agent stopped", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    const client = await attached("nova");
    client.send({ type: "terminal.input", sessionId: "nova", data: "exit 0\r" });
    await client.next("terminal.exit");
    await client.until(() => app.agents.require("nova").status === "stopped", "stopped", 5_000);
    expect(app.runtime.get("nova")).toBeUndefined();
    expect(pty.size).toBe(0);
  });

  it("a crashing shell marks the agent error", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    const client = await attached("nova");
    client.send({ type: "terminal.input", sessionId: "nova", data: "exit 3\r" });
    await client.next("terminal.exit");
    await client.until(() => app.agents.require("nova").status === "error", "error", 5_000);
  });

  it("server shutdown stops every agent and scratch terminal, and records stopped", async () => {
    await create("Nova");
    await create("Atlas");
    await lifecycle("nova", "start");
    await lifecycle("atlas", "start");
    const pids = [pidOf("nova"), pidOf("atlas")];
    const scratch = await TestTerminalClient.connect(`${base}/ws/terminal`, ORIGIN);
    clients.push(scratch);
    scratch.send({ type: "terminal.create" });
    const created = await scratch.next("terminal.created");

    await app.close();
    for (const pid of [...pids, created.pid ?? -1]) expect(isAlive(pid)).toBe(false);
    expect(pty.size).toBe(0);
    expect(app.agents.list().map((agent) => agent.status)).toEqual(["stopped", "stopped"]);
  });
});

describe("agent terminal WebSocket", () => {
  it("disconnecting leaves the agent running, and a new viewer can attach", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    const pid = pidOf("nova");
    const first = await attached("nova");
    await run(first, "nova", uniqueMarker("BEFORE"));
    await first.close();

    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(isAlive(pid)).toBe(true);
    expect(app.agents.require("nova").status).toBe("running");
    expect(app.runtime.get("nova")?.attached).toBe(false);

    const second = await attached("nova");
    await run(second, "nova", uniqueMarker("AFTER"));
    // Earlier output is not replayed.
    expect(second.output("nova")).not.toContain("BEFORE");
  });

  it("a second viewer replaces the first", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    const first = await attached("nova");
    const second = await attached("nova");
    const error = await first.received("terminal.error");
    expect(error.code).toBe("TERMINAL_VIEWER_REPLACED");
    expect(await first.waitForClose()).toBe(AGENT_TERMINAL_CLOSE.REPLACED);
    await run(second, "nova", uniqueMarker("SECOND"));
  });

  it("refuses stopped, unknown and unsafe agents with a controlled error", async () => {
    await create("Nova");
    for (const [id, code, close] of [
      ["nova", "TERMINAL_AGENT_NOT_RUNNING", AGENT_TERMINAL_CLOSE.NOT_RUNNING],
      ["ghost", "TERMINAL_AGENT_NOT_FOUND", AGENT_TERMINAL_CLOSE.NOT_FOUND],
      ["..%2Fetc", "TERMINAL_AGENT_NOT_FOUND", AGENT_TERMINAL_CLOSE.NOT_FOUND],
    ] as const) {
      const client = await attach(id);
      expect((await client.received("terminal.error")).code).toBe(code);
      expect(await client.waitForClose()).toBe(close);
    }
    expect(pty.size).toBe(0);
  });

  it("rejects disallowed origins before the upgrade", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    await expect(
      TestTerminalClient.connect(`${base}/ws/agents/nova/terminal`, "http://evil.example"),
    ).rejects.toThrow(/403/);
  });

  it("cannot create, terminate or address other sessions", async () => {
    await create("Nova");
    await lifecycle("nova", "start");
    const client = await attached("nova");
    client.send({ type: "terminal.create" });
    expect((await client.next("terminal.error")).code).toBe("TERMINAL_INVALID_MESSAGE");
    client.send({ type: "terminal.terminate", sessionId: "nova" });
    expect((await client.next("terminal.error")).code).toBe("TERMINAL_INVALID_MESSAGE");
    client.send({ type: "terminal.input", sessionId: "atlas", data: "x" });
    expect((await client.next("terminal.error")).code).toBe("TERMINAL_SESSION_NOT_FOUND");
    expect(app.agents.require("nova").status).toBe("running");
    expect(pty.size).toBe(1);
  });

  it("the scratch endpoint refuses terminal.attach", async () => {
    const client = await TestTerminalClient.connect(`${base}/ws/terminal`, ORIGIN);
    clients.push(client);
    client.send({ type: "terminal.attach" });
    expect((await client.next("terminal.error")).code).toBe("TERMINAL_INVALID_MESSAGE");
  });
});
