import { constants } from "node:fs";
import {
  access,
  lstat,
  realpath,
  open,
  opendir,
  mkdir,
  mkdtemp,
  writeFile,
  rm,
} from "node:fs/promises";
import { spawn } from "node:child_process";
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { ProjectIdentity, ProjectInspection, ProjectUnavailableCode } from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
const MiB = 1024 * 1024;
async function entriesAtMost(path: string, maximum: number) {
  const entries = [];
  for await (const entry of await opendir(path)) {
    if (entries.length >= maximum) return fail("PROJECT_INSPECTION_LIMIT");
    entries.push(entry);
  }
  return entries;
}
const inside = (root: string, path: string) => {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
};
const fail = (code: ProjectUnavailableCode): never => {
  throw new AppError(
    422,
    code,
    "Repository inspection is unavailable; check the supported path, layout and Git configuration",
  );
};
async function bounded(file: string, limit: number, optional = false): Promise<Buffer | null> {
  try {
    const h = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const s = await h.stat();
      if (!s.isFile() || s.nlink !== 1 || s.size > limit) return fail("PROJECT_INSPECTION_LIMIT");
      const bytes = Buffer.alloc(s.size + 1);
      const { bytesRead } = await h.read(bytes, 0, bytes.length, 0);
      if (bytesRead > s.size) return fail("PROJECT_CHANGED");
      return bytes.subarray(0, bytesRead);
    } finally {
      await h.close();
    }
  } catch (e) {
    if (optional && (e as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (e instanceof AppError) throw e;
    return fail("PROJECT_INVALID_PATH");
  }
}
async function realDirectory(path: string) {
  const s = await lstat(path, { bigint: true });
  if (!s.isDirectory() || s.isSymbolicLink()) return fail("PROJECT_UNSUPPORTED");
  return s;
}
export class GitInspector {
  private git: string | undefined;
  private busy = false;
  private idle: Promise<void> = Promise.resolve();
  constructor(private readonly dataDir: string) {}
  async drain() {
    await this.idle;
  }
  private async executable() {
    if (this.git) return this.git;
    for (const folder of (process.env.PATH ?? "")
      .split(delimiter)
      .filter(isAbsolute)
      .slice(0, 64)) {
      try {
        const path = await realpath(join(folder, process.platform === "win32" ? "git.exe" : "git"));
        const s = await lstat(path);
        if (!s.isFile()) continue;
        await access(path, constants.X_OK);
        this.git = path;
        return path;
      } catch {
        /* Try the next configured trusted tool directory. */
      }
    }
    return fail("PROJECT_GIT_UNAVAILABLE");
  }
  private async command(
    scratch: string,
    args: string[],
    input?: Buffer,
    worktree?: string,
    objects?: string,
  ) {
    const git = await this.executable();
    const env: NodeJS.ProcessEnv = {
      PATH: [dirname(git), "/usr/bin", "/bin"].join(delimiter),
      LANG: "C",
      LC_ALL: "C",
      HOME: scratch,
      TMPDIR: scratch,
      XDG_CONFIG_HOME: scratch,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_SYSTEM: "/dev/null",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_TERMINAL_PROMPT: "0",
      GIT_OPTIONAL_LOCKS: "0",
      GIT_NO_REPLACE_OBJECTS: "1",
      GIT_NO_LAZY_FETCH: "1",
      GIT_ATTR_NOSYSTEM: "1",
      GIT_PAGER: "cat",
    };
    if (worktree) {
      env.GIT_DIR = join(scratch, "git");
      env.GIT_COMMON_DIR = env.GIT_DIR;
      env.GIT_WORK_TREE = worktree;
      env.GIT_OBJECT_DIRECTORY = objects;
    }
    return new Promise<{ code: number; output: string }>((yes, no) => {
      const child = spawn(git, ["--no-pager", "--no-replace-objects", ...args], {
        cwd: scratch,
        env,
        shell: false,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
      });
      let size = 0,
        failure: ProjectUnavailableCode | undefined;
      const chunks: Buffer[] = [];
      const kill = (code: ProjectUnavailableCode) => {
        if (failure) return;
        failure = code;
        try {
          if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* Already exited. */
        }
      };
      const timer = setTimeout(() => kill("PROJECT_INSPECTION_LIMIT"), 5000);
      child.stdout.on("data", (b: Buffer) => {
        size += b.length;
        if (size > 2 * MiB) kill("PROJECT_INSPECTION_LIMIT");
        else chunks.push(b);
      });
      child.stderr.on("data", (b: Buffer) => {
        size += b.length;
        if (size > 2 * MiB) kill("PROJECT_INSPECTION_LIMIT");
      });
      child.stdin.on("error", () => {});
      child.on("error", () => {
        clearTimeout(timer);
        if (!failure) {
          failure = "PROJECT_GIT_UNAVAILABLE";
          no(new AppError(422, "PROJECT_GIT_UNAVAILABLE", "Git is unavailable"));
        }
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        if (failure)
          no(new AppError(422, failure, "Git inspection exceeded its limit or could not finish"));
        else yes({ code: code ?? 1, output: Buffer.concat(chunks).toString("utf8") });
      });
      child.stdin.end(input);
    });
  }
  async location(raw: string, expected?: ProjectIdentity) {
    try {
      if (process.platform === "win32") return fail("PROJECT_UNSUPPORTED");
      if (!isAbsolute(raw)) return fail("PROJECT_INVALID_PATH");
      await realDirectory(resolve(raw));
      const path = await realpath(raw),
        data = await realpath(this.dataDir);
      if (inside(data, path) || inside(path, data)) return fail("PROJECT_UNSUPPORTED");
      const root = await realDirectory(path),
        git = await realDirectory(join(path, ".git"));
      await realDirectory(join(path, ".git", "objects"));
      await realDirectory(join(path, ".git", "refs"));
      for (
        let parent = dirname(path), n = 0;
        parent !== dirname(parent);
        parent = dirname(parent), n++
      ) {
        if (n > 128) return fail("PROJECT_INSPECTION_LIMIT");
        try {
          await lstat(join(parent, ".git"));
          return fail("PROJECT_UNSUPPORTED");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
      for (const name of ["objects/info", "objects/pack"]) {
        try {
          await realDirectory(join(path, ".git", name));
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
      for (const name of ["commondir", "objects/info/alternates", "objects/info/http-alternates"]) {
        try {
          await lstat(join(path, ".git", name));
          return fail("PROJECT_UNSUPPORTED");
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
        }
      }
      const identity = {
        rootDevice: root.dev.toString(),
        rootInode: root.ino.toString(),
        gitDevice: git.dev.toString(),
        gitInode: git.ino.toString(),
      };
      if (expected && JSON.stringify(identity) !== JSON.stringify(expected))
        return fail("PROJECT_CHANGED");
      return { path, identity };
    } catch (e) {
      if (e instanceof AppError) throw e;
      return fail("PROJECT_INVALID_PATH");
    }
  }
  async inspect(
    raw: string,
    expected?: ProjectIdentity,
  ): Promise<{ path: string; identity: ProjectIdentity; inspection: ProjectInspection }> {
    if (this.busy)
      throw new AppError(
        409,
        "PROJECT_BUSY",
        "Another repository inspection is running; retry shortly",
      );
    this.busy = true;
    let done: () => void = () => {};
    this.idle = new Promise((r) => {
      done = r;
    });
    let scratch: string | undefined;
    const deadline = Date.now() + 45000;
    const checkDeadline = () => {
      if (Date.now() > deadline) return fail("PROJECT_INSPECTION_LIMIT");
    };
    try {
      const location = await this.location(raw, expected),
        source = join(location.path, ".git");
      if (inside(location.path, await this.executable())) return fail("PROJECT_GIT_UNAVAILABLE");
      // Git can follow object fanout/pack links even with a sanitized config.
      // Validate every object-store descendant under a finite entry/depth/size budget.
      let objectEntries = 0;
      const objects = async (directory: string, depth: number): Promise<void> => {
        checkDeadline();
        if (depth > 4) return fail("PROJECT_INSPECTION_LIMIT");
        await realDirectory(directory);
        for (const entry of await entriesAtMost(directory, 10000 - objectEntries)) {
          checkDeadline();
          if (++objectEntries > 10000) return fail("PROJECT_INSPECTION_LIMIT");
          const file = join(directory, entry.name);
          const stat = await lstat(file);
          if (stat.isDirectory()) await objects(file, depth + 1);
          else if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1)
            return fail("PROJECT_UNSUPPORTED");
          else if (stat.size > 256 * MiB) return fail("PROJECT_INSPECTION_LIMIT");
        }
      };
      await objects(join(source, "objects"), 0);
      const parent = join(this.dataDir, "project-inspections");
      try {
        await mkdir(parent, { mode: 0o700 });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      }
      // mkdir may have existed from a previous bounded inspection; never follow a replacement.
      await realDirectory(parent);
      await entriesAtMost(parent, 99);
      scratch = await mkdtemp(join(parent, "inspect-"));
      const version = await this.command(scratch, ["--version"]);
      const v = /git version (\d+)\.(\d+)/.exec(version.output);
      if (version.code !== 0 || !v || Number(v[1]) < 2 || (Number(v[1]) === 2 && Number(v[2]) < 39))
        return fail("PROJECT_GIT_UNAVAILABLE");
      const config = await bounded(join(source, "config"), MiB);
      const parsed = await this.command(
        scratch,
        ["config", "--no-includes", "--file=-", "--null", "--list"],
        config ?? Buffer.alloc(0),
      );
      if (parsed.code !== 0) return fail("PROJECT_UNSUPPORTED");
      const settings = new Map<string, string>();
      for (const row of parsed.output.split("\0").filter(Boolean)) {
        const split = row.indexOf("\n"),
          key = (split < 0 ? row : row.slice(0, split)).toLowerCase(),
          value = split < 0 ? "" : row.slice(split + 1);
        if (
          !/^(core\.(repositoryformatversion|bare|filemode|logallrefupdates|ignorecase|precomposeunicode|symlinks)|user\.(name|email)|remote\..+\.(url|fetch|pushurl)|branch\..+\.(remote|merge|rebase))$/.test(
            key,
          )
        )
          return fail("PROJECT_UNSUPPORTED");
        settings.set(key, value);
      }
      if (
        settings.get("core.repositoryformatversion") !== "0" ||
        settings.get("core.bare") !== "false"
      )
        return fail("PROJECT_UNSUPPORTED");
      const dest = join(scratch, "git");
      await mkdir(join(dest, "refs", "heads"), { recursive: true, mode: 0o700 });
      await mkdir(join(dest, "objects"), { mode: 0o700 });
      let authored =
        "[core]\nrepositoryformatversion=0\nbare=false\nlogallrefupdates=false\nfsmonitor=false\nhooksPath=/dev/null\nattributesFile=/dev/null\nexcludesFile=/dev/null\n[protocol]\nallow=never\n";
      for (const key of ["filemode", "ignorecase", "precomposeunicode", "symlinks"]) {
        const value = settings.get("core." + key);
        if (value !== undefined) {
          if (!["true", "false"].includes(value)) return fail("PROJECT_UNSUPPORTED");
          authored += `[core]\n${key}=${value}\n`;
        }
      }
      await writeFile(join(dest, "config"), authored, { mode: 0o600 });
      const head = await bounded(join(source, "HEAD"), 4096);
      if (!head) return fail("PROJECT_UNSUPPORTED");
      if (!/^(ref: refs\/heads\/[^\s]+|[a-f0-9]{40})\n?$/.test(head.toString()))
        return fail("PROJECT_UNSUPPORTED");
      const reference = head
        .toString()
        .trim()
        .replace(/^ref: /, "");
      if (
        reference.startsWith("refs/") &&
        (await this.command(scratch, ["check-ref-format", reference])).code !== 0
      )
        return fail("PROJECT_UNSUPPORTED");
      await writeFile(join(dest, "HEAD"), head, { mode: 0o600 });
      for (const [name, limit] of [
        ["index", 8 * MiB],
        ["packed-refs", MiB],
      ] as const) {
        const bytes = await bounded(join(source, name), limit, true);
        if (bytes) await writeFile(join(dest, name), bytes, { mode: 0o600 });
      }
      let count = 0,
        traversed = 0;
      const refs = async (rel: string, depth: number): Promise<void> => {
        if (depth > 16) return fail("PROJECT_INSPECTION_LIMIT");
        const dir = join(source, "refs", "heads", rel);
        await realDirectory(dir);
        const entries = await entriesAtMost(dir, 200);
        if (entries.length > 200) return fail("PROJECT_INSPECTION_LIMIT");
        for (const entry of entries) {
          checkDeadline();
          if (++traversed > 512) return fail("PROJECT_INSPECTION_LIMIT");
          const name = join(rel, entry.name);
          if (entry.isDirectory()) {
            await mkdir(join(dest, "refs", "heads", name), { mode: 0o700 });
            await refs(name, depth + 1);
          } else {
            if (++count > 200) return fail("PROJECT_INSPECTION_LIMIT");
            const bytes = await bounded(join(dir, entry.name), 4096);
            if (bytes) await writeFile(join(dest, "refs", "heads", name), bytes, { mode: 0o600 });
          }
        }
      };
      try {
        await refs("", 0);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      const cmd = (args: string[]) => {
        checkDeadline();
        return this.command(scratch ?? "", args, undefined, location.path, join(source, "objects"));
      };
      const branch = await cmd(["symbolic-ref", "-q", "HEAD"]),
        commit = await cmd(["rev-parse", "--verify", "HEAD"]);
      const name = branch.code === 0 ? branch.output.trim().replace(/^refs\/heads\//, "") : null,
        oid = commit.code === 0 ? commit.output.trim() : null;
      if (
        (branch.code !== 0 && branch.code !== 1) ||
        (oid !== null && !/^[a-f0-9]{40}$/.test(oid)) ||
        (name !== null && name.length > 1024)
      )
        return fail("PROJECT_INSPECTION_FAILED");
      if (oid === null && name === null) return fail("PROJECT_INSPECTION_FAILED");
      const branches = await cmd([
        "for-each-ref",
        "--count=201",
        "--format=%(refname)",
        "refs/heads/",
      ]);
      // Validate tracked paths before status can read the working tree. Symlink leaves
      // tracked as links are safe; symlink ancestors could redirect reads outside it.
      const tracked = await cmd(["ls-files", "--stage", "-z"]);
      if (tracked.code !== 0) return fail("PROJECT_INSPECTION_FAILED");
      const entries = tracked.output.split("\0").filter(Boolean);
      if (entries.length > 20000) return fail("PROJECT_INSPECTION_LIMIT");
      const checked = new Set<string>();
      for (const row of entries) {
        checkDeadline();
        const match = /^(\d{6}) [a-f0-9]{40} [0-3]\t(.+)$/.exec(row);
        if (!match) return fail("PROJECT_UNSUPPORTED");
        const parts = (match[2] ?? "").split("/");
        if (
          parts.some(
            (p) =>
              !p ||
              p === "." ||
              p === ".." ||
              Array.from(p).some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
          )
        )
          return fail("PROJECT_UNSUPPORTED");
        for (let i = 0; i < parts.length; i++) {
          const file = join(location.path, ...parts.slice(0, i + 1));
          if (checked.has(file)) continue;
          try {
            const stat = await lstat(file);
            if (stat.isSymbolicLink() && (i < parts.length - 1 || match[1] !== "120000"))
              return fail("PROJECT_UNSUPPORTED");
            if (i < parts.length - 1) checked.add(file);
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
            break;
          }
        }
      }
      const status = await cmd([
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=no",
        "--ignore-submodules=all",
        "--no-renames",
      ]);
      if (branches.code !== 0 || status.code !== 0) return fail("PROJECT_INSPECTION_FAILED");
      const names = branches.output
        .split("\n")
        .filter(Boolean)
        .map((v) => v.replace(/^refs\/heads\//, ""));
      if (names.some((v) => v.length > 1024)) return fail("PROJECT_INSPECTION_LIMIT");
      let staged = 0,
        unstaged = 0;
      for (const row of status.output.split("\0").filter(Boolean)) {
        if (row.length < 4 || row[2] !== " ") return fail("PROJECT_INSPECTION_FAILED");
        if (row[0] !== " ") staged++;
        if (row[1] !== " ") unstaged++;
      }
      await this.location(location.path, location.identity);
      return {
        ...location,
        inspection: {
          state: "available",
          head: {
            kind: oid === null ? "unborn" : name === null ? "detached" : "branch",
            branch: name,
            commit: oid,
          },
          staged,
          unstaged,
          branches: names.slice(0, 200),
          branchesTruncated: names.length > 200,
          untrackedExcluded: true,
          submodulesExcluded: true,
        },
      };
    } catch (e) {
      if (e instanceof AppError) throw e;
      return fail("PROJECT_INSPECTION_FAILED");
    } finally {
      try {
        if (scratch) await rm(scratch, { recursive: true, force: true });
      } finally {
        this.busy = false;
        done();
      }
    }
  }
}
