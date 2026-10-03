import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, mkdir, open, realpath, rmdir, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { AgentIdSchema, type Agent } from "@qelvra/shared";
import { syncDirectory } from "../lib/atomic-publish.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";

function inside(root: string, path: string): boolean {
  const rel = relative(root, path);
  return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

/** Server-owned layout only. No caller-supplied paths, recursive removal or file overwrite. */
export class AgentWorkspaceManager {
  private readonly queues = new Map<string, Promise<unknown>>();

  private constructor(
    readonly dataDir: string,
    readonly hiveRoot: string,
    readonly agentsRoot: string,
    private readonly logger: ServiceLogger,
  ) {}

  static async open(dataDir: string, logger: ServiceLogger = silentLogger) {
    await mkdir(resolve(dataDir), { recursive: true, mode: 0o700 });
    // DATA_DIR itself is a trusted server configuration; anchor subsequent checks to it.
    const root = await realpath(resolve(dataDir));
    for (const path of [join(root, "hive"), join(root, "hive", "agents")]) {
      try {
        await mkdir(path, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const stat = await lstat(path);
      if (!stat.isDirectory() || stat.isSymbolicLink() || !inside(root, await realpath(path))) {
        throw new Error("Unsafe agent workspace parent");
      }
    }
    return new AgentWorkspaceManager(
      root,
      join(root, "hive"),
      join(root, "hive", "agents"),
      logger,
    );
  }

  async getAgentsPath(): Promise<string> {
    await this.check(this.hiveRoot, "directory");
    await this.check(this.agentsRoot, "directory");
    return realpath(this.agentsRoot);
  }

  relativePath(agentId: string): string {
    this.agentRoot(agentId);
    return `hive/agents/${agentId}/workspace`;
  }

  /** Returns a validated existing cwd. Every fixed parent and leaf is checked afresh. */
  async getWorkspacePath(agentId: string): Promise<string> {
    const root = this.agentRoot(agentId);
    for (const path of [this.hiveRoot, this.agentsRoot, root, join(root, "workspace")]) {
      await this.check(path, "directory");
    }
    return realpath(join(root, "workspace"));
  }

  /** Fixed mailbox locations only; no message semantics or caller-supplied paths. */
  async getMailboxPath(agentId: string, box: "inbox" | "outbox"): Promise<string> {
    if (box !== "inbox" && box !== "outbox") throw new Error("Invalid mailbox box");
    const root = this.agentRoot(agentId);
    for (const path of [this.hiveRoot, this.agentsRoot, root, join(root, box)]) {
      await this.check(path, "directory");
    }
    return realpath(join(root, box));
  }

  /** Server-generated quarantine locations; never takes an original message filename. */
  async createQuarantineDirectory(agentId: string): Promise<string> {
    this.agentRoot(agentId); // Reuse the canonical agent-id/device-name checks.
    await this.check(this.hiveRoot, "directory");
    const root = join(this.hiveRoot, "quarantine");
    const sender = join(root, agentId);
    for (const path of [root, sender]) {
      try {
        await mkdir(path, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      await this.check(path, "directory");
      await syncDirectory(path === root ? this.hiveRoot : root);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const path = join(sender, randomUUID());
      try {
        await mkdir(path, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
        throw error;
      }
      await this.check(path, "directory");
      await syncDirectory(sender);
      return path;
    }
    throw new Error("Quarantine directory collision");
  }

  async checkQuarantineDirectory(agentId: string, directory: string): Promise<void> {
    this.agentRoot(agentId);
    const root = join(this.hiveRoot, "quarantine");
    const sender = join(root, agentId);
    if (
      !inside(sender, directory) ||
      relative(sender, directory).includes(sep) ||
      directory === sender
    ) {
      throw new Error("Unsafe quarantine path");
    }
    for (const path of [this.hiveRoot, root, sender, directory])
      await this.check(path, "directory");
  }

  async exists(agentId: string): Promise<boolean> {
    try {
      await this.getWorkspacePath(agentId);
      return true;
    } catch (error) {
      if (missing(error)) return false;
      throw error;
    }
  }

  /** Creates only missing pieces; concurrent calls for one id share a serial queue. */
  ensureWorkspace(agent: Pick<Agent, "id" | "name" | "role">): Promise<string> {
    const root = this.agentRoot(agent.id);
    const previous = this.queues.get(agent.id) ?? Promise.resolve();
    const result = previous.then(
      () => this.ensure(agent, root),
      () => this.ensure(agent, root),
    );
    const tail = result.catch(() => undefined);
    this.queues.set(agent.id, tail);
    void tail.then(() => {
      if (this.queues.get(agent.id) === tail) this.queues.delete(agent.id);
    });
    return result;
  }

  /** Only the two fixed metadata files can be read; symlinks and hard links are refused. */
  async readMetadata(agentId: string, file: "agent.md" | "memory.md"): Promise<string> {
    if (file !== "agent.md" && file !== "memory.md") throw new Error("Invalid metadata file");
    await this.getWorkspacePath(agentId);
    const path = join(this.agentRoot(agentId), file);
    await this.check(path, "file");
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.nlink !== 1) throw new Error("Unsafe workspace metadata");
      return await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  }

  private agentRoot(agentId: string): string {
    const id = AgentIdSchema.parse(agentId);
    // Device names have special semantics on Windows even without separators.
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id)) throw new Error("Unsafe agent id");
    const path = resolve(this.agentsRoot, id);
    if (!inside(this.agentsRoot, path)) throw new Error("Unsafe agent workspace path");
    return path;
  }

  private async check(path: string, kind: "directory" | "file") {
    const stat = await lstat(path);
    if (
      stat.isSymbolicLink() ||
      (kind === "directory" ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1) ||
      !inside(this.hiveRoot, await realpath(path))
    ) {
      throw new Error("Unsafe agent workspace entry");
    }
    return stat;
  }

  private async ensure(agent: Pick<Agent, "id" | "name" | "role">, root: string): Promise<string> {
    const created: { path: string; directory: boolean; ino: number; dev: number }[] = [];
    try {
      await this.check(this.hiveRoot, "directory");
      await this.check(this.agentsRoot, "directory");
      for (const path of [
        root,
        ...["inbox", "outbox", "workspace"].map((name) => join(root, name)),
      ]) {
        let added = false;
        try {
          await mkdir(path, { mode: 0o700 });
          added = true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
        const stat = await this.check(path, "directory");
        if (added) created.push({ path, directory: true, ino: stat.ino, dev: stat.dev });
      }
      const files = {
        "agent.md": `# Agent\n\nName: ${agent.name}\nRole: ${agent.role}\nID: ${agent.id}\n\n## Workspace\n\nYour working directory is workspace/.\n\n## Communication\n\nIncoming messages will appear in inbox/.\nOutgoing messages should be written to outbox/.\n\n## Memory\n\nPersistent agent notes belong in memory.md.\n`,
        "memory.md": "# Agent Memory\n\nNo persistent notes yet.\n",
      };
      for (const [name, content] of Object.entries(files)) {
        const path = join(root, name);
        await this.getWorkspacePath(agent.id);
        let handle;
        try {
          handle = await open(
            path,
            constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
            0o600,
          );
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          await this.check(path, "file");
          continue;
        }
        try {
          const stat = await handle.stat();
          created.push({ path, directory: false, ino: stat.ino, dev: stat.dev });
          await handle.writeFile(content, "utf8");
        } finally {
          await handle.close();
        }
        await this.check(path, "file");
      }
      const cwd = await this.getWorkspacePath(agent.id);
      this.logger.info(
        { event: created.length ? "workspace.created" : "workspace.ensured", agentId: agent.id },
        "Agent workspace ensured",
      );
      return cwd;
    } catch (error) {
      // Undo our new pieces only. rmdir refuses nonempty directories; never rm -rf.
      const rollbackErrors: unknown[] = [];
      for (const entry of created.reverse()) {
        try {
          await this.check(this.hiveRoot, "directory");
          await this.check(this.agentsRoot, "directory");
          if (entry.path !== root) await this.check(root, "directory");
          const stat = await this.check(entry.path, entry.directory ? "directory" : "file");
          if (stat.ino !== entry.ino || stat.dev !== entry.dev)
            throw new Error("Workspace changed during rollback", { cause: error });
          if (entry.directory) await rmdir(entry.path);
          else await unlink(entry.path);
        } catch (cleanupError) {
          if (!missing(cleanupError)) rollbackErrors.push(cleanupError);
        }
      }
      this.logger.error(
        { event: "workspace.creation_failed", agentId: agent.id, err: error, rollbackErrors },
        "Agent workspace initialization failed",
      );
      if (rollbackErrors.length)
        throw new AggregateError([error, ...rollbackErrors], "Workspace rollback failed", {
          cause: error,
        });
      throw error;
    }
  }
}
