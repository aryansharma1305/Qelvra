import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
  symlink,
  link,
  stat,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager";

const dirs: string[] = [];
const nova = { id: "nova", name: "Nova", role: "Frontend Engineer" };
afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-workspaces-"));
  dirs.push(dir);
  const manager = await AgentWorkspaceManager.open(join(dir, "missing", "data"));
  return { dir, manager, root: join(manager.agentsRoot, "nova") };
}

describe("AgentWorkspaceManager", () => {
  it("creates the exact layout, metadata and private permissions under missing parents", async () => {
    const { manager, root } = await setup();
    expect(await manager.exists("nova")).toBe(false);
    expect(await manager.ensureWorkspace(nova)).toBe(join(root, "workspace"));
    expect(await readdir(root)).toEqual(["agent.md", "inbox", "memory.md", "outbox", "workspace"]);
    for (const name of ["inbox", "outbox", "workspace"])
      expect(await readdir(join(root, name))).toEqual([]);
    expect(await manager.readMetadata("nova", "agent.md")).toContain("Role: Frontend Engineer");
    expect(await manager.readMetadata("nova", "memory.md")).toBe(
      "# Agent Memory\n\nNo persistent notes yet.\n",
    );
    expect(manager.relativePath("nova")).toBe("hive/agents/nova/workspace");
    expect(await manager.exists("nova")).toBe(true);
    if (process.platform !== "win32") {
      expect((await stat(root)).mode & 0o077).toBe(0);
      expect((await stat(join(root, "memory.md"))).mode & 0o077).toBe(0);
    }
  });

  it("concurrent ensures preserve every existing file and repair missing directories", async () => {
    const { manager, root } = await setup();
    await Promise.all([manager.ensureWorkspace(nova), manager.ensureWorkspace(nova)]);
    for (const name of [
      "memory.md",
      "agent.md",
      "workspace/project.txt",
      "inbox/message.txt",
      "outbox/message.txt",
    ])
      await writeFile(join(root, name), name);
    await rm(join(root, "inbox", "message.txt"));
    await rm(join(root, "inbox"), { recursive: true });
    await Promise.all([
      manager.ensureWorkspace({ ...nova, name: "New name" }),
      manager.ensureWorkspace(nova),
    ]);
    expect(await readdir(join(root, "inbox"))).toEqual([]);
    for (const name of ["memory.md", "agent.md", "workspace/project.txt", "outbox/message.txt"])
      expect(await readFile(join(root, name), "utf8")).toBe(name);
  });

  it.each([
    "..",
    "../nova",
    "/tmp/nova",
    "a/b",
    "a\\b",
    "%2e%2e",
    "%252e%252e",
    "nova\0",
    "UPPER",
    "con",
    "nul",
    "com1",
  ])("rejects unsafe id %j", async (id) => {
    const { manager } = await setup();
    expect(() => manager.ensureWorkspace({ ...nova, id })).toThrow();
    await expect(manager.getWorkspacePath(id)).rejects.toThrow();
    expect(() => manager.relativePath(id)).toThrow();
  });

  it.each([
    "nova",
    "nova/workspace",
    "nova/inbox",
    "nova/outbox",
    "nova/agent.md",
    "nova/memory.md",
  ])("rejects a symlink at %s without changing its target", async (entry) => {
    const { manager, dir, root } = await setup();
    const outside = join(dir, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "sentinel"), "untouched");
    if (entry !== "nova") await mkdir(root);
    await symlink(outside, join(manager.agentsRoot, entry));
    await expect(manager.ensureWorkspace(nova)).rejects.toThrow("Unsafe");
    expect(await readdir(outside)).toEqual(["sentinel"]);
    expect(await readFile(join(outside, "sentinel"), "utf8")).toBe("untouched");
    if (entry !== "nova") expect(await readdir(root)).toEqual([entry.split("/")[1]]);
  });

  it.each(["hive", "hive/agents"])("rejects symlinked fixed parent %s", async (entry) => {
    const dir = await mkdtemp(join(tmpdir(), "qelvra-workspaces-"));
    dirs.push(dir);
    const outside = join(dir, "outside");
    await mkdir(outside);
    const data = join(dir, "data");
    await mkdir(data);
    if (entry.includes("/")) await mkdir(join(data, "hive"));
    await symlink(outside, join(data, entry));
    await expect(AgentWorkspaceManager.open(data)).rejects.toThrow("Unsafe");
    expect(await readdir(outside)).toEqual([]);
  });

  it("rejects replaced parents and metadata hard links", async () => {
    const { manager, dir, root } = await setup();
    await manager.ensureWorkspace(nova);
    const outside = join(dir, "notes");
    await writeFile(outside, "private");
    await rm(join(root, "memory.md"));
    await link(outside, join(root, "memory.md"));
    await expect(manager.readMetadata("nova", "memory.md")).rejects.toThrow("Unsafe");
    await expect(manager.ensureWorkspace(nova)).rejects.toThrow("Unsafe");
    const elsewhere = join(dir, "elsewhere");
    await mkdir(elsewhere);
    await rm(root, { recursive: true });
    await rm(manager.agentsRoot, { recursive: true });
    await symlink(elsewhere, manager.agentsRoot);
    await expect(manager.ensureWorkspace(nova)).rejects.toThrow("Unsafe");
    expect(await readdir(elsewhere)).toEqual([]);
  });

  it("surfaces filesystem failure and rolls back only pieces created by the failed ensure", async () => {
    const { manager, root } = await setup();
    await mkdir(root);
    await writeFile(join(root, "memory.md"), "keep memory");
    await mkdir(join(root, "agent.md")); // Wrong type makes initialization fail after directories were added.
    await expect(manager.ensureWorkspace(nova)).rejects.toThrow("Unsafe");
    expect(await readdir(root)).toEqual(["agent.md", "memory.md"]);
    expect(await readFile(join(root, "memory.md"), "utf8")).toBe("keep memory");
    await rm(join(root, "agent.md"), { recursive: true });
    await manager.ensureWorkspace(nova);
    expect(await manager.readMetadata("nova", "memory.md")).toBe("keep memory");
  });

  it("rolls back a fresh root when a later initialization step fails", async () => {
    const { manager } = await setup();
    vi.spyOn(manager, "getWorkspacePath").mockRejectedValueOnce(new Error("disk failure"));
    await expect(manager.ensureWorkspace(nova)).rejects.toThrow("disk failure");
    expect(await readdir(manager.agentsRoot)).toEqual([]);
  });
});
