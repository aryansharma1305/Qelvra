import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  CreateOrchestrationRequestSchema,
  OrchestrationPlanSchema,
  ReviewDecisionSchema,
  GoalSummarySchema,
  type Agent,
  type Orchestration,
  type OrchestrationSlot,
  type CreateOrchestrationRequest,
  type ActivityType,
} from "@qelvra/shared";
import type { TaskRegistry } from "../tasks/task-registry.js";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { ProviderRegistry } from "../providers/provider-registry.js";
import type { AgentExecutionService } from "../execution/agent-execution-service.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import { isActiveExecution } from "../execution/execution-store.js";
import { OrchestrationStore } from "./orchestration-store.js";
import { OrchestrationError } from "./orchestration-errors.js";
import { selectAgent } from "./agent-selection.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";

export interface OrchestrationOptions {
  dataDir: string;
  tasks: TaskRegistry;
  agents: AgentRegistry;
  providers: ProviderRegistry;
  execution: AgentExecutionService;
  activity: ActivityPublisher;
  logger?: ServiceLogger;
  maxTasks?: number;
  maxAttempts?: number;
  maxConcurrent?: number;
  timeoutMs?: number;
}
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
  return value;
}
const RUNNING = new Set(["planning", "running", "reviewing"]);
const TERMINAL = new Set(["completed", "failed", "cancelled"]);
const RETRYABLE = new Set([
  "EXECUTION_TIMED_OUT",
  "EXECUTION_START_FAILED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_LAUNCH_FAILED",
  "EXECUTION_INTERRUPTED",
]);
export class OrchestrationService {
  private queue: Promise<unknown> = Promise.resolve();
  private ready = false;
  private closing = false;
  private scheduled = false;
  private timer?: ReturnType<typeof setTimeout>;
  private readonly subscriptions: { dispose: () => unknown }[] = [];
  private readonly logger: ServiceLogger;
  readonly limits: {
    maxTasks: number;
    maxAttempts: number;
    maxConcurrent: number;
    timeoutMs: number;
  };
  private constructor(
    readonly store: OrchestrationStore,
    private readonly options: OrchestrationOptions,
  ) {
    this.logger = options.logger ?? silentLogger;
    this.limits = {
      maxTasks: options.maxTasks ?? 20,
      maxAttempts: options.maxAttempts ?? 3,
      maxConcurrent: options.maxConcurrent ?? 3,
      timeoutMs: options.timeoutMs ?? 60 * 60 * 1000,
    };
    this.subscriptions.push(
      options.tasks.subscribe(() => this.wake()),
      options.execution.subscribe(() => this.wake()),
      options.agents.subscribe(() => this.wake()),
    );
  }
  static async open(options: OrchestrationOptions) {
    return new OrchestrationService(
      await OrchestrationStore.open(join(options.dataDir, "orchestrations.json")),
      options,
    );
  }
  list() {
    return this.store.list().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  get(id: string) {
    const goal = this.store.get(id);
    if (!goal) throw new OrchestrationError("ORCHESTRATION_NOT_FOUND");
    return goal;
  }
  manages(taskId: string) {
    return this.list().some(
      (g) => !TERMINAL.has(g.status) && [...g.taskIds, ...g.controlTaskIds].includes(taskId),
    );
  }
  create(input: CreateOrchestrationRequest) {
    return this.serial(async () => {
      this.checkOpen();
      const parsed = CreateOrchestrationRequestSchema.parse(input);
      await this.requireOrchestrator(parsed.orchestratorAgentId);
      const now = new Date().toISOString();
      const goal = await this.store.save({
        id: `goal-${randomUUID()}`,
        ...parsed,
        description: parsed.description ?? "",
        status: "draft",
        plan: null,
        taskIds: [],
        tasks: [],
        controlTaskIds: [],
        decision: null,
        maxAttempts: this.limits.maxAttempts,
        materialized: false,
        finalSummary: null,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
      });
      await this.publish(goal, "orchestration.created");
      return goal;
    });
  }
  plan(id: string) {
    return this.serial(async () => {
      this.checkOpen();
      let goal = this.get(id);
      if (goal.taskIds.length || !["draft", "planned", "failed"].includes(goal.status))
        throw new OrchestrationError("ORCHESTRATION_ALREADY_STARTED");
      await this.requireOrchestrator(goal.orchestratorAgentId);
      goal = await this.save({
        ...goal,
        status: "planning",
        startedAt: new Date().toISOString(),
        plan: null,
        finalSummary: null,
        errorCode: null,
        decision: null,
      });
      goal = await this.prepareDecision(goal, "plan", null);
      await this.publish(goal, "orchestration.planning");
      this.wake();
      return goal;
    });
  }
  run(id: string) {
    return this.serial(async () => {
      this.checkOpen();
      let goal = this.get(id);
      if (goal.status !== "planned" || !goal.plan || goal.taskIds.length)
        throw new OrchestrationError("ORCHESTRATION_ALREADY_STARTED");
      if (goal.plan.tasks.length > this.limits.maxTasks)
        throw new OrchestrationError("ORCHESTRATION_INVALID_PLAN");
      await this.requireOrchestrator(goal.orchestratorAgentId);
      const agents = await this.eligibleAgents(goal),
        busy = this.busyAgents();
      const slots: OrchestrationSlot[] = [];
      for (const planned of goal.plan.tasks) {
        const agent = selectAgent(agents, planned.preferredRole, busy);
        if (!agent) {
          await this.save({ ...goal, errorCode: "ORCHESTRATION_NO_AGENT_AVAILABLE" });
          throw new OrchestrationError("ORCHESTRATION_NO_AGENT_AVAILABLE");
        }
        busy.add(agent.id);
        slots.push({
          key: planned.key,
          taskId: `task-${randomUUID()}`,
          agentId: agent.id,
          attempts: 0,
          executionId: null,
          reviewedExecutionId: null,
          review: null,
          result: null,
          reworkInstructions: null,
        });
      }
      // Reserve every identity in one durable goal snapshot before creating any real task.
      goal = await this.save({
        ...goal,
        status: "running",
        tasks: slots,
        taskIds: slots.map((s) => s.taskId),
        startedAt: new Date().toISOString(),
        errorCode: null,
      });
      try {
        goal = await this.materialize(goal);
      } catch {
        await this.stop(goal, "failed", "ORCHESTRATION_PERSISTENCE_FAILED");
        throw new OrchestrationError("ORCHESTRATION_PERSISTENCE_FAILED");
      }
      await this.publish(goal, "orchestration.started");
      this.wake();
      return goal;
    });
  }
  cancel(id: string) {
    return this.serial(async () => {
      this.checkOpen();
      const goal = this.get(id);
      if (TERMINAL.has(goal.status))
        throw new OrchestrationError(
          goal.status === "cancelled" ? "ORCHESTRATION_CANCELLED" : "ORCHESTRATION_ALREADY_STARTED",
        );
      return this.stop(goal, "cancelled", "ORCHESTRATION_CANCELLED");
    });
  }
  resume(id: string) {
    return this.serial(async () => {
      this.checkOpen();
      let goal = this.get(id);
      if (
        goal.status !== "paused" &&
        !(goal.status === "failed" && !goal.materialized && goal.tasks.length)
      )
        throw new OrchestrationError("ORCHESTRATION_ALREADY_STARTED");
      await this.requireOrchestrator(goal.orchestratorAgentId);
      goal = await this.save({
        ...goal,
        status: goal.plan ? "running" : "planning",
        errorCode: null,
        startedAt: new Date().toISOString(),
      });
      if (goal.tasks.length && !goal.materialized) goal = await this.materialize(goal);
      // Interrupted decisions remain explicit tasks; restart them only after explicit Resume.
      if (goal.decision) {
        const task = this.options.tasks.get(goal.decision.taskId);
        if (task?.status === "assigned")
          goal = await this.save({ ...goal, decision: { ...goal.decision, executionId: null } });
      }
      await this.publish(goal, "orchestration.resumed");
      this.wake();
      return goal;
    });
  }
  async recover() {
    await this.serial(async () => {
      for (const goal of this.list())
        if (RUNNING.has(goal.status)) {
          const paused = await this.save({ ...goal, status: "paused" });
          await this.publish(paused, "orchestration.paused");
        }
      this.ready = true;
    });
  }
  async stopAll() {
    this.closing = true;
    this.ready = false;
    clearTimeout(this.timer);
    for (const s of this.subscriptions) s.dispose();
    await this.queue;
    for (const goal of this.list())
      if (RUNNING.has(goal.status)) await this.save({ ...goal, status: "paused" });
    // App shutdown invokes PR15 stopAll next: records become interrupted and tasks retryable.
  }
  private checkOpen() {
    if (this.closing) throw new OrchestrationError("ORCHESTRATION_SHUTTING_DOWN");
    if (!this.ready) throw new OrchestrationError("ORCHESTRATION_PERSISTENCE_FAILED");
  }
  private busyAgents() {
    return new Set(
      this.options.execution.store
        .list()
        .filter(isActiveExecution)
        .map((e) => e.agentId),
    );
  }
  private capacity() {
    const owned = new Set(this.list().flatMap((g) => [...g.taskIds, ...g.controlTaskIds]));
    return (
      this.options.execution.store.list().filter((e) => owned.has(e.taskId) && isActiveExecution(e))
        .length < this.limits.maxConcurrent
    );
  }
  private async requireOrchestrator(id: string) {
    const agent = this.options.agents.get(id);
    if (!agent) throw new OrchestrationError("ORCHESTRATION_PROVIDER_UNAVAILABLE");
    const provider = await this.options.providers.get(agent.providerId ?? "shell").catch(() => {
      throw new OrchestrationError("ORCHESTRATION_PROVIDER_UNAVAILABLE");
    });
    if (
      !provider.available ||
      !provider.configured ||
      !provider.capabilities.automation ||
      provider.auth === "auth-required"
    )
      throw new OrchestrationError("ORCHESTRATION_PROVIDER_UNAVAILABLE");
    return agent;
  }
  private async eligibleAgents(goal: Orchestration): Promise<Agent[]> {
    const providers = await this.options.providers.list();
    const available = new Set<string>(
      providers
        .filter(
          (p) =>
            p.available && p.configured && p.capabilities.automation && p.auth !== "auth-required",
        )
        .map((p) => p.id),
    );
    return this.options.agents
      .list()
      .filter(
        (a) => a.id !== goal.orchestratorAgentId && a.providerId && available.has(a.providerId),
      )
      .sort((a, b) => a.id.localeCompare(b.id))
      .slice(0, 50);
  }
  private async materialize(goal: Orchestration) {
    for (const slot of goal.tasks) {
      const planned = goal.plan?.tasks.find((t) => t.key === slot.key);
      if (!planned) throw new OrchestrationError("ORCHESTRATION_INVALID_PLAN");
      let task = await this.options.tasks.create(
        { title: planned.title, description: planned.description },
        slot.taskId,
      );
      if (task.status === "inbox") task = await this.options.tasks.assign(task.id, slot.agentId);
      if (task.assignee !== slot.agentId)
        throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
    }
    return this.save({ ...goal, materialized: true });
  }
  private async prepareDecision(
    goal: Orchestration,
    kind: "plan" | "review" | "summary",
    key: string | null,
  ) {
    if (goal.controlTaskIds.length >= 100)
      throw new OrchestrationError("ORCHESTRATION_ATTEMPT_LIMIT");
    const taskId = `task-${randomUUID()}`;
    goal = await this.save({
      ...goal,
      decision: { kind, taskId, key, executionId: null },
      controlTaskIds: [...goal.controlTaskIds, taskId],
    });
    this.wake();
    return goal;
  }
  private async decisionContext(goal: Orchestration) {
    const contextGoal = { id: goal.id, title: goal.title, description: goal.description };
    if (goal.decision?.kind === "plan") {
      const agents = await this.eligibleAgents(goal),
        busy = this.busyAgents();
      return {
        goal: contextGoal,
        agents: agents.map((a) => ({
          name: a.name,
          role: a.role.slice(0, 120),
          provider: a.providerId,
          busy: busy.has(a.id),
        })),
        limits: this.limits,
      };
    }
    if (goal.decision?.kind === "review") {
      const slot = goal.tasks.find((t) => t.key === goal.decision?.key),
        planned = goal.plan?.tasks.find((t) => t.key === slot?.key);
      if (!slot?.result || !planned) throw new OrchestrationError("ORCHESTRATION_REVIEW_FAILED");
      return {
        goal: contextGoal,
        task: planned,
        attempt: slot.attempts,
        result: {
          ...slot.result,
          summary: slot.result.summary.slice(0, 2048),
          notes: slot.result.notes?.slice(0, 2048) ?? null,
          changedFiles: slot.result.changedFiles.slice(0, 20),
        },
      };
    }
    return {
      goal: contextGoal,
      tasks: goal.tasks.map((s) => ({
        taskId: s.taskId,
        agentId: s.agentId,
        summary: s.result?.summary.slice(0, 1024) ?? "",
        changedFiles: s.result?.changedFiles.slice(0, 20) ?? [],
      })),
    };
  }
  private async advanceDecision(goal: Orchestration) {
    const decision = required(goal.decision);
    let task = this.options.tasks.get(decision.taskId);
    if (!task)
      task = await this.options.tasks.create(
        {
          title: `${decision.kind}: ${goal.title}`.slice(0, 160),
          description: "Structured orchestrator decision; no workspace edits.",
          assignee: goal.orchestratorAgentId,
        },
        decision.taskId,
      );
    if (task.assignee !== goal.orchestratorAgentId)
      throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
    let record = this.options.execution.get(task.id).execution;
    if (
      !decision.executionId &&
      record?.status === "succeeded" &&
      ["review", "completed"].includes(task.status)
    ) {
      goal = await this.save({ ...goal, decision: { ...decision, executionId: record.id } });
    } else if (!decision.executionId) {
      if (!this.capacity() || this.busyAgents().has(goal.orchestratorAgentId)) return goal;
      const context = JSON.stringify(await this.decisionContext(goal));
      const response = await this.options.execution.executeTask(task.id, {
        instructions: [],
        decision: { phase: decision.kind, context },
      });
      return this.save({
        ...goal,
        decision: { ...decision, executionId: required(response.execution).id },
      });
    }
    record = this.options.execution.get(task.id).execution;
    if (!record || record.id !== goal.decision?.executionId || isActiveExecution(record))
      return goal;
    if (record.status !== "succeeded" || !record.result || record.result.changedFiles.length)
      throw new OrchestrationError(
        decision.kind === "plan" ? "ORCHESTRATION_INVALID_PLAN" : "ORCHESTRATION_REVIEW_FAILED",
      );
    let raw: unknown;
    try {
      raw = JSON.parse(record.result.notes ?? "");
    } catch {
      throw new OrchestrationError(
        decision.kind === "plan" ? "ORCHESTRATION_INVALID_PLAN" : "ORCHESTRATION_REVIEW_FAILED",
      );
    }
    if (decision.kind === "plan") {
      const parsed = OrchestrationPlanSchema.safeParse(raw);
      if (!parsed.success || parsed.data.tasks.length > this.limits.maxTasks)
        throw new OrchestrationError("ORCHESTRATION_INVALID_PLAN");
      if (this.options.tasks.require(task.id).status === "review")
        await this.options.tasks.complete(task.id);
      goal = await this.save({ ...goal, status: "planned", plan: parsed.data, decision: null });
      await this.publish(goal, "orchestration.planned");
    } else if (decision.kind === "review") {
      const parsed = ReviewDecisionSchema.safeParse(raw),
        slot = goal.tasks.find((t) => t.key === decision.key);
      if (!parsed.success || !slot?.executionId || !slot.result)
        throw new OrchestrationError("ORCHESTRATION_REVIEW_FAILED");
      const review = parsed.data;
      goal = await this.updateSlot(goal, {
        ...slot,
        review,
        reviewedExecutionId: slot.executionId,
        reworkInstructions: review.reworkInstructions ?? slot.reworkInstructions,
      });
      // Durable review first. Reconcile after restart before advancing another task.
      goal = await this.applyReview(goal, required(goal.tasks.find((t) => t.key === slot.key)));
      if (this.options.tasks.require(task.id).status === "review")
        await this.options.tasks.complete(task.id);
      goal = await this.save({ ...goal, decision: null, status: "running" });
    } else {
      const parsed = GoalSummarySchema.safeParse(raw);
      if (!parsed.success) throw new OrchestrationError("ORCHESTRATION_REVIEW_FAILED");
      const summary = parsed.data;
      if (
        summary.goalId !== goal.id ||
        new Set(summary.completedTasks).size !== goal.taskIds.length ||
        summary.completedTasks.length !== goal.taskIds.length ||
        !goal.taskIds.every((id) => summary.completedTasks.includes(id)) ||
        summary.artifacts.some(
          (a) =>
            !goal.tasks.some(
              (s) =>
                s.taskId === a.taskId &&
                s.agentId === a.agentId &&
                a.files.every((f) => s.result?.changedFiles.includes(f)),
            ),
        )
      )
        throw new OrchestrationError("ORCHESTRATION_REVIEW_FAILED");
      if (!goal.taskIds.every((id) => this.options.tasks.require(id).status === "completed"))
        throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
      if (this.options.tasks.require(task.id).status === "review")
        await this.options.tasks.complete(task.id);
      goal = await this.save({
        ...goal,
        status: "completed",
        finalSummary: summary,
        decision: null,
      });
      await this.publish(goal, "orchestration.completed");
    }
    if (this.options.tasks.require(task.id).status === "review")
      await this.options.tasks.complete(task.id);
    return goal;
  }
  private async applyReview(goal: Orchestration, slot: OrchestrationSlot) {
    const task = this.options.tasks.require(slot.taskId),
      review = required(slot.review);
    if (review.decision === "fail") {
      if (task.status === "review") await this.options.tasks.fail(task.id);
      throw new OrchestrationError("ORCHESTRATION_REVIEW_FAILED");
    }
    if (review.decision === "approve") {
      if (task.status === "review") await this.options.tasks.complete(task.id);
      else if (task.status !== "completed")
        throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
      await this.publish(goal, "orchestration.task_approved", slot);
    } else {
      if (slot.attempts >= goal.maxAttempts)
        throw new OrchestrationError("ORCHESTRATION_ATTEMPT_LIMIT");
      if (task.status === "review") await this.options.tasks.start(task.id);
      else if (!["working", "assigned"].includes(task.status))
        throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
      await this.publish(goal, "orchestration.task_rework", slot);
    }
    return goal;
  }
  private async tick(goal: Orchestration) {
    if (goal.startedAt && Date.now() - Date.parse(goal.startedAt) >= this.limits.timeoutMs)
      throw new OrchestrationError("ORCHESTRATION_TIMED_OUT");
    if (goal.decision) return this.advanceDecision(goal);
    if (!goal.materialized || !goal.plan) return goal;
    for (const initial of goal.tasks) {
      let slot = required(goal.tasks.find((s) => s.key === initial.key));
      const task = this.options.tasks.get(slot.taskId);
      if (!task || task.assignee !== slot.agentId || ["inbox", "failed"].includes(task.status))
        throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
      const latest = this.options.execution.get(task.id).execution;
      // Launch/save crash gap: recover the already-created execution, never double-launch it.
      if (
        latest &&
        latest.id !== slot.executionId &&
        (isActiveExecution(latest) || latest.status === "succeeded")
      ) {
        slot = { ...slot, executionId: latest.id };
        goal = await this.updateSlot(goal, slot);
      }
      if (latest && latest.id === slot.executionId && isActiveExecution(latest)) continue;
      if (task.status === "completed") {
        if (slot.review?.decision !== "approve" || slot.reviewedExecutionId !== slot.executionId)
          throw new OrchestrationError("ORCHESTRATION_TASK_CHANGED");
        continue;
      }
      if (task.status === "review") {
        if (!latest?.result || latest.status !== "succeeded" || latest.id !== slot.executionId)
          continue;
        if (slot.reviewedExecutionId === latest.id && slot.review) {
          goal = await this.applyReview(goal, slot);
          continue;
        }
        goal = await this.updateSlot(goal, { ...slot, result: latest.result });
        goal = await this.save({ ...goal, status: "reviewing" });
        return this.prepareDecision(goal, "review", slot.key);
      }
      if (
        latest &&
        latest.id === slot.executionId &&
        ["failed", "cancelled", "interrupted"].includes(latest.status)
      ) {
        if (!RETRYABLE.has(latest.errorCode ?? ""))
          throw new OrchestrationError("ORCHESTRATION_EXECUTION_FAILED");
      }
      const planTask = required(required(goal.plan).tasks.find((t) => t.key === slot.key));
      if (
        !planTask.dependsOn.every((key) => {
          const dep = goal.tasks.find((t) => t.key === key);
          return (
            dep &&
            this.options.tasks.get(dep.taskId)?.status === "completed" &&
            dep.review?.decision === "approve"
          );
        })
      )
        continue;
      if (!this.capacity() || this.busyAgents().has(slot.agentId)) continue;
      if (slot.attempts >= goal.maxAttempts)
        throw new OrchestrationError("ORCHESTRATION_ATTEMPT_LIMIT");
      slot = { ...slot, attempts: slot.attempts + 1, result: null };
      goal = await this.updateSlot(goal, slot);
      try {
        const response = await this.options.execution.executeTask(task.id, {
          instructions: this.reworkInstructions(slot.reworkInstructions),
        });
        goal = await this.updateSlot(goal, {
          ...slot,
          executionId: required(response.execution).id,
        });
        await this.publish(goal, "orchestration.task_started", slot);
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "AGENT_BUSY" || code === "TASK_ALREADY_EXECUTING") {
          goal = await this.updateSlot(goal, { ...slot, attempts: slot.attempts - 1 });
          continue;
        }
        if (RETRYABLE.has(code ?? "") && slot.attempts < goal.maxAttempts) {
          this.wake();
          continue;
        }
        throw new OrchestrationError(
          slot.attempts >= goal.maxAttempts
            ? "ORCHESTRATION_ATTEMPT_LIMIT"
            : "ORCHESTRATION_EXECUTION_FAILED",
        );
      }
    }
    if (goal.tasks.every((s) => this.options.tasks.require(s.taskId).status === "completed"))
      return this.prepareDecision(
        await this.save({ ...goal, status: "reviewing" }),
        "summary",
        null,
      );
    return goal;
  }
  private reworkInstructions(value: string | null) {
    if (!value) return [];
    const chunks: string[] = [];
    let chunk = "Reviewer requests: ";
    for (const char of value) {
      if (Buffer.byteLength(chunk + char) > 1024) {
        chunks.push(chunk);
        chunk = "";
      }
      chunk += char;
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  }
  private wake() {
    if (!this.ready || this.closing || this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => {
      void this.serial(async () => {
        this.scheduled = false;
        if (!this.ready || this.closing) return;
        for (const snapshot of this.list().filter((g) => RUNNING.has(g.status))) {
          try {
            await this.tick(this.get(snapshot.id));
          } catch (error) {
            if (
              error instanceof OrchestrationError &&
              error.code === "ORCHESTRATION_PERSISTENCE_FAILED"
            )
              throw error;
            await this.stop(
              this.get(snapshot.id),
              "failed",
              error instanceof OrchestrationError ? error.code : "ORCHESTRATION_EXECUTION_FAILED",
            );
          }
        }
        this.armDeadline();
      }).catch(async () => {
        this.ready = false;
        clearTimeout(this.timer);
        this.logger.error(
          { errorCode: "ORCHESTRATION_PERSISTENCE_FAILED" },
          "Orchestration stopped; storage requires repair",
        );
        for (const goal of this.list())
          for (const id of [...goal.taskIds, ...goal.controlTaskIds])
            if (this.options.execution.isActive(id))
              await this.options.execution.cancelTask(id).catch(() => undefined);
      });
    });
  }
  private armDeadline() {
    clearTimeout(this.timer);
    const deadlines = this.list()
      .filter((g) => RUNNING.has(g.status) && g.startedAt)
      .map((g) => Date.parse(required(g.startedAt)) + this.limits.timeoutMs);
    if (deadlines.length) {
      this.timer = setTimeout(() => this.wake(), Math.max(1, Math.min(...deadlines) - Date.now()));
      this.timer.unref();
    }
  }
  private async stop(
    goal: Orchestration,
    status: "failed" | "cancelled",
    errorCode: Orchestration["errorCode"],
  ) {
    goal = await this.save({ ...goal, status, errorCode });
    for (const taskId of [...goal.taskIds, ...goal.controlTaskIds])
      if (this.options.execution.isActive(taskId)) await this.options.execution.cancelTask(taskId);
    await this.publish(
      goal,
      status === "cancelled" ? "orchestration.cancelled" : "orchestration.failed",
    );
    return goal;
  }
  private updateSlot(goal: Orchestration, slot: OrchestrationSlot) {
    return this.save({ ...goal, tasks: goal.tasks.map((s) => (s.key === slot.key ? slot : s)) });
  }
  private save(goal: Orchestration) {
    return this.store.save({
      ...goal,
      updatedAt: new Date(Math.max(Date.now(), Date.parse(goal.updatedAt) + 1)).toISOString(),
    });
  }
  private async publish(
    goal: Orchestration,
    type: Extract<ActivityType, `orchestration.${string}`>,
    slot?: OrchestrationSlot,
  ) {
    await this.options.activity.publish({
      type,
      actor: { type: "system" },
      entity: { type: "orchestration", id: goal.id },
      metadata: {
        goalId: goal.id,
        ...(slot ? { taskId: slot.taskId, agentId: slot.agentId, attempt: slot.attempts } : {}),
        ...(goal.errorCode ? { errorCode: goal.errorCode } : {}),
      },
    });
  }
  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const work = this.queue.then(operation, operation);
    this.queue = work.catch(() => undefined);
    return work;
  }
}
