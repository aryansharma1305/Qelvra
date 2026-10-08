import {
  AGENT_MEMORY_LIMIT,
  type AgentMemory,
  type UpdateAgentMemoryRequest,
} from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { AppError } from "../lib/errors.js";
import {
  readBoundedText,
  writeRevisionText,
  type TextFilePolicy,
} from "../lib/bounded-text-file.js";

export class AgentMemoryService {
  private queues = new Map<string, Promise<unknown>>();
  constructor(
    private agents: AgentRegistry,
    private workspaces: AgentWorkspaceManager,
    private activity?: ActivityPublisher,
    private logger: ServiceLogger = silentLogger,
  ) {}
  private run<T>(agentId: string, operation: "read" | "write", work: () => Promise<T>) {
    const next = (this.queues.get(agentId) ?? Promise.resolve()).then(async () => {
      try {
        const agent = this.agents.get(agentId);
        if (!agent) throw new AppError(404, "AGENT_NOT_FOUND", "Agent not found");
        // Only initialize legacy storage when absent, using the canonical exclusive template.
        let missing = false;
        try {
          missing = !(await this.workspaces.getMemoryEntry(agentId, true)).info;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          missing = true;
        }
        if (missing) await this.workspaces.ensureWorkspace(agent);
        const value = await work();
        this.logger.debug({ agentId, operation }, "Agent memory operation completed");
        return value;
      } catch (error) {
        const failure =
          error instanceof AppError
            ? error
            : new AppError(
                500,
                operation === "read" ? "MEMORY_READ_FAILED" : "MEMORY_WRITE_FAILED",
                "Could not access agent memory. Check host permissions and reload.",
              );
        this.logger.warn(
          { agentId, operation, errorCode: failure.code },
          "Agent memory operation failed",
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
  private policy(agentId: string): TextFilePolicy {
    return {
      limit: AGENT_MEMORY_LIMIT,
      readBinaryMessage: "Only valid UTF-8 text is supported",
      resolve: () => this.workspaces.getMemoryEntry(agentId),
      validateParent: () => this.workspaces.getWorkspacePath(agentId),
      codes: {
        large: "MEMORY_TOO_LARGE",
        binary: "MEMORY_INVALID_UTF8",
        changed: "MEMORY_CHANGED_ON_DISK",
        regular: "MEMORY_INVALID_FILE",
        write: "MEMORY_WRITE_FAILED",
      },
    };
  }
  get(agentId: string): Promise<AgentMemory> {
    return this.run(agentId, "read", async () => ({
      agentId,
      ...(await readBoundedText(this.policy(agentId))),
    }));
  }
  update(agentId: string, input: UpdateAgentMemoryRequest): Promise<AgentMemory> {
    return this.run(agentId, "write", async () => {
      const memory = {
        agentId,
        ...(await writeRevisionText(this.policy(agentId), input.content, input.expectedRevision)),
      };
      await this.activity?.publish({
        type: "memory.updated",
        actor: { type: "user" },
        entity: { type: "agent", id: agentId },
        metadata: { agentId, size: memory.size },
      });
      return memory;
    });
  }
}
