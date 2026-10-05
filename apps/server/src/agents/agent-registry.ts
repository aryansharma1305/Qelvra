import { readFile } from "node:fs/promises";
import {
  AgentSchema,
  CreateAgentRequestSchema,
  agentIdFromName,
  type Agent,
  type AgentStatus,
  type ProviderId,
} from "@qelvra/shared";
import { z } from "zod";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { AgentError, AgentRegistryLoadError, type AgentErrorCode } from "./errors.js";

/**
 * Allowed lifecycle transitions. Only server code moves an agent between states, driven by
 * AgentRuntimeManager from real process events. An active state can go straight to
 * "stopped" (shell exited cleanly by itself) or "error" (it crashed); "error" can go to
 * "stopping" because a failed stop may have left a process to clean up.
 */
export const AGENT_TRANSITIONS: Readonly<Record<AgentStatus, readonly AgentStatus[]>> = {
  created: ["starting", "stopped"],
  starting: ["running", "stopping", "error"],
  running: ["idle", "working", "stopping", "stopped", "error"],
  idle: ["working", "stopping", "stopped", "error"],
  working: ["idle", "stopping", "stopped", "error"],
  stopping: ["stopped", "error"],
  stopped: ["starting"],
  error: ["starting", "stopping", "stopped"],
};

/** States that mean "no process"; anything else cannot survive a server restart. */
const AT_REST: readonly AgentStatus[] = ["created", "stopped"];

const StoreFileSchema = z.object({
  version: z.literal(1),
  agents: z.array(AgentSchema),
});

export type AgentRegistryEvent =
  | { type: "agent.created"; agent: Agent }
  | { type: "agent.updated"; agent: Agent; previousStatus: AgentStatus; errorCode?: string }
  | { type: "agent.deleted"; agent: Agent };

export interface AgentRegistryOptions {
  /** JSON file holding the registry (written atomically). */
  file: string;
  logger?: ServiceLogger;
  /** Injectable for tests. */
  clock?: () => Date;
}

export interface CreateAgentInput {
  name: string;
  role: string;
  id?: string | undefined;
  providerId?: ProviderId | null | undefined;
}

const FIELD_CODES: Record<string, AgentErrorCode> = {
  id: "AGENT_INVALID_ID",
  name: "AGENT_INVALID_NAME",
  role: "AGENT_INVALID_ROLE",
  providerId: "AGENT_INVALID_PROVIDER",
};

function snapshot(agent: Agent): Agent {
  return Object.freeze({ ...agent });
}

