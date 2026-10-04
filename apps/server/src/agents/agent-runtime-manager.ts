import { ProviderRegistry, ProviderError } from "../providers/index.js";
import { randomUUID } from "node:crypto";
import { agentIdFromName, CreateAgentRequestSchema, type Agent } from "@qelvra/shared";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import type { CreateAgentInput } from "./agent-registry.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import type { Disposable, PtyExit, PtyManager, PtySessionInfo } from "../pty/index.js";
import type { AgentRegistry } from "./agent-registry.js";
import { AgentError } from "./errors.js";

/** The PtyManager operations the runtime needs (a narrow seam for test doubles). */
export type AgentPtyHost = Pick<
  PtyManager,
  "createSession" | "terminate" | "has" | "get" | "write" | "resize" | "onData" | "onExit"
>;

export interface AgentRuntimeManagerOptions {
  registry: AgentRegistry;
  workspaces: AgentWorkspaceManager;
  pty: AgentPtyHost;
  logger?: ServiceLogger;
  /** Server configuration only; disabled unless development/test composition enables it. */
  allowFakeProvider?: boolean;
  providers?: ProviderRegistry;
  /** App composition coordinates persistent task cleanup with metadata deletion. */
  deleteAgent?: (id: string) => Promise<Agent>;
  /** Whether a pid still exists; injectable for tests. */
  isProcessAlive?: (pid: number) => boolean;
  /** Successful logical restart; committed status transitions own start/stop events. */
  onRestart?: (agent: Agent) => void;
}

/** A running agent's shell, as seen from outside the manager. */
export interface AgentRuntimeInfo {
  agentId: string;
  sessionId: string;
  pid: number | null;
  startedAt: string;
  /** Whether a terminal viewer is attached. */
  attached: boolean;
}

/** Callbacks for the one terminal viewer an agent may have. */
export interface AgentTerminalViewer {
  onData(data: string): void;
  /** The shell ended (stopped, restarted or exited by itself). Not called after detach(). */
  onExit(exit: PtyExit): void;
  /** Another viewer attached; this one no longer receives anything. */
  onReplaced(): void;
}

export interface AgentTerminalAttachment {
  /** The PTY as it is now (size already set to the viewer's). */
  session: PtySessionInfo;
  write(data: string): void;
  resize(cols: number, rows: number): void;
  /** Stops receiving output. Never stops the agent. */
  detach(): void;
}

interface Runtime {
  agentId: string;
  sessionId: string;
  pid: number | null;
  startedAt: string;
  /** Set by stop() before terminating, so the shell's exit is not reported as a crash. */
  stopping: boolean;
  exitSubscription: Disposable;
  viewer: ViewerSlot | null;
}

interface ViewerSlot {
  viewer: AgentTerminalViewer;
  subscriptions: Disposable[];
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // EPERM: it exists but belongs to someone else (the pid was reused).
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

const ACTIVE_STATUSES = new Set(["starting", "running", "idle", "working", "stopping"]);

/**
 * Owns the live processes of registered agents: at most one PTY per agent. The registry
 * keeps identity and status; PtyManager runs shells; this class connects the two and is
 * the only writer of runtime statuses.
 *
 * Every lifecycle operation for an agent (start, stop, restart, delete, and recording an
 * unexpected exit) runs through that agent's queue, one at a time, so concurrent requests
 * cannot interleave. Different agents never wait on each other.
 */
export class AgentRuntimeManager {
  private readonly registry: AgentRegistry;
  private readonly workspaces: AgentWorkspaceManager;
  private readonly pty: AgentPtyHost;
  private readonly logger: ServiceLogger;
  private readonly onRestart: ((agent: Agent) => void) | undefined;
  private readonly isProcessAlive: (pid: number) => boolean;
  private readonly runtimes = new Map<string, Runtime>();
  private readonly queues = new Map<string, Promise<unknown>>();
  private shuttingDown = false;
  private readonly allowFakeProvider: boolean;
  private readonly providers: ProviderRegistry;
  private readonly deleteAgent: (id: string) => Promise<Agent>;

