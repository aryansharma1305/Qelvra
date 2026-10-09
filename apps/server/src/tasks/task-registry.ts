import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  CreateTaskRequestSchema,
  TaskSchema,
  type Agent,
  type Task,
  type TaskStatus,
  type CreateTaskRequest,
} from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import { writeFileAtomic } from "../lib/atomic-write.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { TaskError, TaskRegistryLoadError } from "./task-errors.js";

export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  inbox: ["assigned"],
  assigned: ["working", "failed"],
  working: ["review", "failed"],
  review: ["completed", "working", "failed"],
  completed: [],
  failed: [],
};
const ACTIVE = new Set<TaskStatus>(["assigned", "working", "review"]);
export type TaskEvent = {
  type:
    | "task.created"
    | "task.assigned"
    | "task.started"
    | "task.review_requested"
    | "task.completed"
    | "task.failed"
    | "task.unassigned";
  task: Task;
  previousStatus?: TaskStatus;
};
interface Options {
  file: string;
  registry: Pick<AgentRegistry, "get" | "delete">;
  logger?: ServiceLogger;
  clock?: () => Date;
  /** Server-only persistence seam for meaningful failure tests. */
  persist?: typeof writeFileAtomic;
}
export const TaskStoreFileSchema = z.strictObject({
  version: z.literal(1),
  tasks: z.array(TaskSchema),
});
const copy = (task: Task): Task => Object.freeze({ ...task });

