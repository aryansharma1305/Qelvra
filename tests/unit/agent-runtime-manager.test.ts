import { dirname } from "node:path";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentStatus } from "@qelvra/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentError,
  AgentRegistry,
  AgentRuntimeManager,
  type AgentErrorCode,
  type AgentPtyHost,
  type AgentTerminalViewer,
} from "../../apps/server/src/agents/index";
import {
  PtyError,
  type CreatePtySessionOptions,
  type Disposable,
  type PtyExit,
  type PtySessionInfo,
} from "../../apps/server/src/pty/index";

// AgentRuntimeManager against a PTY double: deterministic exits, spawn failures and
// stops that can be held mid-flight to race other operations against them. Real shells
// are covered by tests/integration/server/agent-runtime.test.ts.

interface FakeSession {
  info: PtySessionInfo;
  data: Set<(data: string) => void>;
  exit: Set<(exit: PtyExit) => void>;
  input: string[];
}

class FakePty implements AgentPtyHost {
  readonly sessions = new Map<string, FakeSession>();
  readonly created: string[] = [];
  failSpawn = false;
  /** While set, terminate() waits for it before the process "exits". */
  gate: Promise<void> | null = null;
  private nextPid = 1000;

  createSession(options: CreatePtySessionOptions): PtySessionInfo {
    if (this.failSpawn) throw new PtyError("PTY_SPAWN_FAILED", "spawn failed");
    if (this.sessions.has(options.id)) throw new PtyError("PTY_SESSION_EXISTS", "exists");
    const info: PtySessionInfo = {
      id: options.id,
      pid: this.nextPid++,
      shell: "/bin/zsh",
      args: [],
      cwd: options.cwd ?? "/work",
      cols: 120,
      rows: 32,
      createdAt: new Date().toISOString(),
      status: "running",
      exit: null,
    };
    this.sessions.set(options.id, { info, data: new Set(), exit: new Set(), input: [] });
    this.created.push(options.id);
    return { ...info };
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  get(id: string): PtySessionInfo | undefined {
    const session = this.sessions.get(id);
    return session && { ...session.info };
  }

  write(id: string, data: string): void {
    this.require(id).input.push(data);
  }

  resize(id: string, cols: number, rows: number): void {
    Object.assign(this.require(id).info, { cols, rows });
  }

  onData(id: string, listener: (data: string) => void): Disposable {
    const session = this.require(id);
    session.data.add(listener);
    return { dispose: () => void session.data.delete(listener) };
  }

  onExit(id: string, listener: (exit: PtyExit) => void): Disposable {
    const session = this.require(id);
    session.exit.add(listener);
    return { dispose: () => void session.exit.delete(listener) };
  }

  async terminate(id: string): Promise<PtyExit | null> {
    if (!this.sessions.has(id)) return null;
    if (this.gate) await this.gate;
    if (!this.sessions.has(id)) return null; // exited by itself meanwhile
    const exit = { exitCode: 0, signal: 1 };
    this.exit(id, exit);
    return exit;
  }

  /** The process exits (by itself or from terminate). */
  exit(id: string, exit: PtyExit): void {
    const session = this.require(id);
    this.sessions.delete(id);
    for (const listener of [...session.exit]) listener(exit);
    session.exit.clear();
    session.data.clear();
  }

  emit(id: string, data: string): void {
    for (const listener of this.require(id).data) listener(data);
  }

  listenerCount(id: string): number {
    const session = this.require(id);
    return session.data.size + session.exit.size;
  }

  private require(id: string): FakeSession {
    const session = this.sessions.get(id);
    if (!session) throw new PtyError("PTY_SESSION_NOT_FOUND", "not found");
    return session;
  }
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "qelvra-runtime-"));
  dirs.push(dir);
  return join(dir, "agents.json");
}

async function setup(options: { alive?: (pid: number) => boolean } = {}) {
  const registry = await AgentRegistry.open({ file: tempFile() });
  const pty = new FakePty();
  const runtime = new AgentRuntimeManager({
    registry,
    workspaces: await AgentWorkspaceManager.open(dirname(registry.file)),
    pty,
    isProcessAlive: options.alive ?? (() => false),
  });
  await registry.create({ name: "Nova", role: "Frontend" });
  await registry.create({ name: "Atlas", role: "Backend" });
  /** Every status the registry records, in order, per agent. */
  const history: { nova: AgentStatus[]; atlas: AgentStatus[] } = { nova: [], atlas: [] };
  registry.subscribe((event) => {
    if (
      event.type === "agent.updated" &&
      (event.agent.id === "nova" || event.agent.id === "atlas")
    ) {
      history[event.agent.id].push(event.agent.status);
    }
  });
  return { registry, pty, runtime, history };
}

async function codeOf(promise: Promise<unknown>): Promise<AgentErrorCode | "no error"> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof AgentError) return error.code;
    throw error;
  }
  return "no error";
}