  constructor(options: AgentRuntimeManagerOptions) {
    this.allowFakeProvider = options.allowFakeProvider ?? false;
    this.providers =
      options.providers ?? new ProviderRegistry({ allowFake: this.allowFakeProvider });
    this.registry = options.registry;
    this.deleteAgent = options.deleteAgent ?? ((id) => this.registry.delete(id));
    this.workspaces = options.workspaces;
    this.pty = options.pty;
    this.logger = options.logger ?? silentLogger;
    this.onRestart = options.onRestart;
    this.isProcessAlive = options.isProcessAlive ?? defaultIsProcessAlive;
  }

  /** Number of agents with a live shell. */
  get size(): number {
    return this.runtimes.size;
  }

  get(agentId: string): AgentRuntimeInfo | undefined {
    const runtime = this.runtimes.get(agentId);
    return runtime && this.describe(runtime);
  }

  list(): AgentRuntimeInfo[] {
    return [...this.runtimes.values()].map((runtime) => this.describe(runtime));
  }

  /** Coordinates creation with starts/deletes so no shell observes a partial workspace. */
  create(input: CreateAgentInput): Promise<Agent> {
    const parsed = CreateAgentRequestSchema.parse(input);
    if (parsed.providerId === "fake" && !this.allowFakeProvider)
      throw new AgentError("AGENT_INVALID_PROVIDER", "Demo agents are disabled in production");
    const id = parsed.id ?? agentIdFromName(parsed.name);
    if (!id) throw new AgentError("AGENT_INVALID_NAME", "Cannot derive an agent id from this name");
    return this.enqueue(id, async () => {
      const agent = await this.registry.create(parsed);
      try {
        await this.workspaces.ensureWorkspace(agent);
        return agent;
      } catch (error) {
        try {
          await this.deleteAgent(agent.id);
        } catch (rollbackError) {
          this.logger.error(
            { agentId: agent.id, err: rollbackError },
            "Agent creation rollback failed",
          );
          throw new AggregateError([error, rollbackError], "Agent creation rollback failed", {
            cause: rollbackError,
          });
        }
        throw error;
      }
    });
  }

  /** Starts the agent's shell. AGENT_ALREADY_RUNNING if it has one. */
  start(agentId: string): Promise<Agent> {
    return this.enqueue(agentId, () => this.doStart(agentId));
  }

  /** Stops the agent's shell and everything it started. A stopped agent is left as is. */
  stop(agentId: string): Promise<Agent> {
    return this.enqueue(agentId, () => this.doStop(agentId));
  }

  /** Stops the shell completely, then starts a fresh one (a stopped agent just starts). */
  restart(agentId: string): Promise<Agent> {
    return this.enqueue(agentId, async () => {
      await this.doStop(agentId);
      const agent = await this.doStart(agentId);
      try {
        this.onRestart?.(agent);
      } catch {
        this.logger.warn({ errorCode: "ACTIVITY_SUBSCRIBER_FAILED" }, "Restart observer failed");
      }
      return agent;
    });
  }

  /** Stops the agent if it runs, then removes it. If stopping fails, the record stays. */
  delete(agentId: string): Promise<Agent> {
    return this.enqueue(agentId, async () => {
      await this.doStop(agentId);
      return this.deleteAgent(agentId);
    });
  }

  /**
   * Server shutdown: refuses new starts, then stops every agent after any operation
   * already in flight for it (so a restart cannot spawn a shell behind our back).
   */
  async stopAll(): Promise<void> {
    this.shuttingDown = true;
    const ids = new Set([...this.runtimes.keys(), ...this.queues.keys()]);
    if (ids.size === 0) return;
    this.logger.info({ count: ids.size }, "Stopping all agents");
    await Promise.all(
      [...ids].map((id) =>
        this.stop(id).catch((error: unknown) =>
          this.logger.error({ err: error, agentId: id }, "Failed to stop agent on shutdown"),
        ),
      ),
    );
  }

