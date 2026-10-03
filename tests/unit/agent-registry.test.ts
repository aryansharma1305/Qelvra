import { chmodSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { agentIdFromName, type Agent } from "@qelvra/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  AgentError,
  AgentRegistry,
  AgentRegistryLoadError,
  type AgentErrorCode,
  type AgentRegistryEvent,
} from "../../apps/server/src/agents/index";

const dirs: string[] = [];
function tempFile(): string {
  const dir = mkdtempSync(join(tmpdir(), "qelvra-agents-"));
  dirs.push(dir);
  return join(dir, "agents.json");
}
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    chmodSync(dir, 0o700);
    rmSync(dir, { recursive: true, force: true });
  }
});

/** A clock frozen at one instant: ordering must still follow creation order. */
const frozenClock = () => new Date("2026-10-03T10:00:00.000Z");

async function open(file = tempFile()) {
  return AgentRegistry.open({ file, clock: frozenClock });
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

describe("agent ids from names", () => {
  it.each([
    ["Nova", "nova"],
    ["Frontend Nova", "frontend-nova"],
    ["  QA / Security  ", "qa-security"],
    ["Zoë Ünïcode", "zoe-unicode"],
    ["agent_007", "agent-007"],
  ])("%j -> %j", (name, id) => {
    expect(agentIdFromName(name)).toBe(id);
  });

  it("returns null when nothing usable remains", () => {
    expect(agentIdFromName("🙂🙂")).toBeNull();
    expect(agentIdFromName("---")).toBeNull();
  });

  it("never produces path components", () => {
    for (const name of ["../../etc", "/etc/passwd", "a\\b", "nul\u0000x"]) {
      const id = agentIdFromName(name);
      expect(id ?? "").toMatch(/^[a-z0-9-]*$/);
    }
  });
});

describe("AgentRegistry", () => {
  it("creates agents with server-owned state", async () => {
    const registry = await open();
    const agent = await registry.create({ name: "Frontend Nova", role: "Frontend Engineer" });
    expect(agent).toEqual({
      id: "frontend-nova",
      name: "Frontend Nova",
      role: "Frontend Engineer",
      status: "stopped",
      providerId: null,
      createdAt: "2026-10-03T10:00:00.000Z",
      updatedAt: "2026-10-03T10:00:00.000Z",
    });
    expect(registry.get("frontend-nova")).toEqual(agent);
  });

  it("ignores attempts to set status or process settings", async () => {
    const registry = await open();
    const sneaky = {
      name: "Atlas",
      role: "Backend",
      status: "working",
      command: "/bin/sh",
      cwd: "/",
    };
    const agent = await registry.create(sneaky as unknown as { name: string; role: string });
    expect(agent.status).toBe("stopped");
    expect(agent).not.toHaveProperty("command");
    expect(agent).not.toHaveProperty("cwd");
  });

  it("rejects duplicates, including concurrent ones", async () => {
    const registry = await open();
    await registry.create({ name: "Nova", role: "Frontend" });
    expect(await codeOf(registry.create({ name: "Nova", role: "Other" }))).toBe(
      "AGENT_ALREADY_EXISTS",
    );
    expect(await codeOf(registry.create({ name: "NOVA!", role: "Other" }))).toBe(
      "AGENT_ALREADY_EXISTS",
    );

    const results = await Promise.allSettled([
      registry.create({ name: "Echo", role: "a" }),
      registry.create({ name: "Echo", role: "b" }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(registry.size).toBe(2);
  });

  it.each([
    [{ name: "", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "x".repeat(81), role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "<img src=x>", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "bell\u0007", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "line\nbreak", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "🙂", role: "r" }, "AGENT_INVALID_NAME"],
    [{ name: "Nova", role: "" }, "AGENT_INVALID_ROLE"],
    [{ name: "Nova", role: "r".repeat(121) }, "AGENT_INVALID_ROLE"],
    [{ name: "Nova", role: "r", id: "../etc" }, "AGENT_INVALID_ID"],
    [{ name: "Nova", role: "r", id: "Nova" }, "AGENT_INVALID_ID"],
    [{ name: "Nova", role: "r", id: "/abs" }, "AGENT_INVALID_ID"],
    [{ name: "Nova", role: "r", id: "a".repeat(65) }, "AGENT_INVALID_ID"],
  ])("rejects %o with %s", async (input, code) => {
    const registry = await open();
    expect(await codeOf(registry.create(input))).toBe(code);
    expect(registry.size).toBe(0);
  });

  it("trims names and roles and accepts an explicit valid id", async () => {
    const registry = await open();
    const agent = await registry.create({ name: "  Scout  ", role: " QA ", id: "qa-scout" });
    expect(agent).toMatchObject({ id: "qa-scout", name: "Scout", role: "QA" });
  });

  it("lists in creation order even when timestamps tie", async () => {
    const registry = await open();
    for (const name of ["Zed", "Alpha", "Mid"]) await registry.create({ name, role: "r" });
    const agents = registry.list();
    expect(agents.map((a) => a.id)).toEqual(["zed", "alpha", "mid"]);
    expect(new Set(agents.map((a) => a.createdAt)).size).toBe(3);
  });

  it("returns frozen snapshots that cannot change registry state", async () => {
    const registry = await open();
    await registry.create({ name: "Nova", role: "r" });
    const snapshot = registry.get("nova") as Agent;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as { status: string }).status = "working";
    }).toThrow();
    const listed = registry.list();
    listed.pop();
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("nova")?.status).toBe("stopped");
  });

  it("deletes agents and reports unknown ones", async () => {
    const registry = await open();
    await registry.create({ name: "Nova", role: "r" });
    await registry.delete("nova");
    expect(registry.get("nova")).toBeUndefined();
    expect(await codeOf(registry.delete("nova"))).toBe("AGENT_NOT_FOUND");
    expect(() => registry.require("ghost")).toThrow(AgentError);
  });

  it("only allows lifecycle transitions from the state machine", async () => {
    const registry = await open();
    await registry.create({ name: "Nova", role: "r" });
    expect(await codeOf(registry.transition("nova", "working"))).toBe("AGENT_INVALID_TRANSITION");
    expect((await registry.transition("nova", "starting")).status).toBe("starting");
    expect((await registry.transition("nova", "running")).status).toBe("running");
    expect(await codeOf(registry.transition("nova", "created"))).toBe("AGENT_INVALID_TRANSITION");
    expect(await codeOf(registry.transition("ghost", "starting"))).toBe("AGENT_NOT_FOUND");
  });

  it("notifies subscribers of creation, updates and deletion", async () => {
    const registry = await open();
    const events: AgentRegistryEvent["type"][] = [];
    const subscription = registry.subscribe((event) => events.push(event.type));
    await registry.create({ name: "Nova", role: "r" });
    await registry.transition("nova", "starting");
    await registry.delete("nova");
    subscription.dispose();
    await registry.create({ name: "Atlas", role: "r" });
    expect(events).toEqual(["agent.created", "agent.updated", "agent.deleted"]);
  });
});