/**
 * The set of known agents: identity, role and server-owned lifecycle state. Transport-
 * independent (no Fastify); persisted to a JSON file; returns frozen snapshots only.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, Agent>();
  private readonly listeners = new Set<(event: AgentRegistryEvent) => void>();
  private writeQueue: Promise<void> = Promise.resolve();
  private lastTimestamp = 0;
  private readonly logger: ServiceLogger;
  private readonly clock: () => Date;

  private constructor(private readonly options: AgentRegistryOptions) {
    this.logger = options.logger ?? silentLogger;
    this.clock = options.clock ?? (() => new Date());
  }

  /** Loads (and validates) the registry file, or starts empty if it does not exist. */
  static async open(options: AgentRegistryOptions): Promise<AgentRegistry> {
    const registry = new AgentRegistry(options);
    await registry.load();
    return registry;
  }

  get file(): string {
    return this.options.file;
  }

  get size(): number {
    return this.agents.size;
  }

  /** All agents, oldest first (ties broken by id), as frozen snapshots. */
  list(): Agent[] {
    return [...this.agents.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map(snapshot);
  }

  get(id: string): Agent | undefined {
    const agent = this.agents.get(id);
    return agent ? snapshot(agent) : undefined;
  }

  require(id: string): Agent {
    const agent = this.get(id);
    if (!agent) throw new AgentError("AGENT_NOT_FOUND", `Agent "${id}" does not exist`);
    return agent;
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    const parsed = CreateAgentRequestSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = String(issue?.path[0] ?? "");
      throw new AgentError(
        FIELD_CODES[field] ?? "AGENT_INVALID_NAME",
        issue?.message ?? "Invalid agent",
      );
    }
    const { name, role } = parsed.data;
    const id = parsed.data.id ?? agentIdFromName(name);
    if (id === "system")
      throw new AgentError(
        "AGENT_INVALID_ID",
        "This id is reserved for the server control mailbox",
      );
    if (!id) {
      throw new AgentError(
        "AGENT_INVALID_NAME",
        "Cannot derive an id from this name; include letters or digits, or provide an id",
      );
    }
    // Check and insert synchronously so concurrent creates cannot both succeed.
    if (this.agents.has(id)) {
      throw new AgentError("AGENT_ALREADY_EXISTS", `An agent with id "${id}" already exists`);
    }

    const now = this.timestamp();
    const agent: Agent = {
      id,
      name,
      role,
      status: "stopped",
      providerId: parsed.data.providerId ?? null,
      createdAt: now,
      updatedAt: now,
    };
    this.agents.set(id, agent);
    await this.persist(() => this.agents.delete(id));

    this.logger.info({ agentId: id }, "Agent created");
    this.emit({ type: "agent.created", agent: snapshot(agent) });
    return snapshot(agent);
  }

  async delete(id: string): Promise<Agent> {
    const agent = this.agents.get(id);
    if (!agent) throw new AgentError("AGENT_NOT_FOUND", `Agent "${id}" does not exist`);
    this.agents.delete(id);
    await this.persist(() => this.agents.set(id, agent));

    this.logger.info({ agentId: id }, "Agent deleted");
    this.emit({ type: "agent.deleted", agent: snapshot(agent) });
    return snapshot(agent);
  }

  /** Server-internal lifecycle change, validated against AGENT_TRANSITIONS. */
  async transition(id: string, to: AgentStatus, errorCode?: string): Promise<Agent> {
    const current = this.agents.get(id);
    if (!current) throw new AgentError("AGENT_NOT_FOUND", `Agent "${id}" does not exist`);
    if (!AGENT_TRANSITIONS[current.status].includes(to)) {
      throw new AgentError(
        "AGENT_INVALID_TRANSITION",
        `Agent "${id}" cannot go from ${current.status} to ${to}`,
      );
    }
    const updated: Agent = { ...current, status: to, updatedAt: this.timestamp() };
    this.agents.set(id, updated);
    await this.persist(() => this.agents.set(id, current));

    this.emit({
      type: "agent.updated",
      agent: snapshot(updated),
      previousStatus: current.status,
      ...(errorCode ? { errorCode } : {}),
    });
    return snapshot(updated);
  }

  /** Lifecycle notifications for in-process consumers (PR 7 wires processes here). */
  subscribe(listener: (event: AgentRegistryEvent) => void): { dispose(): void } {
    this.listeners.add(listener);
    return { dispose: () => void this.listeners.delete(listener) };
  }

  private async load(): Promise<void> {
    let raw: string;
    try {
      raw = await readFile(this.options.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw new AgentRegistryLoadError(`Cannot read agent registry ${this.options.file}`, {
        cause: error,
      });
    }

    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new AgentRegistryLoadError(
        `Agent registry ${this.options.file} is not valid JSON; fix or move it before starting`,
        { cause: error },
      );
    }
    const parsed = StoreFileSchema.safeParse(data);
    if (!parsed.success) {
      throw new AgentRegistryLoadError(
        `Agent registry ${this.options.file} is invalid (${parsed.error.issues[0]?.message ?? "schema"}); fix or move it before starting`,
      );
    }

    for (const stored of parsed.data.agents) {
      if (this.agents.has(stored.id)) {
        throw new AgentRegistryLoadError(
          `Agent registry ${this.options.file} lists "${stored.id}" twice; fix it before starting`,
        );
      }
      // Processes never survive a restart, so runtime states are reset.
      const agent = AT_REST.includes(stored.status)
        ? stored
        : { ...stored, status: "stopped" as const };
      this.agents.set(agent.id, agent);
      this.lastTimestamp = Math.max(this.lastTimestamp, Date.parse(agent.createdAt));
    }
    this.logger.info({ count: this.agents.size, file: this.options.file }, "Agent registry loaded");
  }

  /** Writes the whole registry after a change; undoes the in-memory change if that fails. */
  private persist(rollback: () => void): Promise<void> {
    // Serialize the state at write time, so a rolled-back earlier change is never written.
    const write = this.writeQueue.then(() =>
      writeFileAtomic(
        this.options.file,
        `${JSON.stringify({ version: 1, agents: this.list() }, null, 2)}\n`,
      ),
    );
    this.writeQueue = write.catch(() => undefined);
    return write.catch((error: unknown) => {
      rollback();
      this.logger.error(
        { err: error, file: this.options.file },
        "Failed to persist agent registry",
      );
      throw new AgentError("AGENT_PERSISTENCE_FAILED", "Could not save the agent registry", {
        cause: error,
      });
    });
  }

  /** Strictly increasing ISO timestamps, so creation order is also list order. */
  private timestamp(): string {
    const now = Math.max(this.clock().getTime(), this.lastTimestamp + 1);
    this.lastTimestamp = now;
    return new Date(now).toISOString();
  }

  private emit(event: AgentRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.error({ err: error, event: event.type }, "Agent registry listener threw");
      }
    }
  }
}