  /**
   * Connects a terminal viewer to a running agent. One viewer per agent: a new one
   * replaces the previous. Output from before attaching is not replayed.
   */
  attach(
    agentId: string,
    viewer: AgentTerminalViewer,
    size?: { cols: number; rows: number },
  ): AgentTerminalAttachment {
    this.registry.require(agentId); // AGENT_NOT_FOUND
    const runtime = this.runtimes.get(agentId);
    if (!runtime || runtime.stopping || !this.pty.has(runtime.sessionId)) {
      throw new AgentError("AGENT_NOT_RUNNING", `Agent "${agentId}" is not running`);
    }
    if (size) this.pty.resize(runtime.sessionId, size.cols, size.rows);

    const previous = runtime.viewer;
    if (previous) {
      this.releaseViewer(runtime, previous);
      previous.viewer.onReplaced();
    }

    const slot: ViewerSlot = { viewer, subscriptions: [] };
    slot.subscriptions.push(
      this.pty.onData(runtime.sessionId, (data) => viewer.onData(data)),
      this.pty.onExit(runtime.sessionId, (exit) => {
        if (runtime.viewer !== slot) return;
        this.releaseViewer(runtime, slot);
        viewer.onExit(exit);
      }),
    );
    runtime.viewer = slot;

    const session = this.pty.get(runtime.sessionId);
    if (!session) throw new AgentError("AGENT_NOT_RUNNING", `Agent "${agentId}" is not running`);
    const current = () => {
      if (runtime.viewer !== slot) {
        throw new AgentError("AGENT_NOT_RUNNING", "This terminal is no longer attached");
      }
      return runtime.sessionId;
    };
    return {
      session,
      write: (data) => this.pty.write(current(), data),
      resize: (cols, rows) => this.pty.resize(current(), cols, rows),
      detach: () => {
        if (runtime.viewer === slot) this.releaseViewer(runtime, slot);
      },
    };
  }

  private async doStart(agentId: string): Promise<Agent> {
    const agent = this.registry.require(agentId);
    if (this.runtimes.has(agentId)) {
      throw new AgentError("AGENT_ALREADY_RUNNING", `Agent "${agentId}" is already running`);
    }
    if (this.shuttingDown) {
      throw new AgentError("AGENT_START_FAILED", "The server is shutting down");
    }
    if (ACTIVE_STATUSES.has(agent.status)) {
      // No shell but an active status: only possible after a crash mid-operation.
      this.logger.warn({ agentId, status: agent.status }, "Agent had no shell; resetting");
      await this.settle(agentId, "stopped");
    }

    await this.registry.transition(agentId, "starting");
    // A fresh session id per start: a restart never touches the previous session.
    const sessionId = `agent-${randomUUID()}`;
    let session: PtySessionInfo;
    try {
      const cwd = await this.workspaces.ensureWorkspace(agent);
      const command = await this.providers.resolve(agent, cwd, this.workspaces.dataDir);
      try {
        session = this.pty.createSession({ id: sessionId, cwd: command.cwd, command });
      } catch {
        if (agent.providerId === null || agent.providerId === "shell")
          throw new AgentError("AGENT_START_FAILED", `Could not start a shell for "${agentId}"`);
        throw new ProviderError(
          "PROVIDER_LAUNCH_FAILED",
          "The provider could not start. Check its installation and try again.",
        );
      }
    } catch (error) {
      const errorCode = error instanceof ProviderError ? error.code : "AGENT_START_FAILED";
      this.logger.error(
        { errorCode, agentId, providerId: agent.providerId ?? "shell" },
        "Agent provider failed to start",
      );
      await this.registry.transition(agentId, "error", errorCode);
      if (error instanceof ProviderError) throw error;
      throw new AgentError("AGENT_START_FAILED", `Could not start a shell for "${agentId}"`, {
        cause: error,
      });
    }

    const runtime: Runtime = {
      agentId,
      sessionId,
      pid: session.pid,
      startedAt: new Date().toISOString(),
      stopping: false,
      exitSubscription: { dispose: () => undefined },
      viewer: null,
    };
    runtime.exitSubscription = this.pty.onExit(sessionId, (exit) => {
      if (!runtime.stopping) {
        // Recorded through the queue so it cannot interleave with a stop or restart.
        void this.enqueue(agentId, () => this.recordExit(runtime, exit)).catch((error: unknown) =>
          this.logger.error({ err: error, agentId }, "Failed to record agent exit"),
        );
      }
    });
    this.runtimes.set(agentId, runtime);

    try {
      const running = await this.registry.transition(agentId, "running");
      this.logger.info({ agentId, sessionId, pid: session.pid }, "Agent started");
      return running;
    } catch (error) {
      // The status could not be saved: do not leave an untracked shell behind.
      await this.terminateRuntime(runtime).catch(() => undefined);
      throw error;
    }
  }