/** A gate the test opens by hand, holding terminate() mid-flight. */
function hold(pty: FakePty): () => void {
  let release!: () => void;
  pty.gate = new Promise((resolve) => (release = resolve));
  return () => {
    pty.gate = null;
    release();
  };
}

function sessionOf(runtime: AgentRuntimeManager, agentId: string): string {
  const info = runtime.get(agentId);
  if (!info) throw new Error(`${agentId} has no runtime`);
  return info.sessionId;
}

function viewer(): AgentTerminalViewer & { output: string[]; exits: PtyExit[]; replaced: number } {
  const v = {
    output: [] as string[],
    exits: [] as PtyExit[],
    replaced: 0,
    onData: (data: string) => void v.output.push(data),
    onExit: (exit: PtyExit) => void v.exits.push(exit),
    onReplaced: () => void (v.replaced += 1),
  };
  return v;
}

describe("start", () => {
  it("starts a registered agent with its own PTY and marks it running", async () => {
    const { pty, runtime, history } = await setup();
    const agent = await runtime.start("nova");
    expect(agent.status).toBe("running");
    expect(history.nova).toEqual(["starting", "running"]);
    const info = runtime.get("nova");
    expect(info).toMatchObject({ agentId: "nova", attached: false, pid: 1000 });
    expect(pty.has(info?.sessionId ?? "")).toBe(true);
    expect(info?.sessionId).toMatch(/^agent-[0-9a-f-]{36}$/);
  });

  it("rejects unknown agents without creating a PTY", async () => {
    const { pty, runtime } = await setup();
    expect(await codeOf(runtime.start("ghost"))).toBe("AGENT_NOT_FOUND");
    expect(pty.created).toEqual([]);
  });

  it("refuses to start an agent that is already running", async () => {
    const { pty, runtime } = await setup();
    await runtime.start("nova");
    expect(await codeOf(runtime.start("nova"))).toBe("AGENT_ALREADY_RUNNING");
    expect(pty.sessions.size).toBe(1);
  });

  it("two simultaneous starts create exactly one PTY", async () => {
    const { pty, runtime } = await setup();
    const results = await Promise.allSettled([runtime.start("nova"), runtime.start("nova")]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    expect(pty.created).toHaveLength(1);
    expect(runtime.size).toBe(1);
  });

  it("a spawn failure leaves the agent in error with no runtime, and it can start again", async () => {
    const { pty, runtime, registry, history } = await setup();
    pty.failSpawn = true;
    expect(await codeOf(runtime.start("nova"))).toBe("AGENT_START_FAILED");
    expect(registry.require("nova").status).toBe("error");
    expect(history.nova).toEqual(["starting", "error"]);
    expect(runtime.get("nova")).toBeUndefined();

    pty.failSpawn = false;
    expect((await runtime.start("nova")).status).toBe("running");
  });

  it("runs several agents at once, each with its own session", async () => {
    const { pty, runtime } = await setup();
    await Promise.all([runtime.start("nova"), runtime.start("atlas")]);
    expect(pty.sessions.size).toBe(2);
    expect(sessionOf(runtime, "nova")).not.toBe(sessionOf(runtime, "atlas"));
  });
});

describe("stop", () => {
  it("terminates the PTY, forgets the runtime and records stopped", async () => {
    const { pty, runtime, history } = await setup();
    await runtime.start("nova");
    const session = sessionOf(runtime, "nova");
    const agent = await runtime.stop("nova");
    expect(agent.status).toBe("stopped");
    expect(history.nova).toEqual(["starting", "running", "stopping", "stopped"]);
    expect(pty.has(session)).toBe(false);
    expect(runtime.get("nova")).toBeUndefined();
  });

  it("is idempotent: stopping a stopped agent changes nothing", async () => {
    const { runtime, history } = await setup();
    expect((await runtime.stop("nova")).status).toBe("stopped");
    await runtime.start("nova");
    await runtime.stop("nova");
    const before = history.nova.length;
    expect((await runtime.stop("nova")).status).toBe("stopped");
    expect(history.nova).toHaveLength(before);
  });

  it("stopping one agent leaves the others running", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    await runtime.start("atlas");
    const atlas = sessionOf(runtime, "atlas");
    await runtime.stop("nova");
    expect(registry.require("atlas").status).toBe("running");
    expect(pty.has(atlas)).toBe(true);
  });

  it("never reports stopped while the shell is still alive", async () => {
    let alive = true;
    const { runtime, registry } = await setup({ alive: () => alive });
    await runtime.start("nova");
    expect(await codeOf(runtime.stop("nova"))).toBe("AGENT_STOP_FAILED");
    expect(registry.require("nova").status).toBe("error");
    expect(runtime.get("nova")).toBeDefined(); // kept, so a later stop can retry

    alive = false;
    expect((await runtime.stop("nova")).status).toBe("stopped");
    expect(runtime.get("nova")).toBeUndefined();
  });

  it("rejects unknown agents", async () => {
    const { runtime } = await setup();
    expect(await codeOf(runtime.stop("ghost"))).toBe("AGENT_NOT_FOUND");
  });
});

