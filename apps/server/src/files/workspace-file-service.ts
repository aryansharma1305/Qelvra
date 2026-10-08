import { createHash, randomUUID } from "node:crypto";
import { constants, type Stats } from "node:fs";
import { access, open, readdir, lstat, mkdir, link, rename, rmdir, unlink } from "node:fs/promises";
import { basename, dirname, join, posix } from "node:path";
import {
  WORKSPACE_TEXT_LIMIT,
  WORKSPACE_ENTRY_LIMIT,
  isWorkspacePath,
  type WorkspaceEntry,
  type WorkspaceFile,
  type WorkspaceWriteRequest,
} from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";

function hasBinaryControls(text: string) {
  for (let i = 0; i < text.length; i++) {
    const value = text.charCodeAt(i);
    if (value === 127 || (value < 32 && ![9, 10, 12, 13].includes(value))) return true;
  }
  return false;
}
function entry(path: string, info: Stats): WorkspaceEntry {
  return {
    path,
    name: basename(path) || "workspace",
    size: info.size,
    modifiedAt: info.mtime.toISOString(),
    type:
      info.isSymbolicLink() || (!info.isDirectory() && (!info.isFile() || info.nlink !== 1))
        ? "unsupported"
        : info.isDirectory()
          ? "directory"
          : "file",
  };
}
const revision = (info: Stats, bytes: Buffer) =>
  createHash("sha256")
    .update(JSON.stringify([info.dev, info.ino, info.size, info.mtimeMs, info.ctimeMs, info.mode]))
    .update(bytes)
    .digest("hex");
const code = (error: unknown) => (error as NodeJS.ErrnoException).code;

