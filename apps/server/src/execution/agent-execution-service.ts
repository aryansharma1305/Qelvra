import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdtemp, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ExecutionResultSchema,
  TaskExecutionRequestSchema,
  ProviderIdSchema,
  type Execution,
  type TaskExecutionResponse,
} from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { TaskRegistry } from "../tasks/task-registry.js";
import type { MailboxManager } from "../mailbox/mailbox-manager.js";
import type { MessageRouter } from "../router/message-router.js";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import type { ProviderRegistry } from "../providers/provider-registry.js";
import { ProviderError } from "../providers/provider-errors.js";
import { EXECUTION_OUTPUT_SCHEMA } from "../providers/provider-execution.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { ExecutionStore, isActiveExecution } from "./execution-store.js";
import { ExecutionProcessManager } from "./execution-process-manager.js";
import { correlatedResult } from "./execution-result-handler.js";
import { ExecutionError } from "./execution-errors.js";

export interface ExecutionOptions {
  tasks: TaskRegistry;
  agents: AgentRegistry;
  mailbox: MailboxManager;
  router: MessageRouter;
  workspaces: AgentWorkspaceManager;
  providers: ProviderRegistry;
  activity: ActivityPublisher;
  timeoutMs?: number;
  processes?: ExecutionProcessManager;
  logger?: ServiceLogger;
}
export class AgentExecutionService {
  private queue: Promise<unknown> = Promise.resolve();
  private closing = false;
  private readonly admitting = new Set<string>();
  private timestamp = 0;
  private readonly active = new Map<string, { controller: AbortController; work: Promise<void> }>();
  private readonly deletingAgents = new Set<string>();
  private readonly processes: ExecutionProcessManager;
  private readonly logger: ServiceLogger;
  private constructor(
    readonly store: ExecutionStore,
    private readonly options: ExecutionOptions,
  ) {
    this.processes = options.processes ?? new ExecutionProcessManager();
    this.logger = options.logger ?? silentLogger;
    this.timestamp = Math.max(0, ...store.list().map((record) => Date.parse(record.startedAt)));
  }
  static async open(options: ExecutionOptions) {
    return new AgentExecutionService(
      await ExecutionStore.open(join(options.workspaces.dataDir, "executions.json")),
      options,
    );
  }
  get size() {
    return this.processes.size;
  }
  isActive(taskId: string) {
    return (
      this.admitting.has(taskId) ||
      this.store.list().some((e) => e.taskId === taskId && isActiveExecution(e))
    );
  }
  get(taskId: string): TaskExecutionResponse {
    this.options.tasks.require(taskId);
    const execution = this.store.latest(taskId);
    return { execution, result: execution?.result ?? null };
  }
  executeTask(taskId: string): Promise<TaskExecutionResponse> {
    return this.serial(async () => {
      if (this.closing) throw new ExecutionError("EXECUTION_SHUTTING_DOWN");
      if (this.isActive(taskId)) throw new ExecutionError("TASK_ALREADY_EXECUTING");
      const task = this.options.tasks.require(taskId);
      const previous = this.store.latest(taskId);
      if (
        !task.assignee ||
        (task.status !== "assigned" &&
          !(task.status === "working" && previous?.status === "succeeded"))
      )
        throw new ExecutionError("TASK_NOT_ASSIGNED");
      const agent = this.options.agents.require(task.assignee);
      if (
        this.deletingAgents.has(agent.id) ||
        this.store.list().some((e) => e.agentId === agent.id && isActiveExecution(e))
      )
        throw new ExecutionError("AGENT_BUSY");
      this.admitting.add(taskId);
      try {
        const cwd = await this.options.workspaces.ensureWorkspace(agent);
        // Admission checks availability/auth/configuration before changing task state.
        await this.options.providers.resolve(agent, cwd, this.options.workspaces.dataDir);
        if (
          !(await this.options.providers.get(agent.providerId ?? "shell")).capabilities.automation
        )
          throw new ExecutionError("PROVIDER_NOT_AUTOMATION_CAPABLE");
        const startedAt = new Date(
          (this.timestamp = Math.max(Date.now(), this.timestamp + 1)),
        ).toISOString();
        let record = await this.store.save({
          id: `exec-${randomUUID()}`,
          taskId,
          agentId: agent.id,
          providerId: ProviderIdSchema.parse(agent.providerId),
          status: "starting",
          requestMessageId: null,
          resultMessageId: null,
          startedAt,
          finishedAt: null,
          errorCode: null,
          result: null,
        });
        try {
          if (task.status === "assigned") await this.options.tasks.start(taskId);
          const request = TaskExecutionRequestSchema.parse({
            kind: "qelvra.task.v1",
            executionId: record.id,
            taskId,
            agentId: agent.id,
            title: task.title,
            description: task.description,
            workspace: ".",
            instructions: [
              "Work only in the current workspace.",
              "Return a correlated structured result; never mutate Qelvra task state.",
            ],
          });
          const message = await this.options.mailbox.writeControlMessage({
            to: agent.id,
            type: "task",
            body: JSON.stringify(request),
          });
          record = {
            ...record,
            requestMessageId: message.id,
            status: "queued",
          };
          record = await this.store.save(record);
        } catch (error) {
          await this.finish(
            record,
            "failed",
            error instanceof ExecutionError ? error.code : "EXECUTION_START_FAILED",
          );
          await this.cleanRequest(record);
          throw error instanceof ExecutionError || error instanceof ProviderError
            ? error
            : new ExecutionError("EXECUTION_START_FAILED");
        }
        const controller = new AbortController();
        const work = Promise.resolve()
          .then(() => this.perform(record, controller))
          .catch(() => {
            this.logger.error(
              { executionId: record.id, errorCode: "EXECUTION_PERSISTENCE_FAILED" },
              "Execution recovery requires storage repair",
            );
          });
        this.active.set(record.id, { controller, work });
        await this.publish(record, "execution.started");
        return { execution: record, result: null };
      } finally {
        this.admitting.delete(taskId);
      }
    });
  }
  private async perform(record: Execution, controller: AbortController) {
    const timeout = setTimeout(
      () => controller.abort("EXECUTION_TIMED_OUT"),
      this.options.timeoutMs ?? 20 * 60 * 1000,
    );
    let directory: string | undefined;
    try {
      if (!record.requestMessageId) throw new ExecutionError("EXECUTION_START_FAILED");
      const message = await this.waitForRequest(record, controller.signal);
      const request = TaskExecutionRequestSchema.parse(JSON.parse(message.body));
      if (
        message.from !== "system" ||
        message.to !== record.agentId ||
        message.type !== "task" ||
        request.executionId !== record.id ||
        request.taskId !== record.taskId ||
        request.agentId !== record.agentId
      )
        throw new ExecutionError("EXECUTION_INVALID_RESULT");
      const agent = this.options.agents.require(record.agentId);
      const cwd = await this.options.workspaces.getWorkspacePath(agent.id);
      const instructions = await this.options.workspaces.readMetadata(agent.id, "agent.md", 8192);
      directory = await mkdtemp(join(tmpdir(), "qelvra-execution-"));
      const schemaFile = join(directory, "schema.json"),
        resultFile = join(directory, "result.json");
      await writeFile(schemaFile, JSON.stringify(EXECUTION_OUTPUT_SCHEMA), { mode: 0o600 });
      const command = await this.options.providers.resolveExecution(
        agent,
        cwd,
        this.options.workspaces.dataDir,
        {
          request,
          requestMessageId: message.id,
          agentName: agent.name,
          agentRole: agent.role,
          agentInstructions: instructions,
        },
        schemaFile,
        resultFile,
      );
      command.cleanupDirectory = directory;
      await this.serial(async () => {
        this.checkAbort(controller.signal);
        await this.store.save({ ...record, status: "running" });
      });
      const stdout = await this.processes.run(command, controller.signal);
      let output = stdout;
      if (command.output === "file") {
        const handle = await open(
          resultFile,
          constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
        );
        try {
          const stat = await handle.stat();
          if (!stat.isFile() || stat.nlink !== 1 || stat.size > 65536)
            throw new ExecutionError("EXECUTION_INVALID_RESULT");
          const buffer = Buffer.alloc(65537);
          const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
          if (bytesRead > 65536) throw new ExecutionError("EXECUTION_INVALID_RESULT");
          output = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
      }
      let result;
      try {
        result = ExecutionResultSchema.parse(JSON.parse(output));
      } catch {
        throw new ExecutionError("EXECUTION_INVALID_RESULT");
      }
      if (
        result.executionId !== record.id ||
        result.taskId !== record.taskId ||
        result.agentId !== record.agentId ||
        result.requestMessageId !== record.requestMessageId
      )
        throw new ExecutionError("EXECUTION_INVALID_RESULT");
      await this.serial(async () => {
        this.checkAbort(controller.signal);
        await this.store.save({ ...record, status: "awaiting_result" });
        await this.options.mailbox.writeOutboxMessage(agent.id, {
          to: "system",
          type: "result",
          body: JSON.stringify(result),
        });
      });
      await this.options.mailbox.acknowledgeMessage(agent.id, "inbox", message.id, message);
      await this.options.router.rescan();
      while (isActiveExecution(this.requireExecution(record.id))) {
        this.checkAbort(controller.signal);
        await this.scanResults();
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    } catch (error) {
      const code = controller.signal.aborted
        ? String(controller.signal.reason)
        : error instanceof ExecutionError || error instanceof ProviderError
          ? error.code
          : "EXECUTION_START_FAILED";
      await this.serial(async () => {
        const current = this.requireExecution(record.id);
        if (isActiveExecution(current))
          await this.finish(
            current,
            code === "EXECUTION_CANCELLED"
              ? "cancelled"
              : code === "EXECUTION_INTERRUPTED"
                ? "interrupted"
                : "failed",
            code,
          );
      });
    } finally {
      clearTimeout(timeout);
      if (directory) await rm(directory, { recursive: true, force: true });
      await this.cleanRequest(record);
      this.active.delete(record.id);
    }
  }
  private async waitForRequest(record: Execution, signal: AbortSignal) {
    await this.options.router.rescan();
    for (;;) {
      this.checkAbort(signal);
      try {
        return await this.options.mailbox.readMessage(
          record.agentId,
          "inbox",
          record.requestMessageId ?? "",
        );
      } catch (error) {
        if (
          (error as { code?: string }).code !== "MAILBOX_MESSAGE_NOT_FOUND" &&
          (error as { code?: string }).code !== "MAILBOX_READ_FAILED"
        )
          throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
  }
  scanResults(recovery = false): Promise<void> {
    return this.serial(async () => {
      const messages = await this.options.mailbox.listMessages("system", "inbox");
      for (const message of messages.messages) {
        let executionId: unknown;
        try {
          executionId = JSON.parse(message.body).executionId;
        } catch {
          /* Rejected below. */
        }
        const record = typeof executionId === "string" ? this.store.get(executionId) : undefined;
        const task = record && this.options.tasks.get(record.taskId);
        const result =
          record &&
          task &&
          correlatedResult(
            message,
            recovery && isActiveExecution(record)
              ? { ...record, status: "awaiting_result" }
              : record,
            task,
          );
        if (result && record) {
          if (result.status === "completed") {
            if (task?.status === "working") await this.options.tasks.review(record.taskId);
            const finished = await this.store.save({
              ...record,
              status: "succeeded",
              result,
              resultMessageId: message.id,
              finishedAt: new Date().toISOString(),
            });
            await this.publish(finished, "execution.completed");
          } else
            await this.finish(
              { ...record, result, resultMessageId: message.id },
              "failed",
              "EXECUTION_AGENT_FAILED",
            );
        } else
          this.logger.warn(
            { messageId: message.id, errorCode: "EXECUTION_RESULT_REJECTED" },
            "Control result rejected or already processed",
          );
        await this.options.mailbox.acknowledgeMessage("system", "inbox", message.id, message);
      }
    });
  }
  async recover(): Promise<void> {
    // Deliver durable results first; never blindly launch or resume unfinished work.
    await this.options.router.rescan();
    await this.scanResults(true);
    await this.serial(async () => {
      for (const record of this.store.list().filter(isActiveExecution)) {
        await this.finish(record, "interrupted", "EXECUTION_INTERRUPTED");
        await this.cleanRequest(record);
      }
    });
  }
  async cancelTask(taskId: string): Promise<TaskExecutionResponse> {
    const record = await this.serial(async () => {
      const record = this.store.list().find((e) => e.taskId === taskId && isActiveExecution(e));
      if (!record) throw new ExecutionError("EXECUTION_NOT_ACTIVE");
      this.active.get(record.id)?.controller.abort("EXECUTION_CANCELLED");
      return record;
    });
    const running = this.active.get(record.id);
    if (running) await running.work;
    else await this.serial(() => this.finish(record, "cancelled", "EXECUTION_CANCELLED"));
    return this.get(taskId);
  }
  async deleteAgent<T>(agentId: string, remove: () => Promise<T>): Promise<T> {
    this.deletingAgents.add(agentId);
    try {
      await this.serial(async () => undefined);
      for (const record of this.store
        .list()
        .filter((e) => e.agentId === agentId && isActiveExecution(e)))
        await this.cancelTask(record.taskId);
      return await remove();
    } finally {
      this.deletingAgents.delete(agentId);
    }
  }
  async stopAll(): Promise<void> {
    this.closing = true;
    await this.queue;
    for (const active of this.active.values()) active.controller.abort("EXECUTION_INTERRUPTED");
    await Promise.all([...this.active.values()].map((a) => a.work));
  }
  private async finish(
    record: Execution,
    status: "failed" | "cancelled" | "interrupted",
    errorCode: string,
  ) {
    if (this.options.tasks.get(record.taskId))
      await this.options.tasks.retryExecution(record.taskId, record.agentId);
    const finished = await this.store.save({
      ...record,
      status,
      errorCode,
      finishedAt: new Date().toISOString(),
    });
    await this.publish(
      finished,
      status === "cancelled" ? "execution.cancelled" : "execution.failed",
    );
  }
  private async cleanRequest(record: Execution) {
    if (!record.requestMessageId) return;
    if (this.options.router.isRunning()) await this.options.router.rescan();
    for (const [owner, box] of [
      ["system", "outbox"],
      [record.agentId, "inbox"],
    ] as const) {
      try {
        await this.options.mailbox.acknowledgeMessage(owner, box, record.requestMessageId);
      } catch {
        this.logger.warn(
          { executionId: record.id, errorCode: "EXECUTION_REQUEST_CLEANUP_FAILED" },
          "Execution request cleanup failed",
        );
      }
    }
  }
  private requireExecution(id: string): Execution {
    const record = this.store.get(id);
    if (!record) throw new ExecutionError("EXECUTION_PERSISTENCE_FAILED");
    return record;
  }
  private checkAbort(signal: AbortSignal) {
    if (signal.aborted) throw new ExecutionError(signal.reason);
  }
  private async publish(
    record: Execution,
    type: "execution.started" | "execution.completed" | "execution.failed" | "execution.cancelled",
  ) {
    await this.options.activity.publish({
      type,
      actor: { type: "system" },
      entity: { type: "task", id: record.taskId },
      metadata: {
        executionId: record.id,
        taskId: record.taskId,
        agentId: record.agentId,
        providerId: record.providerId,
        ...(record.errorCode ? { errorCode: record.errorCode } : {}),
      },
    });
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const work = this.queue.then(operation, operation);
    this.queue = work.catch(() => undefined);
    return work;
  }
}
