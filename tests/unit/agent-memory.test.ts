import { silentLogger } from "../../apps/server/src/lib/logger";
import {
  mkdtemp,
  rm,
  writeFile,
  readFile,
  unlink,
  symlink,
  link,
  readdir,
  chmod,
} from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AGENT_MEMORY_LIMIT, ActivityInputSchema } from "@qelvra/shared";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager";
import { AgentMemoryService } from "../../apps/server/src/memory";
vi.mock("node:fs/promises", async (original) => {
  const actual = await original<typeof fs>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-memory-unit-"));
  dirs.push(dir);
  const agents = await AgentRegistry.open({ file: join(dir, "agents.json") });
  const workspaces = await AgentWorkspaceManager.open(dir);
  for (const id of ["nova", "atlas"])
    await workspaces.ensureWorkspace(await agents.create({ id, name: id, role: "Test" }));
  const service = new AgentMemoryService(agents, workspaces);
  const path = join(dir, "hive/agents/nova/memory.md");
  return { dir, agents, workspaces, service, path };
}
describe("fixed agent memory service", () => {
  it("reads the current template and persists Unicode/BOM/empty notes across service restart", async () => {
    const s = await setup();
    const original = await s.service.get("nova");
    expect(original.content).toBe("# Agent Memory\n\nNo persistent notes yet.\n");
    const saved = await s.service.update("nova", {
      content: "\ufeff# Notes\nConcise café responses.\n",
      expectedRevision: original.revision,
    });
    expect(saved.size).toBe(Buffer.byteLength(saved.content));
    expect(saved.revision).not.toBe(original.revision);
    const restarted = new AgentMemoryService(
      await AgentRegistry.open({ file: join(s.dir, "agents.json") }),
      await AgentWorkspaceManager.open(s.dir),
    );
    expect(await restarted.get("nova")).toEqual(saved);
    expect(
      (await restarted.update("nova", { content: "", expectedRevision: saved.revision })).size,
    ).toBe(0);
  });
  it("initializes only missing legacy memory without replacing existing notes", async () => {
    const s = await setup();
    await unlink(s.path);
    const values = await Promise.all([s.service.get("nova"), s.service.get("nova")]);
    expect(values[0].content).toContain("No persistent notes yet.");
    await writeFile(s.path, "PRIVATE_EXISTING");
    expect((await s.service.get("nova")).content).toBe("PRIVATE_EXISTING");
  });
  it("serializes two clients and rejects stale revisions and external edits", async () => {
    const s = await setup();
    const initial = await s.service.get("nova");
    const results = await Promise.allSettled(
      ["winner", "loser"].map((content) =>
        s.service.update("nova", { content, expectedRevision: initial.revision }),
      ),
    );
    expect(results[0]?.status).toBe("fulfilled");
    expect(results[1]).toMatchObject({
      status: "rejected",
      reason: { code: "MEMORY_CHANGED_ON_DISK" },
    });
    expect(await readFile(s.path, "utf8")).toBe("winner");
    const current = await s.service.get("nova");
    await writeFile(s.path, "provider note");
    await expect(
      s.service.update("nova", { content: "lost", expectedRevision: current.revision }),
    ).rejects.toMatchObject({ code: "MEMORY_CHANGED_ON_DISK" });
    expect(await readFile(s.path, "utf8")).toBe("provider note");
  });
  it("bounds UTF-8 bytes on read/write and accepts the exact byte limit", async () => {
    const s = await setup();
    const m = await s.service.get("nova");
    await expect(
      s.service.update("nova", {
        content: "é".repeat(AGENT_MEMORY_LIMIT),
        expectedRevision: m.revision,
      }),
    ).rejects.toMatchObject({ code: "MEMORY_TOO_LARGE" });
    const saved = await s.service.update("nova", {
      content: "x".repeat(AGENT_MEMORY_LIMIT),
      expectedRevision: m.revision,
    });
    expect(saved.size).toBe(AGENT_MEMORY_LIMIT);
    await writeFile(s.path, "x".repeat(AGENT_MEMORY_LIMIT + 1));
    await expect(s.service.get("nova")).rejects.toMatchObject({ code: "MEMORY_TOO_LARGE" });
  });
  it.each([Buffer.from([0xff, 0xfe]), Buffer.from([0]), Buffer.from([1])])(
    "rejects corrupt/binary bytes without decoding replacement characters",
    async (bytes) => {
      const s = await setup();
      await writeFile(s.path, bytes);
      await expect(s.service.get("nova")).rejects.toMatchObject({ code: "MEMORY_INVALID_UTF8" });
    },
  );
  it("rejects invalid input text and respects read-only host permissions", async () => {
    const s = await setup();
    const m = await s.service.get("nova");
    for (const content of ["\ud800", "notes\0secret"])
      await expect(
        s.service.update("nova", { content, expectedRevision: m.revision }),
      ).rejects.toMatchObject({ code: "MEMORY_INVALID_UTF8" });
    await chmod(s.path, 0o444);
    const readonly = await s.service.get("nova");
    await expect(
      s.service.update("nova", { content: "bad", expectedRevision: readonly.revision }),
    ).rejects.toMatchObject({ code: "MEMORY_WRITE_FAILED" });
    await chmod(s.path, 0o600);
  });
  it("keeps agents isolated and rejects unknown or traversal identities", async () => {
    const s = await setup();
    await writeFile(s.path, "PRIVATE_NOVA");
    expect((await s.service.get("atlas")).content).not.toContain("PRIVATE_NOVA");
    for (const id of ["missing", "../nova", "/etc/passwd", "%2e%2e"])
      await expect(s.service.get(id)).rejects.toMatchObject({ code: "AGENT_NOT_FOUND" });
  });
  it("rejects escaping/internal symlinks and hard-linked memory on reads and saves", async () => {
    const s = await setup();
    const m = await s.service.get("nova");
    const outside = join(s.dir, "secret");
    await writeFile(outside, "PRIVATE_SECRET");
    for (const target of [outside, join(s.dir, "hive/agents/atlas/memory.md")]) {
      await unlink(s.path);
      await symlink(target, s.path);
      await expect(s.service.get("nova")).rejects.toMatchObject({ code: "MEMORY_READ_FAILED" });
      await expect(
        s.service.update("nova", { content: "bad", expectedRevision: m.revision }),
      ).rejects.toMatchObject({ code: "MEMORY_WRITE_FAILED" });
    }
    await unlink(s.path);
    await link(outside, s.path);
    await expect(s.service.get("nova")).rejects.toMatchObject({ code: "MEMORY_READ_FAILED" });
    expect(await readFile(outside, "utf8")).toBe("PRIVATE_SECRET");
  });
  it("publication failure preserves memory and cleans its owned temporary file", async () => {
    const s = await setup();
    const m = await s.service.get("nova");
    vi.mocked(fs.rename).mockRejectedValueOnce(
      Object.assign(new Error("Injected publish failure"), { code: "EIO" }),
    );
    await expect(
      s.service.update("nova", { content: "partial", expectedRevision: m.revision }),
    ).rejects.toMatchObject({ code: "MEMORY_WRITE_FAILED" });
    expect(await readFile(s.path, "utf8")).toBe(m.content);
    expect(
      (await readdir(join(s.dir, "hive/agents/nova"))).filter((n) =>
        n.startsWith(".qelvra-files-tmp-"),
      ),
    ).toEqual([]);
  });
  it("Activity schema accepts only metadata, never memory content", () => {
    const input = {
      type: "memory.updated",
      actor: { type: "user" },
      entity: { type: "agent", id: "nova" },
      metadata: { agentId: "nova", size: 42 },
    };
    expect(ActivityInputSchema.safeParse(input).success).toBe(true);
    expect(
      ActivityInputSchema.safeParse({
        ...input,
        metadata: { ...input.metadata, content: "PRIVATE" },
      }).success,
    ).toBe(false);
  });
  it("logs only operation metadata, never note contents", async () => {
    const s = await setup();
    const debug = vi.fn(),
      warn = vi.fn();
    const service = new AgentMemoryService(s.agents, s.workspaces, undefined, {
      ...silentLogger,
      debug,
      warn,
    });
    const m = await service.get("nova");
    await service.update("nova", {
      content: "PRIVATE_NOTE_DO_NOT_LOG",
      expectedRevision: m.revision,
    });
    await expect(
      service.update("nova", { content: "PRIVATE_STALE_NOTE", expectedRevision: m.revision }),
    ).rejects.toMatchObject({ code: "MEMORY_CHANGED_ON_DISK" });
    expect(JSON.stringify([debug.mock.calls, warn.mock.calls])).not.toContain("PRIVATE");
    expect(warn).toHaveBeenCalledWith(
      { agentId: "nova", operation: "write", errorCode: "MEMORY_CHANGED_ON_DISK" },
      expect.any(String),
    );
  });
});
