import { mkdtemp, mkdir, rm, writeFile, readFile, symlink, rename, link } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitInspector } from "../../../apps/server/src/projects/git-inspector";
import { ProjectRegistry } from "../../../apps/server/src/projects/project-registry";
import { ProjectStore } from "../../../apps/server/src/projects/project-store";
import { fixtureGit, fixtureRepository, repositorySnapshot } from "../../fixtures/git-repository";
let root: string, data: string, repo: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "qelvra-projects-"));
  data = join(root, "data");
  await mkdir(data);
  repo = await fixtureRepository(join(root, "repo"));
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(root, { recursive: true, force: true });
});
const inspector = () => new GitInspector(data);
describe("read-only Git inspection", () => {
  it("reports real branch and tracked changes without changing any repository file", async () => {
    await fixtureGit(repo, "branch", "feature/ui");
    await writeFile(join(repo, "README.md"), "Staged\n");
    await fixtureGit(repo, "add", "README.md");
    await writeFile(join(repo, "README.md"), "Unstaged\n");
    await writeFile(join(repo, "private-untracked"), "PRIVATE_CONTENT");
    const before = await repositorySnapshot(repo);
    const result = await inspector().inspect(repo);
    expect(result.inspection).toMatchObject({
      state: "available",
      head: { kind: "branch", branch: "main" },
      staged: 1,
      unstaged: 1,
      branches: ["feature/ui", "main"],
      untrackedExcluded: true,
      submodulesExcluded: true,
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE_CONTENT|README\.md|private-untracked/);
    expect(await repositorySnapshot(repo)).toEqual(before);
  });
  it("supports unborn and detached HEAD", async () => {
    const unborn = await fixtureRepository(join(root, "unborn"), false);
    expect((await inspector().inspect(unborn)).inspection).toMatchObject({
      head: { kind: "unborn", branch: "main", commit: null },
    });
    await fixtureGit(repo, "checkout", "--detach");
    expect((await inspector().inspect(repo)).inspection).toMatchObject({
      head: { kind: "detached", branch: null },
    });
  });
  it.each([
    "core.fsmonitor",
    "filter.private.clean",
    "core.hooksPath",
    "include.path",
    "extensions.worktreeConfig",
    "core.sshCommand",
    "core.worktree",
  ])("fails closed for unsafe config %s without executing it", async (key) => {
    await fixtureGit(repo, "config", key, join(root, "PRIVATE_HELPER"));
    const before = await repositorySnapshot(repo);
    await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_UNSUPPORTED" });
    expect(await repositorySnapshot(repo)).toEqual(before);
  });
  it("ignores inherited Git config and credential variables", async () => {
    vi.stubEnv("GIT_CONFIG_COUNT", "1");
    vi.stubEnv("GIT_CONFIG_KEY_0", "core.fsmonitor");
    vi.stubEnv("GIT_CONFIG_VALUE_0", "PRIVATE_HELPER");
    vi.stubEnv("GIT_DIR", "/PRIVATE_PATH");
    expect((await inspector().inspect(repo)).inspection.state).toBe("available");
  });
  it("rejects non-absolute, missing and remote paths", async () => {
    for (const path of ["relative", "https://example.invalid/repo", join(root, "missing")])
      await expect(inspector().inspect(path)).rejects.toMatchObject({
        code: "PROJECT_INVALID_PATH",
      });
  });
  it("canonicalizes parent aliases but rejects a selected symlink", async () => {
    await symlink(root, join(root, "alias"));
    expect((await inspector().inspect(join(root, "alias", "repo"))).path).toBe(
      (await inspector().inspect(repo)).path,
    );
    await symlink(repo, join(root, "repo-link"));
    await expect(inspector().inspect(join(root, "repo-link"))).rejects.toMatchObject({
      code: "PROJECT_UNSUPPORTED",
    });
  });
  it("rejects nested repositories, DATA_DIR overlaps and bare repositories", async () => {
    const nested = await fixtureRepository(join(repo, "nested"));
    const insideData = await fixtureRepository(join(data, "repository"));
    await fixtureGit(root, "init", "--bare", join(root, "bare"));
    for (const path of [nested, insideData, join(root, "bare")])
      await expect(inspector().inspect(path)).rejects.toMatchObject({
        code: expect.stringMatching(/PROJECT_(UNSUPPORTED|INVALID_PATH)/),
      });
  });
  it.each(["commondir", "objects/info/alternates", "objects/info/http-alternates"])(
    "rejects alternate metadata %s",
    async (name) => {
      await writeFile(join(repo, ".git", name), "PRIVATE_PATH");
      await expect(inspector().inspect(repo)).rejects.toMatchObject({
        code: "PROJECT_UNSUPPORTED",
      });
    },
  );
  it("rejects linked worktree/submodule Git files and symlink/hardlink metadata", async () => {
    await rm(join(repo, ".git", "HEAD"));
    await symlink(join(root, "outside"), join(repo, ".git", "HEAD"));
    await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_INVALID_PATH" });
    await rm(join(repo, ".git", "HEAD"));
    await writeFile(join(root, "outside"), "ref: refs/heads/main\n");
    await link(join(root, "outside"), join(repo, ".git", "HEAD"));
    await expect(inspector().inspect(repo)).rejects.toMatchObject({
      code: "PROJECT_INSPECTION_LIMIT",
    });
    await rename(join(repo, ".git"), join(root, "moved-git"));
    await writeFile(join(repo, ".git"), "gitdir: ../moved-git\n");
    await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_UNSUPPORTED" });
  });
  it("rejects symlink ancestors of tracked files before reading outside the repository", async () => {
    await mkdir(join(repo, "dir"));
    await writeFile(join(repo, "dir", "file"), "content");
    await fixtureGit(repo, "add", "dir/file");
    await rm(join(repo, "dir"), { recursive: true });
    await symlink(root, join(repo, "dir"));
    await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_UNSUPPORTED" });
  });
  it("accepts tracked symlink leaves without following them", async () => {
    await symlink("/PRIVATE_TARGET", join(repo, "link"));
    await fixtureGit(repo, "add", "link");
    expect((await inspector().inspect(repo)).inspection).toMatchObject({ staged: 1 });
  });
  it("fails on corrupt index, overlarge metadata and invalid HEAD refs", async () => {
    await writeFile(join(repo, ".git", "index"), "INVALID");
    await expect(inspector().inspect(repo)).rejects.toMatchObject({
      code: "PROJECT_INSPECTION_FAILED",
    });
    await writeFile(join(repo, ".git", "index"), Buffer.alloc(8 * 1024 * 1024 + 1));
    await expect(inspector().inspect(repo)).rejects.toMatchObject({
      code: "PROJECT_INSPECTION_LIMIT",
    });
    await writeFile(join(repo, ".git", "HEAD"), "ref: refs/heads/../../outside\n");
    await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_UNSUPPORTED" });
  });
  it("caps overlapping inspections and drains admitted work", async () => {
    const git = inspector();
    const first = git.inspect(repo);
    await expect(git.inspect(repo)).rejects.toMatchObject({ code: "PROJECT_BUSY" });
    await git.drain();
    expect((await first).inspection.state).toBe("available");
  });
  it("fails closed when Git is absent or below 2.39", async () => {
    vi.stubEnv("PATH", "");
    await expect(inspector().inspect(repo)).rejects.toMatchObject({
      code: "PROJECT_GIT_UNAVAILABLE",
    });
    const tools = join(root, "tools");
    await mkdir(tools);
    await writeFile(join(tools, "git"), "#!/bin/sh\necho 'git version 2.38.0'\n", { mode: 0o700 });
    vi.stubEnv("PATH", tools);
    await expect(inspector().inspect(repo)).rejects.toMatchObject({
      code: "PROJECT_GIT_UNAVAILABLE",
    });
  });
  it("terminates timed-out commands before releasing its slot", async () => {
    const tools = join(root, "tools");
    await mkdir(tools);
    await writeFile(join(tools, "git"), "#!/bin/sh\nexec /bin/sleep 30\n", { mode: 0o700 });
    vi.stubEnv("PATH", tools);
    const git = inspector();
    const pending = git.inspect(repo);
    await expect(pending).rejects.toMatchObject({ code: "PROJECT_INSPECTION_LIMIT" });
    await git.drain();
  }, 10000);
});
describe("persistent project registry", () => {
  it("persists IDs and snapshots, rejects duplicates, refreshes, unregisters metadata only", async () => {
    const registry = await ProjectRegistry.open(data);
    const { project } = await registry.register({ name: "App", path: repo });
    const before = await repositorySnapshot(repo);
    await expect(registry.register({ name: "Duplicate", path: repo })).rejects.toMatchObject({
      code: "PROJECT_DUPLICATE",
    });
    await registry.close();
    const restarted = await ProjectRegistry.open(data);
    expect(restarted.get(project.id).project).toEqual(project);
    await writeFile(join(repo, "README.md"), "dirty");
    expect(restarted.get(project.id).project.inspection).toMatchObject({ unstaged: 0 });
    expect((await restarted.refresh(project.id)).project.inspection).toMatchObject({ unstaged: 1 });
    const dirty = await repositorySnapshot(repo);
    await restarted.unregister(project.id);
    expect(restarted.list().projects).toEqual([]);
    expect(await repositorySnapshot(repo)).toEqual(dirty);
    expect(Object.keys(before).length).toBeGreaterThan(0);
    await restarted.close();
    await expect(restarted.register({ name: "App", path: repo })).rejects.toMatchObject({
      code: "PROJECT_BUSY",
    });
  });
  it("records disappeared/replaced repository errors without retargeting a durable ID", async () => {
    const registry = await ProjectRegistry.open(data);
    const { project } = await registry.register({ name: "App", path: repo });
    await rename(repo, join(root, "relocated"));
    expect((await registry.refresh(project.id)).project.inspection).toEqual({
      state: "unavailable",
      code: "PROJECT_INVALID_PATH",
    });
    await fixtureRepository(repo);
    expect((await registry.refresh(project.id)).project.inspection).toEqual({
      state: "unavailable",
      code: "PROJECT_CHANGED",
    });
    await registry.close();
  });
  it("preserves corrupt storage and rolls back memory on failed atomic writes", async () => {
    const file = join(data, "projects.json");
    await writeFile(file, "INVALID");
    await expect(ProjectRegistry.open(data)).rejects.toMatchObject({
      code: "PROJECT_PERSISTENCE_FAILED",
    });
    expect(await readFile(file, "utf8")).toBe("INVALID");
    await rm(file);
    const store = await ProjectStore.open(file, async () => {
      throw new Error("PRIVATE_PATH");
    });
    const normal = await ProjectRegistry.open(data);
    const { project } = await normal.register({ name: "App", path: repo });
    await expect(store.save([project])).rejects.toMatchObject({
      code: "PROJECT_PERSISTENCE_FAILED",
    });
    expect(store.list()).toEqual([]);
    await normal.close();
  });
});

it("bounds empty ref namespaces and stdout, not only branch leaves", async () => {
  for (let group = 0; group < 6; group++)
    for (let child = 0; child < 100; child++)
      await mkdir(join(repo, ".git/refs/heads", `g${group}`, `c${child}`), { recursive: true });
  await expect(inspector().inspect(repo)).rejects.toMatchObject({
    code: "PROJECT_INSPECTION_LIMIT",
  });
  const tools = join(root, "tools");
  await mkdir(tools);
  await writeFile(join(tools, "git"), "#!/bin/sh\nexec /usr/bin/yes PRIVATE_OUTPUT\n", {
    mode: 0o700,
  });
  vi.stubEnv("PATH", tools);
  await expect(inspector().inspect(repo)).rejects.toMatchObject({
    code: "PROJECT_INSPECTION_LIMIT",
  });
});
it("truncates bounded packed branch inspection honestly", async () => {
  const oid = (await fixtureGit(repo, "rev-parse", "HEAD")).stdout.trim();
  await writeFile(
    join(repo, ".git/packed-refs"),
    "# pack-refs with: peeled fully-peeled sorted\n" +
      Array.from(
        { length: 201 },
        (_, i) => `${oid} refs/heads/branch-${String(i).padStart(3, "0")}\n`,
      ).join(""),
  );
  const result = await inspector().inspect(repo);
  expect(result.inspection).toMatchObject({ branchesTruncated: true });
  if (result.inspection.state !== "available") throw new Error("Unavailable");
  expect(result.inspection.branches).toHaveLength(200);
});
it.each(["fanout", "pack"])("rejects static object-store %s links", async (kind) => {
  if (kind === "fanout") await symlink(root, join(repo, ".git/objects/aa"));
  else await symlink(join(root, "outside.pack"), join(repo, ".git/objects/pack/unsafe.pack"));
  await expect(inspector().inspect(repo)).rejects.toMatchObject({ code: "PROJECT_UNSUPPORTED" });
});