/** One queue protects both the task map and its single snapshot file. No process dependency. */
export class TaskRegistry {
  private tasks = new Map<string, Task>();
  private queue: Promise<unknown> = Promise.resolve();
  private timestamp = 0;
  private listeners = new Set<(event: TaskEvent) => void>();
  private logger: ServiceLogger;
  private constructor(private readonly options: Options) {
    this.logger = options.logger ?? silentLogger;
  }
  static async open(options: Options): Promise<TaskRegistry> {
    const store = new TaskRegistry(options);
    let raw: string;
    try {
      raw = await readFile(options.file, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return store;
      throw new TaskRegistryLoadError("Cannot read task registry", { cause: error });
    }
    try {
      const data = TaskStoreFileSchema.parse(JSON.parse(raw));
      for (const task of data.tasks) {
        if (store.tasks.has(task.id)) throw new Error("Duplicate task id");
        store.tasks.set(task.id, copy(task));
        store.timestamp = Math.max(
          store.timestamp,
          Date.parse(task.createdAt),
          Date.parse(task.updatedAt),
        );
      }
    } catch (error) {
      throw new TaskRegistryLoadError("Task registry is corrupt; repair it before starting", {
        cause: error,
      });
    }
    // Recover a crash between independent agent/task snapshot commits or an internal
    // registry deletion outside the composed runtime path. Preserve all task content.
    const repaired = new Map(store.tasks);
    for (const task of repaired.values()) {
      if (ACTIVE.has(task.status) && task.assignee && !options.registry.get(task.assignee))
        repaired.set(
          task.id,
          copy({ ...task, status: "inbox", assignee: null, updatedAt: store.now() }),
        );
    }
    if ([...repaired.values()].some((task) => store.tasks.get(task.id) !== task))
      await store.save(repaired);
    return store;
  }
  list(): Task[] {
    return [...this.tasks.values()]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map(copy);
  }
  get(id: string): Task | undefined {
    const task = this.tasks.get(id);
    return task && copy(task);
  }
  require(id: string): Task {
    const task = this.get(id);
    if (!task) throw new TaskError("TASK_NOT_FOUND", "Task does not exist");
    return task;
  }
  subscribe(listener: (event: TaskEvent) => void) {
    this.listeners.add(listener);
    return {
      dispose: () => {
        this.listeners.delete(listener);
      },
    };
  }
  create(
    input: CreateTaskRequest,
    reservedId?: string,
    createdBy: Task["createdBy"] = "user",
  ): Promise<Task> {
    return this.enqueue(async () => {
      const parsed = CreateTaskRequestSchema.safeParse(input);
      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0];
        throw new TaskError(
          field === "description"
            ? "TASK_INVALID_DESCRIPTION"
            : field === "assignee"
              ? "TASK_AGENT_NOT_FOUND"
              : "TASK_INVALID_TITLE",
          parsed.error.issues[0]?.message ?? "Invalid task",
        );
      }
      const assignee = parsed.data.assignee ?? null;
      // Durable server-only identity, never accepted from HTTP task input.
      if (reservedId) {
        const existing = this.get(reservedId);
        if (existing) {
          if (
            existing.title !== parsed.data.title ||
            existing.description !== parsed.data.description ||
            existing.createdBy !== createdBy
          )
            throw new TaskError("TASK_INVALID_TITLE", "Reserved task identity conflicts");
          return existing;
        }
      }
      if (assignee) this.agent(assignee);
      const now = this.now();
      const task = TaskSchema.parse({
        ...parsed.data,
        id: reservedId ?? `task-${randomUUID()}`,
        assignee,
        status: assignee ? "assigned" : "inbox",
        createdBy,
        createdAt: now,
        updatedAt: now,
      });
      const next = new Map(this.tasks);
      next.set(task.id, copy(task));
      await this.save(next);
      this.emit({ type: "task.created", task });
      if (assignee) this.emit({ type: "task.assigned", task, previousStatus: "inbox" });
      return copy(task);
    });
  }
  assign(id: string, agentId: string): Promise<Task> {
    return this.enqueue(async () => {
      const task = this.require(id);
      this.agent(agentId);
      if (task.status !== "inbox")
        throw new TaskError("TASK_ALREADY_ASSIGNED", "Only inbox tasks can be assigned");
      return this.change(task, "assigned", "task.assigned", agentId);
    });
  }
  start(id: string) {
    return this.transition(id, "working", "task.started");
  }
  review(id: string) {
    return this.transition(id, "review", "task.review_requested");
  }
  /** Server execution recovery only; preserves assignment and task content. */
  retryExecution(id: string, agentId: string): Promise<Task> {
    return this.enqueue(async () => {
      const task = this.require(id);
      if (task.assignee !== agentId || task.status !== "working") return task;
      return this.change(task, "assigned", "task.assigned", agentId);
    });
  }
  complete(id: string) {
    return this.transition(id, "completed", "task.completed");
  }
  fail(id: string) {
    return this.transition(id, "failed", "task.failed");
  }
  /** Called after runtime stop, while assignment/deletion share this task queue. */
  deleteAgent(agentId: string): Promise<Agent> {
    return this.enqueue(async () => {
      const before = this.tasks;
      const next = new Map(before);
      const changed: Task[] = [];
      for (const task of before.values()) {
        if (task.assignee === agentId && ACTIVE.has(task.status)) {
          const updated = copy({ ...task, assignee: null, status: "inbox", updatedAt: this.now() });
          next.set(task.id, updated);
          changed.push(updated);
        }
      }
      if (changed.length) await this.save(next); // Fail closed: never delete before task persistence.
      let agent: Agent;
      try {
        agent = await this.options.registry.delete(agentId);
      } catch (error) {
        if (changed.length) await this.save(before); // If rollback fails, inbox tasks remain safe.
        throw error;
      }
      for (const task of changed)
        this.emit({
          type: "task.unassigned",
          task,
          previousStatus: before.get(task.id)?.status ?? "assigned",
        });
      return agent;
    });
  }
  private transition(id: string, status: TaskStatus, type: TaskEvent["type"]): Promise<Task> {
    return this.enqueue(async () => {
      const task = this.require(id);
      if (!TASK_TRANSITIONS[task.status].includes(status))
        throw new TaskError("TASK_INVALID_TRANSITION", `Cannot move ${task.status} to ${status}`);
      if (task.assignee) this.agent(task.assignee);
      return this.change(task, status, type, task.assignee);
    });
  }
  private async change(
    task: Task,
    status: TaskStatus,
    type: TaskEvent["type"],
    assignee: string | null,
  ) {
    const updated = copy(TaskSchema.parse({ ...task, status, assignee, updatedAt: this.now() }));
    const next = new Map(this.tasks);
    next.set(task.id, updated);
    await this.save(next);
    this.emit({ type, task: updated, previousStatus: task.status });
    return copy(updated);
  }
  private agent(id: string) {
    if (!this.options.registry.get(id))
      throw new TaskError("TASK_AGENT_NOT_FOUND", "Assignee does not exist");
  }
  private now(): string {
    this.timestamp = Math.max(
      (this.options.clock ?? (() => new Date()))().getTime(),
      this.timestamp + 1,
    );
    return new Date(this.timestamp).toISOString();
  }
  private async save(next: Map<string, Task>) {
    try {
      await (this.options.persist ?? writeFileAtomic)(
        this.options.file,
        `${JSON.stringify({ version: 1, tasks: [...next.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) }, null, 2)}\n`,
      );
    } catch (error) {
      throw new TaskError("TASK_PERSISTENCE_FAILED", "Could not save tasks", { cause: error });
    }
    this.tasks = next;
  }
  private emit(event: TaskEvent) {
    this.logger.info(
      {
        event: event.type,
        taskId: event.task.id,
        status: event.task.status,
        assignee: event.task.assignee,
      },
      "Task changed",
    );
    for (const listener of this.listeners) {
      try {
        listener({ ...event, task: copy(event.task) });
      } catch {
        this.logger.warn({ taskId: event.task.id }, "Task listener failed");
      }
    }
  }
  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }
}