  private async doStop(agentId: string): Promise<Agent> {
    const agent = this.registry.require(agentId);
    const runtime = this.runtimes.get(agentId);
    if (!runtime) {
      // Nothing to kill. Settle a leftover active or error status; stopped stays stopped.
      return agent.status === "stopped" || agent.status === "created"
        ? agent
        : this.settle(agentId, "stopped");
    }

    runtime.stopping = true;
    await this.registry.transition(agentId, "stopping");
    try {
      await this.terminateRuntime(runtime);
    } catch (error) {
      runtime.stopping = false; // keep the runtime so a later stop can retry
      this.logger.error({ err: error, agentId, pid: runtime.pid }, "Agent shell did not stop");
      await this.registry.transition(agentId, "error");
      throw new AgentError("AGENT_STOP_FAILED", `Could not stop "${agentId}"`, { cause: error });
    }
    const stopped = await this.registry.transition(agentId, "stopped");
    this.logger.info({ agentId }, "Agent stopped");
    return stopped;
  }

  /** Terminates the PTY, verifies the shell is gone, then forgets the runtime. */
  private async terminateRuntime(runtime: Runtime): Promise<void> {
    await this.pty.terminate(runtime.sessionId);
    if (runtime.pid !== null && this.isProcessAlive(runtime.pid)) {
      throw new Error(`Shell process ${runtime.pid} is still alive after termination`);
    }
    this.forget(runtime);
  }

  /** The shell exited without stop(): a clean exit is "stopped", anything else "error". */
  private async recordExit(runtime: Runtime, exit: PtyExit): Promise<void> {
    if (this.runtimes.get(runtime.agentId) !== runtime) return; // already handled by stop
    this.forget(runtime);
    const status = exit.exitCode === 0 && !exit.signal ? "stopped" : "error";
    this.logger.info({ agentId: runtime.agentId, ...exit, status }, "Agent shell exited");
    if (this.registry.get(runtime.agentId)) await this.settle(runtime.agentId, status);
  }

  /** Moves an agent to a resting status, via "stopping" when the state machine needs it. */
  private async settle(agentId: string, to: "stopped" | "error"): Promise<Agent> {
    const agent = this.registry.require(agentId);
    if (agent.status === to) return agent;
    if (agent.status === "starting" && to === "stopped") {
      await this.registry.transition(agentId, "stopping");
    }
    return this.registry.transition(agentId, to);
  }

  private forget(runtime: Runtime): void {
    runtime.exitSubscription.dispose();
    if (runtime.viewer) this.releaseViewer(runtime, runtime.viewer);
    if (this.runtimes.get(runtime.agentId) === runtime) this.runtimes.delete(runtime.agentId);
  }

  private releaseViewer(runtime: Runtime, slot: ViewerSlot): void {
    for (const subscription of slot.subscriptions) subscription.dispose();
    slot.subscriptions.length = 0;
    if (runtime.viewer === slot) runtime.viewer = null;
  }

  private describe(runtime: Runtime): AgentRuntimeInfo {
    return {
      agentId: runtime.agentId,
      sessionId: runtime.sessionId,
      pid: runtime.pid,
      startedAt: runtime.startedAt,
      attached: runtime.viewer !== null,
    };
  }

  /** Runs `operation` after every earlier operation for the same agent has finished. */
  private enqueue<T>(agentId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(agentId) ?? Promise.resolve();
    const result = previous.then(operation, operation);
    const tail = result.catch(() => undefined);
    this.queues.set(agentId, tail);
    void tail.then(() => {
      if (this.queues.get(agentId) === tail) this.queues.delete(agentId);
    });
    return result;
  }
}