describe("restart", () => {
  it("replaces the shell with a fresh session", async () => {
    const { pty, runtime, history } = await setup();
    await runtime.start("nova");
    const first = sessionOf(runtime, "nova");
    expect((await runtime.restart("nova")).status).toBe("running");
    const second = sessionOf(runtime, "nova");
    expect(second).not.toBe(first);
    expect(pty.has(first)).toBe(false);
    expect(pty.has(second)).toBe(true);
    expect(history.nova.slice(2)).toEqual(["stopping", "stopped", "starting", "running"]);
  });

  it("starts a stopped agent", async () => {
    const { runtime } = await setup();
    expect((await runtime.restart("nova")).status).toBe("running");
  });
});

describe("delete", () => {
  it("kills a running agent's PTY before its record disappears", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    const session = sessionOf(runtime, "nova");
    let aliveAtDelete: boolean | null = null;
    registry.subscribe((event) => {
      if (event.type === "agent.deleted") aliveAtDelete = pty.has(session);
    });
    await runtime.delete("nova");
    expect(aliveAtDelete).toBe(false);
    expect(registry.get("nova")).toBeUndefined();
    expect(runtime.get("nova")).toBeUndefined();
  });

  it("keeps the record if the shell cannot be stopped", async () => {
    const { runtime, registry } = await setup({ alive: () => true });
    await runtime.start("nova");
    expect(await codeOf(runtime.delete("nova"))).toBe("AGENT_STOP_FAILED");
    expect(registry.get("nova")).toBeDefined();
  });

  it("deletes a stopped agent directly", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.delete("atlas");
    expect(registry.get("atlas")).toBeUndefined();
    expect(pty.created).toEqual([]);
  });
});

describe("unexpected exit", () => {
  it("a clean exit records stopped and clears the runtime and listeners", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    const session = sessionOf(runtime, "nova");
    const v = viewer();
    runtime.attach("nova", v);
    expect(pty.listenerCount(session)).toBe(3); // runtime exit + viewer data + viewer exit

    pty.exit(session, { exitCode: 0, signal: null });
    await vi.waitFor(() => expect(registry.require("nova").status).toBe("stopped"));
    expect(runtime.get("nova")).toBeUndefined();
    expect(v.exits).toEqual([{ exitCode: 0, signal: null }]);
  });

  it("a crash records error, and the agent can be started again", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    pty.exit(sessionOf(runtime, "nova"), { exitCode: 1, signal: null });
    await vi.waitFor(() => expect(registry.require("nova").status).toBe("error"));
    expect((await runtime.start("nova")).status).toBe("running");
  });

  it("an exit during stop is recorded once, as stopped", async () => {
    const { pty, runtime, history } = await setup();
    await runtime.start("nova");
    const session = sessionOf(runtime, "nova");
    const release = hold(pty);
    const stopping = runtime.stop("nova");
    await vi.waitFor(() => expect(history.nova.at(-1)).toBe("stopping"));
    pty.exit(session, { exitCode: 1, signal: null }); // dies on its own meanwhile
    release();
    expect((await stopping).status).toBe("stopped");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(history.nova).toEqual(["starting", "running", "stopping", "stopped"]);
  });
});

describe("races", () => {
  it("start while stopping waits for the stop, then starts a fresh shell", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    const first = sessionOf(runtime, "nova");
    const release = hold(pty);
    const stopping = runtime.stop("nova");
    const starting = runtime.start("nova");
    release();
    await stopping;
    expect((await starting).status).toBe("running");
    expect(sessionOf(runtime, "nova")).not.toBe(first);
    expect(pty.sessions.size).toBe(1);
    expect(registry.require("nova").status).toBe("running");
  });

  it("restart while stopping ends with exactly one running shell", async () => {
    const { pty, runtime } = await setup();
    await runtime.start("nova");
    const release = hold(pty);
    const stopping = runtime.stop("nova");
    const restarting = runtime.restart("nova");
    release();
    await stopping;
    expect((await restarting).status).toBe("running");
    expect(pty.sessions.size).toBe(1);
  });

  it("delete while starting leaves no shell and no record", async () => {
    const { pty, runtime, registry } = await setup();
    const starting = runtime.start("nova");
    const deleting = runtime.delete("nova");
    await starting;
    await deleting;
    expect(pty.sessions.size).toBe(0);
    expect(registry.get("nova")).toBeUndefined();
  });

  it("shutdown during restart stops everything and refuses new starts", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    await runtime.start("atlas");
    const release = hold(pty);
    const restarting = runtime.restart("nova");
    const shutdown = runtime.stopAll();
    release();
    // The restart's start step sees the shutdown and fails rather than spawning.
    expect(await codeOf(restarting)).toBe("AGENT_START_FAILED");
    await shutdown;
    expect(pty.sessions.size).toBe(0);
    expect(registry.require("nova").status).toBe("stopped");
    expect(registry.require("atlas").status).toBe("stopped");
    expect(await codeOf(runtime.start("atlas"))).toBe("AGENT_START_FAILED");
  });
});