/** Narrow workspace operations, serialized per agent. No provider writes or global paths. */
export class WorkspaceFileService {
  private queues = new Map<string, Promise<unknown>>();
  constructor(
    private agents: AgentRegistry,
    private workspaces: AgentWorkspaceManager,
    private activity?: ActivityPublisher,
    private logger: ServiceLogger = silentLogger,
  ) {}
  private run<T>(
    agentId: string,
    operation: string,
    relativePath: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const next = (this.queues.get(agentId) ?? Promise.resolve()).then(async () => {
      try {
        if (!this.agents.get(agentId))
          throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found");
        const result = await work();
        this.logger.debug(
          { agentId, operation, relativePath },
          "Workspace file operation completed",
        );
        return result;
      } catch (error) {
        const failure =
          error instanceof AppError
            ? error
            : new AppError(
                code(error) === "ENOENT" ? 404 : code(error) === "EEXIST" ? 409 : 500,
                code(error) === "ENOENT"
                  ? "FILE_NOT_FOUND"
                  : code(error) === "EEXIST"
                    ? "FILE_ALREADY_EXISTS"
                    : operation === "delete"
                      ? "FILE_DELETE_FAILED"
                      : operation === "move"
                        ? "FILE_MOVE_FAILED"
                        : ["list", "read", "stat"].includes(operation)
                          ? "FILE_READ_FAILED"
                          : "FILE_WRITE_FAILED",
                code(error) === "ENOENT"
                  ? "File or parent folder not found"
                  : code(error) === "EEXIST"
                    ? "An entry already exists at that path"
                    : "Could not complete the file operation. Check host permissions and refresh.",
              );
        this.logger.warn(
          {
            agentId,
            operation,
            relativePath: isWorkspacePath(relativePath, true) ? relativePath : undefined,
            errorCode: failure.code,
          },
          "Workspace file operation failed",
        );
        throw failure;
      }
    });
    const tail = next.catch(() => undefined);
    this.queues.set(agentId, tail);
    void tail.then(() => {
      if (this.queues.get(agentId) === tail) this.queues.delete(agentId);
    });
    return next;
  }
  private async event(
    agentId: string,
    relativePath: string,
    type: "file.created" | "file.updated" | "file.renamed" | "file.deleted",
    previousPath?: string,
  ) {
    await this.activity?.publish({
      type,
      actor: { type: "user" },
      entity: { type: "agent", id: agentId },
      metadata: { agentId, relativePath, ...(previousPath ? { previousPath } : {}) },
    });
  }
  list(agentId: string, path = "") {
    return this.run(agentId, "list", path, async () => {
      const target = await this.workspaces.resolveEntry(agentId, path);
      if (!target.info?.isDirectory())
        throw new AppError(400, "FILE_NOT_REGULAR", "Choose a directory");
      const directory = await open(
        target.path,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        if (!(await directory.stat()).isDirectory())
          throw new AppError(400, "FILE_NOT_REGULAR", "Choose a directory");
      } finally {
        await directory.close();
      }
      const names = await readdir(target.path);
      if (names.length > WORKSPACE_ENTRY_LIMIT)
        throw new AppError(
          413,
          "FILE_DIRECTORY_TOO_LARGE",
          "Folder exceeds the 2,000-entry listing limit",
        );
      const entries: WorkspaceEntry[] = [];
      let hiddenEntries = 0;
      for (const name of names) {
        const child = path ? `${path}/${name}` : name;
        if (!isWorkspacePath(child)) {
          hiddenEntries++;
          continue;
        }
        try {
          entries.push(entry(child, await lstat(join(target.path, name))));
        } catch (error) {
          if (code(error) !== "ENOENT") throw error;
        }
      }
      await this.workspaces.resolveEntry(agentId, path);
      entries.sort(
        (a, b) =>
          Number(b.type === "directory") - Number(a.type === "directory") ||
          a.name.toLowerCase().localeCompare(b.name.toLowerCase(), "en") ||
          a.name.localeCompare(b.name, "en"),
      );
      return {
        path,
        parentPath: path ? (posix.dirname(path) === "." ? "" : posix.dirname(path)) : null,
        entries,
        hiddenEntries,
      };
    });
  }
  stat(agentId: string, path: string) {
    return this.run(agentId, "stat", path, async () => {
      const target = await this.workspaces.resolveEntry(agentId, path, false, true);
      if (!target.info) throw new AppError(404, "FILE_NOT_FOUND", "File not found");
      return entry(path, target.info);
    });
  }
  private async read(agentId: string, path: string): Promise<WorkspaceFile> {
    const target = await this.workspaces.resolveEntry(agentId, path);
    if (!target.info?.isFile())
      throw new AppError(400, "FILE_NOT_REGULAR", "Choose a regular text file");
    if (target.info.size > WORKSPACE_TEXT_LIMIT)
      throw new AppError(413, "FILE_TOO_LARGE", "File exceeds the 1 MiB editor limit");
    const handle = await open(
      target.path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1)
        throw new AppError(400, "FILE_NOT_REGULAR", "Choose a regular text file");
      if (info.size > WORKSPACE_TEXT_LIMIT)
        throw new AppError(413, "FILE_TOO_LARGE", "File exceeds the 1 MiB editor limit");
      const buffer = Buffer.alloc(WORKSPACE_TEXT_LIMIT + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
        if (!bytesRead) break;
        length += bytesRead;
      }
      if (length > WORKSPACE_TEXT_LIMIT)
        throw new AppError(413, "FILE_TOO_LARGE", "File exceeds the 1 MiB editor limit");
      const after = await handle.stat();
      if (
        info.size !== after.size ||
        info.mtimeMs !== after.mtimeMs ||
        info.ctimeMs !== after.ctimeMs
      )
        throw new AppError(
          409,
          "FILE_CHANGED_ON_DISK",
          "File changed while reading. Refresh and try again.",
        );
      const bytes = buffer.subarray(0, length);
      let content: string;
      try {
        content = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
      } catch {
        throw new AppError(415, "FILE_BINARY", "Binary preview/editing is not supported yet");
      }
      if (hasBinaryControls(content))
        throw new AppError(415, "FILE_BINARY", "Binary preview/editing is not supported yet");
      await this.workspaces.resolveEntry(agentId, path);
      return {
        path,
        size: length,
        modifiedAt: info.mtime.toISOString(),
        content,
        encoding: "utf-8",
        revision: revision(info, bytes),
      };
    } finally {
      await handle.close();
    }
  }
  readText(agentId: string, path: string) {
    return this.run(agentId, "read", path, () => this.read(agentId, path));
  }
  writeText(agentId: string, input: WorkspaceWriteRequest) {
    return this.run(agentId, "write", input.path, async () => {
      if (Buffer.byteLength(input.content, "utf8") > WORKSPACE_TEXT_LIMIT)
        throw new AppError(413, "FILE_TOO_LARGE", "Text exceeds the 1 MiB editor limit");
      if (
        hasBinaryControls(input.content) ||
        new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(
          Buffer.from(input.content),
        ) !== input.content
      )
        throw new AppError(415, "FILE_BINARY", "Only valid UTF-8 text can be saved");
      const original = await this.read(agentId, input.path);
      if (original.revision !== input.revision)
        throw new AppError(
          409,
          "FILE_CHANGED_ON_DISK",
          "File changed on disk. Reload before saving; your edits have been kept.",
        );
      const target = await this.workspaces.resolveEntry(agentId, input.path);
      if (!target.info || !(target.info.mode & 0o222))
        throw new AppError(403, "FILE_WRITE_FAILED", "File is read-only on the host filesystem");
      await access(target.path, constants.W_OK);
      const parent = posix.dirname(input.path) === "." ? "" : posix.dirname(input.path);
      const temp = join(dirname(target.path), `.qelvra-files-tmp-${randomUUID()}`);
      let ownsTemp = false;
      try {
        const handle = await open(
          temp,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          target.info.mode & 0o777,
        );
        ownsTemp = true;
        try {
          await handle.writeFile(input.content, "utf8");
          await handle.sync();
        } finally {
          await handle.close();
        }
        await this.workspaces.resolveEntry(agentId, parent);
        if ((await this.read(agentId, input.path)).revision !== input.revision)
          throw new AppError(
            409,
            "FILE_CHANGED_ON_DISK",
            "File changed on disk. Reload before saving; your edits have been kept.",
          );
        await rename(temp, target.path);
        ownsTemp = false;
      } finally {
        if (ownsTemp) {
          await this.workspaces.resolveEntry(agentId, parent);
          await unlink(temp);
        }
      }
      const file = await this.read(agentId, input.path);
      await this.event(agentId, input.path, "file.updated");
      return file;
    });
  }
  create(agentId: string, path: string, directory = false) {
    return this.run(agentId, "create", path, async () => {
      if (!path) throw new AppError(400, "FILE_INVALID_PATH", "Choose a name inside the workspace");
      const target = await this.workspaces.resolveEntry(agentId, path, true);
      if (target.info)
        throw new AppError(409, "FILE_ALREADY_EXISTS", "An entry already exists at that path");
      if (directory) await mkdir(target.path, { mode: 0o700 });
      else {
        const handle = await open(
          target.path,
          constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
          0o600,
        );
        await handle.close();
      }
      const created = await this.workspaces.resolveEntry(agentId, path);
      await this.event(agentId, path, "file.created");
      if (!created.info)
        throw new AppError(404, "FILE_NOT_FOUND", "Created entry disappeared. Refresh.");
      return entry(path, created.info);
    });
  }
  move(agentId: string, from: string, to: string) {
    return this.run(agentId, "move", from, async () => {
      if (!from || !to)
        throw new AppError(400, "FILE_INVALID_PATH", "Workspace root cannot be moved");
      const source = await this.workspaces.resolveEntry(agentId, from);
      const target = await this.workspaces.resolveEntry(agentId, to, true);
      if (target.info) throw new AppError(409, "FILE_ALREADY_EXISTS", "Destination already exists");
      if (to.startsWith(from + "/"))
        throw new AppError(400, "FILE_INVALID_PATH", "Cannot move a folder inside itself");
      if (source.info?.isDirectory()) {
        await mkdir(target.path, { mode: source.info.mode & 0o777 });
        try {
          await this.workspaces.resolveEntry(agentId, from);
          await this.workspaces.resolveEntry(agentId, to);
          await rename(source.path, target.path);
        } catch (error) {
          await this.workspaces.resolveEntry(agentId, to);
          await rmdir(target.path);
          throw error;
        }
      } else {
        await link(source.path, target.path);
        try {
          await this.workspaces.getWorkspacePath(agentId);
          await unlink(source.path);
        } catch (error) {
          await unlink(target.path);
          throw error;
        }
      }
      const moved = await this.workspaces.resolveEntry(agentId, to);
      await this.event(agentId, to, "file.renamed", from);
      if (!moved.info)
        throw new AppError(404, "FILE_NOT_FOUND", "Moved entry disappeared. Refresh.");
      return entry(to, moved.info);
    });
  }
  delete(agentId: string, path: string, recursive = false) {
    return this.run(agentId, "delete", path, async () => {
      if (!path) throw new AppError(400, "FILE_INVALID_PATH", "Workspace root cannot be deleted");
      const target = await this.workspaces.resolveEntry(agentId, path);
      const removals: { path: string; directory: boolean; ino: number; dev: number }[] = [];
      const scan = async (relative: string, depth: number): Promise<void> => {
        if (depth > 64 || removals.length >= WORKSPACE_ENTRY_LIMIT)
          throw new AppError(
            413,
            "FILE_DIRECTORY_TOO_LARGE",
            "Deletion exceeds the 2,000-entry / 64-level limit",
          );
        const item = await this.workspaces.resolveEntry(agentId, relative);
        if (!item.info) throw new AppError(404, "FILE_NOT_FOUND", "Entry not found");
        removals.push({
          path: relative,
          directory: item.info.isDirectory(),
          ino: item.info.ino,
          dev: item.info.dev,
        });
        if (item.info.isDirectory())
          for (const name of await readdir(item.path)) await scan(`${relative}/${name}`, depth + 1);
      };
      if (target.info?.isDirectory() && !recursive) {
        if ((await readdir(target.path)).length)
          throw new AppError(
            409,
            "FILE_DIRECTORY_NOT_EMPTY",
            "Folder is not empty. Explicit recursive confirmation is required.",
          );
        await rmdir(target.path);
      } else {
        await scan(path, 0);
        for (const removal of removals.reverse()) {
          const current = await this.workspaces.resolveEntry(agentId, removal.path);
          if (current.info?.ino !== removal.ino || current.info.dev !== removal.dev)
            throw new AppError(
              409,
              "FILE_CHANGED_ON_DISK",
              "Entry changed during deletion. Refresh before retrying.",
            );
          if (removal.directory) await rmdir(current.path);
          else await unlink(current.path);
        }
      }
      await this.event(agentId, path, "file.deleted");
    });
  }
}
