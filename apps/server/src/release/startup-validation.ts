import { AutomationStoreSchema } from "../automations/automation-store.js";
import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { ServerConfig } from "../config/env.js";
import { AgentStoreFileSchema } from "../agents/agent-registry.js";
import { TaskStoreFileSchema } from "../tasks/task-registry.js";
import { ExecutionStoreFileSchema } from "../execution/execution-store.js";
import { OrchestrationStoreFileSchema } from "../orchestration/orchestration-store.js";

export const SNAPSHOT_LOAD_LIMIT = 32 * 1024 * 1024;
export class StartupValidationError extends Error {
  constructor(
    readonly subsystem: string,
    readonly file: string,
    reason: string,
  ) {
    super(
      `${subsystem}: ${file} ${reason}. Existing persistent data was not overwritten. Repair permissions/path or restore a stopped-server backup before restarting.`,
    );
    this.name = "StartupValidationError";
  }
}
const missing = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";
async function directory(path: string, subsystem: string, create: boolean) {
  try {
    if (create) await mkdir(path, { recursive: true, mode: 0o700 });
    const info = await lstat(path);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("unsafe");
    await access(path, constants.R_OK | constants.W_OK | constants.X_OK);
    const probe = join(path, `.qelvra-write-check-${randomUUID()}`);
    const handle = await open(probe, "wx", 0o600);
    try {
      await handle.close();
    } finally {
      await unlink(probe);
    }
  } catch {
    throw new StartupValidationError(subsystem, path, "is not a usable writable real directory");
  }
}
async function readOptional(path: string, subsystem: string) {
  try {
    const handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.nlink !== 1 || info.size > SNAPSHOT_LOAD_LIMIT)
        throw new Error("invalid file");
      await access(path, constants.R_OK | constants.W_OK);
      return await handle.readFile("utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (missing(error)) return null;
    throw new StartupValidationError(
      subsystem,
      path,
      "cannot be read/written as a regular snapshot of at most 32 MiB",
    );
  }
}
/** Validate all authoritative snapshots before any registry recovery can rewrite state. */
export async function validateStartup(config: ServerConfig) {
  await directory(config.dataDir, "DATA_DIR", true);
  await directory(config.workspaceRoot, "workspace root", false);
  const snapshots = [
    {
      file: "automations.json",
      subsystem: "automation store",
      ids: (raw: unknown) => {
        const data = AutomationStoreSchema.parse(raw);
        return [...data.automations.map((a) => a.id), ...data.runs.map((r) => r.id)];
      },
    },
    {
      file: "agents.json",
      subsystem: "agent registry",
      ids: (raw: unknown) => {
        const agents = AgentStoreFileSchema.parse(raw).agents;
        if (agents.some((a) => a.id === "system")) throw new Error("reserved identity");
        return agents.map((a) => a.id);
      },
    },
    {
      file: "tasks.json",
      subsystem: "task registry",
      ids: (raw: unknown) => TaskStoreFileSchema.parse(raw).tasks.map((t) => t.id),
    },
    {
      file: "executions.json",
      subsystem: "execution store",
      ids: (raw: unknown) => ExecutionStoreFileSchema.parse(raw).executions.map((e) => e.id),
    },
    {
      file: "orchestrations.json",
      subsystem: "orchestration store",
      ids: (raw: unknown) => {
        const goals = OrchestrationStoreFileSchema.parse(raw).orchestrations;
        return goals.flatMap((g) => [g.id, ...g.taskIds, ...g.controlTaskIds]);
      },
    },
  ];
  for (const snapshot of snapshots) {
    const file = join(config.dataDir, snapshot.file);
    const text = await readOptional(file, snapshot.subsystem);
    if (text === null) continue;
    try {
      const ids = snapshot.ids(JSON.parse(text));
      if (new Set(ids).size !== ids.length) throw new Error("duplicate identity");
    } catch {
      throw new StartupValidationError(
        snapshot.subsystem,
        file,
        "contains corrupt, invalid or unsupported snapshot data",
      );
    }
  }
  const activity = join(config.dataDir, "events.jsonl");
  try {
    const info = await lstat(activity);
    if (!info.isFile() || info.nlink !== 1 || info.isSymbolicLink()) throw new Error("unsafe");
    await access(activity, constants.R_OK | constants.W_OK);
  } catch (error) {
    if (!missing(error))
      throw new StartupValidationError(
        "activity store",
        activity,
        "is not a usable regular log file",
      );
  }
  // Corrupt activity lines remain recoverable diagnostics under the PR13 contract.
  // Never compact, truncate or overwrite them during preflight.
  const hive = join(config.dataDir, "hive");
  await directory(hive, "hive storage", true);
  await directory(join(hive, "quarantine"), "mailbox quarantine", true);
}