describe("persistence", () => {
  it("survives a restart and resets runtime states to stopped", async () => {
    const file = tempFile();
    const first = await open(file);
    await first.create({ name: "Nova", role: "Frontend" });
    await first.create({ name: "Atlas", role: "Backend" });
    await first.transition("atlas", "starting");
    await first.transition("atlas", "running");

    const second = await open(file);
    expect(second.list().map((a) => [a.id, a.status])).toEqual([
      ["nova", "stopped"],
      ["atlas", "stopped"],
    ]);
  });

  it("writes atomically and leaves no temp files", async () => {
    const file = tempFile();
    const registry = await open(file);
    await Promise.all(["A1", "B2", "C3", "D4"].map((name) => registry.create({ name, role: "r" })));
    const stored = JSON.parse(readFileSync(file, "utf8")) as { version: number; agents: Agent[] };
    expect(stored.version).toBe(1);
    expect(stored.agents.map((a) => a.id)).toEqual(["a1", "b2", "c3", "d4"]);
    expect(readdirSync(join(file, "..")).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("starts empty when the file does not exist", async () => {
    expect((await open()).size).toBe(0);
  });

  it.each([
    ["not JSON", "{oops"],
    ["wrong shape", JSON.stringify({ version: 1, agents: [{ id: "x" }] })],
    [
      "unsafe id",
      JSON.stringify({
        version: 1,
        agents: [
          {
            id: "../etc",
            name: "x",
            role: "r",
            status: "stopped",
            providerId: null,
            createdAt: "2026-10-03T10:00:00.000Z",
            updatedAt: "2026-10-03T10:00:00.000Z",
          },
        ],
      }),
    ],
    ["unknown version", JSON.stringify({ version: 9, agents: [] })],
  ])(
    "refuses to start from a corrupt file (%s) instead of discarding it",
    async (_label, contents) => {
      const file = tempFile();
      writeFileSync(file, contents);
      await expect(open(file)).rejects.toThrow(AgentRegistryLoadError);
      expect(readFileSync(file, "utf8")).toBe(contents);
    },
  );

  it("refuses duplicate ids in the file", async () => {
    const file = tempFile();
    const agent = {
      id: "nova",
      name: "Nova",
      role: "r",
      status: "stopped",
      providerId: null,
      createdAt: "2026-10-03T10:00:00.000Z",
      updatedAt: "2026-10-03T10:00:00.000Z",
    };
    writeFileSync(file, JSON.stringify({ version: 1, agents: [agent, agent] }));
    await expect(open(file)).rejects.toThrow(/twice/);
  });

  it("rolls back the in-memory change when the write fails", async () => {
    const file = tempFile();
    const registry = await open(file);
    await registry.create({ name: "Nova", role: "r" });
    chmodSync(join(file, ".."), 0o500); // directory no longer writable

    expect(await codeOf(registry.create({ name: "Atlas", role: "r" }))).toBe(
      "AGENT_PERSISTENCE_FAILED",
    );
    expect(registry.get("atlas")).toBeUndefined();
    expect(await codeOf(registry.delete("nova"))).toBe("AGENT_PERSISTENCE_FAILED");
    expect(registry.get("nova")).toBeDefined();

    chmodSync(join(file, ".."), 0o700);
    await registry.create({ name: "Atlas", role: "r" });
    expect((await open(file)).list().map((a) => a.id)).toEqual(["nova", "atlas"]);
  });
});