describe("terminal viewers", () => {
  it("routes each agent's output and input only to its own shell", async () => {
    const { pty, runtime } = await setup();
    await runtime.start("nova");
    await runtime.start("atlas");
    const novaViewer = viewer();
    const atlasViewer = viewer();
    const nova = runtime.attach("nova", novaViewer);
    const atlas = runtime.attach("atlas", atlasViewer);

    pty.emit(sessionOf(runtime, "nova"), "NOVA_OUT");
    pty.emit(sessionOf(runtime, "atlas"), "ATLAS_OUT");
    nova.write("echo nova\r");
    atlas.write("echo atlas\r");

    expect(novaViewer.output).toEqual(["NOVA_OUT"]);
    expect(atlasViewer.output).toEqual(["ATLAS_OUT"]);
    expect(pty.sessions.get(sessionOf(runtime, "nova"))?.input).toEqual(["echo nova\r"]);
    expect(pty.sessions.get(sessionOf(runtime, "atlas"))?.input).toEqual(["echo atlas\r"]);
  });

  it("detaching never stops the agent", async () => {
    const { pty, runtime, registry } = await setup();
    await runtime.start("nova");
    const session = sessionOf(runtime, "nova");
    const attachment = runtime.attach("nova", viewer());
    attachment.detach();
    expect(pty.has(session)).toBe(true);
    expect(registry.require("nova").status).toBe("running");
    expect(runtime.get("nova")?.attached).toBe(false);
    expect(pty.listenerCount(session)).toBe(1); // only the runtime's exit listener
    expect(() => attachment.write("x")).toThrow(AgentError);
  });

  it("a second viewer replaces the first", async () => {
    const { pty, runtime } = await setup();
    await runtime.start("nova");
    const first = viewer();
    const second = viewer();
    const firstAttachment = runtime.attach("nova", first);
    runtime.attach("nova", second);
    pty.emit(sessionOf(runtime, "nova"), "hello");
    expect(first.replaced).toBe(1);
    expect(first.output).toEqual([]);
    expect(second.output).toEqual(["hello"]);
    expect(() => firstAttachment.write("x")).toThrow(AgentError);
  });

  it("applies the viewer's size", async () => {
    const { pty, runtime } = await setup();
    await runtime.start("nova");
    const { session } = runtime.attach("nova", viewer(), { cols: 90, rows: 20 });
    expect(session).toMatchObject({ cols: 90, rows: 20 });
    expect(pty.get(sessionOf(runtime, "nova"))).toMatchObject({ cols: 90, rows: 20 });
  });

  it("viewers learn when the agent is stopped", async () => {
    const { runtime } = await setup();
    await runtime.start("nova");
    const v = viewer();
    runtime.attach("nova", v);
    await runtime.stop("nova");
    expect(v.exits).toHaveLength(1);
  });

  it("refuses to attach to stopped or unknown agents", async () => {
    const { runtime } = await setup();
    expect(() => runtime.attach("nova", viewer())).toThrow(
      expect.objectContaining({ code: "AGENT_NOT_RUNNING" }),
    );
    expect(() => runtime.attach("ghost", viewer())).toThrow(
      expect.objectContaining({ code: "AGENT_NOT_FOUND" }),
    );
  });
});

describe("persistence", () => {
  it("statuses from an interrupted run come back as stopped, and nothing auto-starts", async () => {
    const file = tempFile();
    const at = "2026-10-03T10:00:00.000Z";
    const agent = (id: string, status: AgentStatus) => ({
      id,
      name: id,
      role: "r",
      status,
      providerId: null,
      createdAt: at,
      updatedAt: at,
    });
    writeFileSync(
      file,
      JSON.stringify({
        version: 1,
        agents: [agent("a", "starting"), agent("b", "stopping"), agent("c", "running")],
      }),
    );
    const registry = await AgentRegistry.open({ file });
    const pty = new FakePty();
    const runtime = new AgentRuntimeManager({
      registry,
      pty,
      workspaces: await AgentWorkspaceManager.open(dirname(file)),
    });
    expect(registry.list().map((a) => a.status)).toEqual(["stopped", "stopped", "stopped"]);
    expect(runtime.size).toBe(0);
    expect(pty.created).toEqual([]);
  });
});
