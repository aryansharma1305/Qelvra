import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  symlink,
  link,
  chmod,
  utimes,
} from "node:fs/promises";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WORKSPACE_TEXT_LIMIT, WorkspacePathSchema, ActivityInputSchema } from "@qelvra/shared";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager";
import { WorkspaceFileService } from "../../apps/server/src/files";
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof fs>();
  return { ...actual, rename: vi.fn(actual.rename) };
});
const dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(dirs.splice(0).map((p) => rm(p, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-files-unit-"));
  dirs.push(dir);
  const agents = await AgentRegistry.open({ file: join(dir, "data", "agents.json") });
  const workspaces = await AgentWorkspaceManager.open(join(dir, "data"));
  for (const id of ["nova", "atlas"])
    await workspaces.ensureWorkspace(await agents.create({ id, name: id, role: "Test" }));
  const service = new WorkspaceFileService(agents, workspaces);
  const root = await workspaces.getWorkspacePath("nova");
  return { dir, agents, workspaces, service, root };
}
const unsafe = [
  "../secret",
  "/etc/passwd",
  "a/../../atlas/workspace",
  "a\\..\\secret",
  "%2e%2e/secret",
  "%252e%252e%252fsecret",
  "%2fetc/passwd",
  "file\0.txt",
  "C:/secret",
  "//host/share",
  "./file",
  "a//b",
  "a/",
  ".qelvra-files-tmp-injected",
];
describe("workspace Files path security", () => {
  it.each(unsafe)("rejects %j for all path-taking operations", async (path) => {
    const { service, root } = await setup();
    await writeFile(join(root, "safe.txt"), "safe");
    const file = await service.readText("nova", "safe.txt");
    for (const operation of [
      () => service.list("nova", path),
      () => service.stat("nova", path),
      () => service.readText("nova", path),
      () => service.writeText("nova", { path, content: "no", revision: file.revision }),
      () => service.create("nova", path),
      () => service.create("nova", path, true),
      () => service.move("nova", "safe.txt", path),
      () => service.move("nova", path, "new.txt"),
      () => service.delete("nova", path, true),
    ])
      await expect(operation()).rejects.toMatchObject({ code: "FILE_INVALID_PATH" });
    expect(await readFile(join(root, "safe.txt"), "utf8")).toBe("safe");
  });
  it("blocks direct/nested/internal symlinks across read, write, create, list, move and delete", async () => {
    const { dir, service, root } = await setup();
    const outside = join(dir, "outside");
    await mkdir(outside);
    await writeFile(join(outside, "secret.txt"), "PRIVATE");
    await symlink(outside, join(root, "escape"));
    await mkdir(join(root, "nested"));
    await symlink(outside, join(root, "nested", "escape"));
    await symlink(join(outside, "secret.txt"), join(root, "leaf.txt"));
    await symlink(join(root, "nested"), join(root, "alias"));
    for (const path of ["escape/secret.txt", "nested/escape/secret.txt", "leaf.txt", "alias"])
      for (const operation of [
        () => service.readText("nova", path),
        () => service.list("nova", path),
        () => service.writeText("nova", { path, content: "no", revision: "0".repeat(64) }),
        () => service.delete("nova", path, true),
        () => service.move("nova", path, "moved"),
      ])
        await expect(operation()).rejects.toMatchObject({ code: "FILE_SYMLINK_ESCAPE" });
    await expect(service.create("nova", "escape/new.txt")).rejects.toMatchObject({
      code: "FILE_SYMLINK_ESCAPE",
    });
    await writeFile(join(root, "safe.txt"), "safe");
    await expect(service.move("nova", "safe.txt", "escape/moved.txt")).rejects.toMatchObject({
      code: "FILE_SYMLINK_ESCAPE",
    });
    expect((await service.list("nova")).entries.find((e) => e.path === "escape")?.type).toBe(
      "unsupported",
    );
    expect(await readFile(join(outside, "secret.txt"), "utf8")).toBe("PRIVATE");
    expect(await readdir(outside)).toEqual(["secret.txt"]);
  });
  it("blocks cross-agent paths, hard links and orphan/deleted agent access", async () => {
    const { service, agents, root, workspaces } = await setup();
    await writeFile(join(root, "nova-secret.txt"), "PRIVATE");
    await expect(service.readText("atlas", "nova-secret.txt")).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
    });
    await expect(
      service.readText("atlas", "../nova/workspace/nova-secret.txt"),
    ).rejects.toMatchObject({ code: "FILE_INVALID_PATH" });
    const atlas = await workspaces.getWorkspacePath("atlas");
    await link(join(root, "nova-secret.txt"), join(atlas, "linked.txt"));
    await expect(service.readText("atlas", "linked.txt")).rejects.toMatchObject({
      code: "FILE_NOT_REGULAR",
    });
    expect((await service.stat("atlas", "linked.txt")).type).toBe("unsupported");
    await agents.delete("atlas");
    await expect(service.list("atlas")).rejects.toMatchObject({ code: "AGENT_NOT_FOUND" });
  });
  it("rechecks replaced workspace/fixed parents and refuses unsafe recursive descendants before deletion", async () => {
    const { dir, service, root } = await setup();
    await mkdir(join(root, "tree"));
    await writeFile(join(root, "tree", "keep.txt"), "keep");
    await symlink(dir, join(root, "tree", "escape"));
    await expect(service.delete("nova", "tree", true)).rejects.toMatchObject({
      code: "FILE_SYMLINK_ESCAPE",
    });
    expect(await readFile(join(root, "tree", "keep.txt"), "utf8")).toBe("keep");
    await rm(root, { recursive: true });
    await symlink(dir, root);
    await expect(service.list("nova")).rejects.toMatchObject({ code: "FILE_READ_FAILED" });
  });
});
describe("workspace Files operations", () => {
  it("lists, reads, saves, creates, moves and deletes without overwrites", async () => {
    const { service, root } = await setup();
    expect((await service.list("nova")).entries).toEqual([]);
    await service.create("nova", "src", true);
    await service.create("nova", "src/hello world.txt");
    const empty = await service.readText("nova", "src/hello world.txt");
    const saved = await service.writeText("nova", {
      ...empty,
      content: "HELLO_QELVRA\n你好",
      path: empty.path,
    });
    expect(saved.content).toBe("HELLO_QELVRA\n你好");
    expect(await readFile(join(root, saved.path), "utf8")).toBe(saved.content);
    await expect(service.create("nova", saved.path)).rejects.toMatchObject({
      code: "FILE_ALREADY_EXISTS",
    });
    await expect(service.create("nova", "missing/file.txt")).rejects.toMatchObject({
      code: "FILE_NOT_FOUND",
    });
    await expect(service.readText("nova", "src")).rejects.toMatchObject({
      code: "FILE_NOT_REGULAR",
    });
    await service.create("nova", "other.txt");
    await expect(service.move("nova", saved.path, "other.txt")).rejects.toMatchObject({
      code: "FILE_ALREADY_EXISTS",
    });
    await expect(service.move("nova", "src", "src/child")).rejects.toMatchObject({
      code: "FILE_INVALID_PATH",
    });
    await service.move("nova", saved.path, "src/renamed.txt");
    await service.move("nova", "src", "renamed");
    expect((await service.list("nova", "renamed")).parentPath).toBe("");
    expect((await service.readText("nova", "renamed/renamed.txt")).content).toBe(saved.content);
    await expect(service.delete("nova", "renamed")).rejects.toMatchObject({
      code: "FILE_DIRECTORY_NOT_EMPTY",
    });
    await service.delete("nova", "renamed/renamed.txt");
    await service.delete("nova", "renamed");
    await service.delete("nova", "other.txt");
    expect((await service.list("nova")).entries).toEqual([]);
    await expect(service.delete("nova", "", true)).rejects.toMatchObject({
      code: "FILE_INVALID_PATH",
    });
    await expect(service.move("nova", "", "elsewhere")).rejects.toMatchObject({
      code: "FILE_INVALID_PATH",
    });
  });
  it("shows dotfiles, deterministic directory-first ordering and 500 entries without recursive loading", async () => {
    const { service, root } = await setup();
    await mkdir(join(root, "z-folder"));
    await mkdir(join(root, "A-folder"));
    await Promise.all(
      Array.from({ length: 500 }, (_, i) =>
        writeFile(join(root, `file-${String(i).padStart(3, "0")}.txt`), "x"),
      ),
    );
    await writeFile(join(root, ".env.example"), "example");
    await writeFile(join(root, "README.md"), "# Readme");
    await writeFile(join(root, ".qelvra-files-tmp-held"), "private temporary");
    const first = await service.list("nova"),
      second = await service.list("nova");
    expect(first.entries).toEqual(second.entries);
    expect(first.entries).toHaveLength(504);
    expect(first.entries.slice(0, 3).map((e) => e.name)).toEqual([
      "A-folder",
      "z-folder",
      ".env.example",
    ]);
    expect(first.hiddenEntries).toBe(1);
  });
  it("rejects binary, invalid UTF-8 and oversized text without decoded garbage", async () => {
    const { service, root } = await setup();
    for (const [name, bytes] of [
      ["binary.bin", Buffer.from([1, 0, 2])],
      ["invalid.txt", Buffer.from([0xc3, 0x28])],
    ] as const) {
      await writeFile(join(root, name), bytes);
      await expect(service.readText("nova", name)).rejects.toMatchObject({ code: "FILE_BINARY" });
      await expect(
        service.writeText("nova", { path: name, content: "overwrite", revision: "0".repeat(64) }),
      ).rejects.toMatchObject({ code: "FILE_BINARY" });
      expect(await readFile(join(root, name))).toEqual(bytes);
    }
    await writeFile(join(root, "large.txt"), Buffer.alloc(WORKSPACE_TEXT_LIMIT + 1, 97));
    await expect(service.readText("nova", "large.txt")).rejects.toMatchObject({
      code: "FILE_TOO_LARGE",
    });
    await service.create("nova", "text.txt");
    const file = await service.readText("nova", "text.txt");
    await expect(
      service.writeText("nova", { ...file, content: "é".repeat(WORKSPACE_TEXT_LIMIT) }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    for (const content of ["\0", "\ud800"])
      await expect(service.writeText("nova", { ...file, content })).rejects.toMatchObject({
        code: "FILE_BINARY",
      });
  });
  it("detects concurrent edits even if timestamps and size are restored; serializes simultaneous saves", async () => {
    const { service, root } = await setup();
    await writeFile(join(root, "a.txt"), "before");
    const file = await service.readText("nova", "a.txt");
    await writeFile(join(root, "a.txt"), "edited");
    await utimes(join(root, "a.txt"), new Date(file.modifiedAt), new Date(file.modifiedAt));
    await expect(service.writeText("nova", { ...file, content: "user" })).rejects.toMatchObject({
      code: "FILE_CHANGED_ON_DISK",
    });
    const next = await service.readText("nova", "a.txt");
    const results = await Promise.allSettled([
      service.writeText("nova", { ...next, content: "first" }),
      service.writeText("nova", { ...next, content: "second" }),
    ]);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected"]);
    expect(await readFile(join(root, "a.txt"), "utf8")).toBe("first");
  });
  it("atomic publication failure preserves original text and removes only its temp file", async () => {
    const { service, root } = await setup();
    await writeFile(join(root, "keep.txt"), "old");
    const file = await service.readText("nova", "keep.txt");
    vi.spyOn(fs, "rename").mockRejectedValueOnce(
      Object.assign(new Error("private disk details"), { code: "EIO" }),
    );
    await expect(service.writeText("nova", { ...file, content: "new" })).rejects.toMatchObject({
      code: "FILE_WRITE_FAILED",
    });
    expect(await readFile(join(root, "keep.txt"), "utf8")).toBe("old");
    expect(await readdir(root)).toEqual(["keep.txt"]);
  });
  it("respects read-only files and keeps normal permissions on atomic save", async () => {
    const { service, root } = await setup();
    await writeFile(join(root, "read-only.txt"), "keep");
    await chmod(join(root, "read-only.txt"), 0o400);
    const file = await service.readText("nova", "read-only.txt");
    await expect(service.writeText("nova", { ...file, content: "no" })).rejects.toMatchObject({
      code: "FILE_WRITE_FAILED",
    });
    expect(await readFile(join(root, "read-only.txt"), "utf8")).toBe("keep");
  });
  it("bounds recursive deletion and rejects file contents/absolute paths in file Activity", async () => {
    const { service, root } = await setup();
    await mkdir(join(root, "tree"));
    await mkdir(join(root, "tree", "nested"));
    await writeFile(join(root, "tree", "nested", "x"), "x");
    await service.delete("nova", "tree", true);
    expect(await readdir(root)).toEqual([]);
    const event = {
      type: "file.updated",
      entity: { type: "agent", id: "nova" },
      metadata: { agentId: "nova", relativePath: "src/main.ts" },
    };
    expect(ActivityInputSchema.safeParse(event).success).toBe(true);
    expect(
      ActivityInputSchema.safeParse({
        ...event,
        metadata: { ...event.metadata, content: "PRIVATE" },
      }).success,
    ).toBe(false);
    expect(
      ActivityInputSchema.safeParse({
        ...event,
        metadata: { ...event.metadata, relativePath: "/etc/passwd" },
      }).success,
    ).toBe(false);
    for (const path of [".env.example", "README.md", "package.json", "name with spaces.txt"])
      expect(WorkspacePathSchema.safeParse(path).success).toBe(true);
  });
});
