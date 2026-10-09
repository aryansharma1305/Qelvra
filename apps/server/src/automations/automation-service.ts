import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  AUTOMATION_LIMITS,
  AutomationInputSchema,
  type Automation,
  type AutomationInput,
  type AutomationSchedule,
  type AutomationRun,
  type ApiErrorCode,
} from "@qelvra/shared";
import { AppError } from "../lib/errors.js";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { TaskRegistry } from "../tasks/task-registry.js";
import type { AgentExecutionService } from "../execution/agent-execution-service.js";
import type { ExecutionStore } from "../execution/execution-store.js";
import { isActiveExecution } from "../execution/execution-store.js";
import type { ActivityPublisher } from "../activity/activity-publisher.js";
import { AutomationStore } from "./automation-store.js";

export const AUTOMATION_GRACE_MS = 60000;
export function futureOccurrence(schedule: AutomationSchedule, now: number) {
  if (schedule.kind === "once") return Date.parse(schedule.at) > now ? schedule.at : null;
  const start = Date.parse(schedule.startsAt),
    period = schedule.everyMinutes * 60000;
  return new Date(
    start > now ? start : start + (Math.floor((now - start) / period) + 1) * period,
  ).toISOString();
}
interface Options {
  dataDir: string;
  agents: Pick<AgentRegistry, "get">;
  tasks: Pick<TaskRegistry, "create" | "get">;
  execution: Pick<AgentExecutionService, "executeTask" | "get" | "subscribe"> & {
    store: Pick<ExecutionStore, "list">;
  };
  activity: Pick<ActivityPublisher, "publish">;
  clock?: () => Date;
  persist?: Parameters<typeof AutomationStore.open>[1];
}
const active = (run: AutomationRun) => run.status === "reserved" || run.status === "running";
const failure = (status: number, code: ApiErrorCode, message: string): never => {
  throw new AppError(status, code, message);
};
export class AutomationService {
  private queue: Promise<unknown> = Promise.resolve();
  private timer?: ReturnType<typeof setTimeout>;
  private subscription?: { dispose: () => unknown };
  private closing = false;
  private fatal = false;
  private running = false;
  private readonly launches = new Set<Promise<void>>();
  private constructor(
    readonly store: AutomationStore,
    private readonly options: Options,
  ) {}
  static async open(options: Options) {
    return new AutomationService(
      await AutomationStore.open(join(options.dataDir, "automations.json"), options.persist),
      options,
    );
  }
  private now() {
    return (this.options.clock ?? (() => new Date()))().getTime();
  }
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work, work);
    this.queue = next.catch(() => undefined);
    return next;
  }
  private healthy() {
    if (this.closing || this.fatal)
      failure(
        503,
        "AUTOMATION_UNAVAILABLE",
        "Scheduling is stopped; repair storage and restart Qelvra",
      );
  }
  private require(id: string) {
    const a = this.store.snapshot().automations.find((a) => a.id === id);
    if (!a) return failure(404, "AUTOMATION_NOT_FOUND", "Automation does not exist");
    return a;
  }
  private revision(a: Automation, revision: number) {
    if (a.revision !== revision)
      failure(409, "AUTOMATION_STALE", "Automation changed; refresh before trying again");
  }
  private checked(raw: unknown, future = true): AutomationInput {
    const parsed = AutomationInputSchema.safeParse(raw);
    if (!parsed.success)
      return failure(
        400,
        "VALIDATION_ERROR",
        "Provide a title, task template, registered agent and valid UTC schedule",
      );
    const input = parsed.data;
    if (!this.options.agents.get(input.agentId))
      failure(400, "AUTOMATION_AGENT_NOT_FOUND", "Choose a registered agent");
    const first = Date.parse(
      input.schedule.kind === "once" ? input.schedule.at : input.schedule.startsAt,
    );
    if (future && first <= this.now())
      failure(400, "AUTOMATION_SCHEDULE_PAST", "First scheduled occurrence must be in the future");
    return input;
  }
  private view(a: Automation, runs = this.store.snapshot().runs) {
    let lastRun: AutomationRun | null = null;
    for (const run of runs)
      if (run.automationId === a.id && (!lastRun || run.ordinal > lastRun.ordinal)) lastRun = run;
    return { ...a, lastRun };
  }
  list() {
    const data = this.store.snapshot();
    return {
      automations: data.automations
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id))
        .map((a) => this.view(a, data.runs)),
      limits: AUTOMATION_LIMITS,
      scheduler: { running: this.running && !this.closing, healthy: !this.fatal },
    };
  }
  get(id: string) {
    return { automation: this.view(this.require(id)) };
  }
  history(id: string, limit = 50) {
    const a = this.require(id),
      retained = this.store
        .snapshot()
        .runs.filter((r) => r.automationId === id)
        .sort((a, b) => b.ordinal - a.ordinal);
    return {
      runs: retained.slice(0, limit),
      retained: retained.length,
      recorded: a.runCount,
      truncated: a.runCount > Math.min(retained.length, limit),
    };
  }
  async create(raw: unknown) {
    return this.serial(async () => {
      this.healthy();
      const input = this.checked(raw),
        data = this.store.snapshot();
      if (data.automations.length >= 100)
        failure(
          409,
          "AUTOMATION_LIMIT",
          "Maximum 100 automations; delete an unused automation first",
        );
      const at = new Date(this.now()).toISOString();
      const a: Automation = {
        ...input,
        id: "auto-" + randomUUID(),
        enabled: false,
        needsAttention: false,
        nextRunAt: null,
        revision: 0,
        createdAt: at,
        updatedAt: at,
        runCount: 0,
      };
      await this.store.save([...data.automations, a], data.runs);
      this.event("automation.created", a.id);
      return this.get(a.id);
    });
  }
  async update(id: string, revision: number, raw: unknown) {
    return this.serial(async () => {
      this.healthy();
      const a = this.require(id);
      this.revision(a, revision);
      if (a.enabled || this.store.snapshot().runs.some((r) => r.automationId === id && active(r)))
        failure(
          409,
          "AUTOMATION_ACTIVE",
          "Disable scheduling and wait for the active run before editing",
        );
      const input = this.checked(raw);
      await this.replace({
        ...a,
        ...input,
        revision: a.revision + 1,
        updatedAt: new Date(this.now()).toISOString(),
      });
      this.event("automation.updated", id);
      return this.get(id);
    });
  }
  async enabled(id: string, revision: number, enabled: boolean, acknowledge = false) {
    return this.serial(async () => {
      this.healthy();
      const a = this.require(id);
      this.revision(a, revision);
      if (enabled && a.needsAttention && !acknowledge)
        failure(
          409,
          "AUTOMATION_INTERRUPTED",
          "A run was interrupted. Explicitly acknowledge it before scheduling new tasks",
        );
      if (enabled && !this.options.agents.get(a.agentId))
        failure(409, "AUTOMATION_AGENT_NOT_FOUND", "The assigned agent no longer exists");
      const next = enabled ? futureOccurrence(a.schedule, this.now()) : null;
      if (enabled && !next)
        failure(
          409,
          "AUTOMATION_SCHEDULE_PAST",
          "Edit the one-time schedule to a future UTC time before enabling",
        );
      await this.replace({
        ...a,
        enabled,
        nextRunAt: next,
        needsAttention: enabled ? false : a.needsAttention,
        revision: a.revision + 1,
        updatedAt: new Date(this.now()).toISOString(),
      });
      this.event(enabled ? "automation.enabled" : "automation.disabled", id);
      return this.get(id);
    });
  }
  async delete(id: string, revision: number) {
    return this.serial(async () => {
      this.healthy();
      const a = this.require(id);
      this.revision(a, revision);
      const data = this.store.snapshot();
      if (data.runs.some((r) => r.automationId === id && active(r)))
        failure(
          409,
          "AUTOMATION_ACTIVE",
          "Wait for this run to finish; generated tasks remain in Tasks",
        );
      await this.store.save(
        data.automations.filter((a) => a.id !== id),
        data.runs.filter((r) => r.automationId !== id),
      );
      this.event("automation.deleted", id);
    });
  }
  async runNow(id: string, revision: number, acknowledge = false) {
    return this.serial(async () => {
      this.healthy();
      const a = this.require(id),
        data = this.store.snapshot();
      const duplicate = data.runs.find(
        (r) => r.automationId === id && r.trigger === "manual" && r.requestedRevision === revision,
      );
      if (duplicate) return { run: duplicate };
      this.revision(a, revision);
      if (a.needsAttention && !acknowledge)
        failure(
          409,
          "AUTOMATION_INTERRUPTED",
          "A run was interrupted. Explicitly acknowledge it before creating a new task",
        );
      if (data.runs.some(active))
        failure(
          409,
          "AUTOMATION_BUSY",
          "Another automation run is active; wait before running a new task",
        );
      if (!this.options.agents.get(a.agentId))
        failure(409, "AUTOMATION_AGENT_NOT_FOUND", "The assigned agent no longer exists");
      return { run: await this.reserve(a, "manual", null, revision) };
    });
  }
  private async replace(a: Automation) {
    const data = this.store.snapshot();
    await this.store.save(
      data.automations.map((old) => (old.id === a.id ? a : old)),
      data.runs,
    );
  }
  private event(
    type:
      | "automation.created"
      | "automation.updated"
      | "automation.enabled"
      | "automation.disabled"
      | "automation.deleted"
      | "automation.run_reserved"
      | "automation.run_finished"
      | "automation.run_skipped",
    id: string,
    run?: AutomationRun,
  ) {
    void this.options.activity.publish({
      type,
      actor: { type: "system" },
      entity: { type: "automation", id },
      metadata: {
        automationId: id,
        ...(run
          ? {
              runId: run.id,
              status: run.status,
              ...(run.taskId ? { taskId: run.taskId } : {}),
              ...(run.errorCode ? { errorCode: run.errorCode } : {}),
              missedOccurrences: run.missedOccurrences,
            }
          : {}),
      },
    });
  }
  private async reserve(
    a: Automation,
    trigger: "manual" | "scheduled",
    scheduledAt: string | null,
    revision: number | null,
    skipped?: { code: string; missed: number },
  ) {
    const data = this.store.snapshot(),
      at = new Date(this.now()).toISOString();
    const run: AutomationRun = {
      ordinal: a.runCount + 1,
      id: "run-" + randomUUID(),
      automationId: a.id,
      agentId: a.agentId,
      taskId: skipped ? null : "task-" + randomUUID(),
      executionId: null,
      trigger,
      requestedRevision: revision,
      scheduledAt,
      startedAt: at,
      finishedAt: skipped ? at : null,
      status: skipped ? "skipped" : "reserved",
      errorCode: skipped?.code ?? null,
      missedOccurrences: skipped?.missed ?? 0,
    };
    let next = a.nextRunAt,
      enabled = a.enabled;
    if (trigger === "scheduled") {
      next = a.schedule.kind === "once" ? null : futureOccurrence(a.schedule, this.now());
      if (next === null) enabled = false;
    }
    const updated = {
      ...a,
      nextRunAt: next,
      enabled,
      needsAttention: trigger === "manual" ? false : a.needsAttention,
      revision: a.revision + 1,
      runCount: a.runCount + 1,
      updatedAt: at,
    };
    await this.store.save(
      data.automations.map((old) => (old.id === a.id ? updated : old)),
      [run, ...data.runs],
    );
    this.event(skipped ? "automation.run_skipped" : "automation.run_reserved", a.id, run);
    if (!skipped) {
      const launch = Promise.resolve()
        .then(() => this.dispatch(run, a))
        .catch(() => this.failClosed());
      this.launches.add(launch);
      void launch.finally(() => this.launches.delete(launch));
    }
    return structuredClone(run);
  }
  private failClosed() {
    this.fatal = true;
    this.running = false;
    clearTimeout(this.timer);
  }
  private async dispatch(run: AutomationRun, a: Automation) {
    if (!run.taskId) return;
    try {
      if (this.closing) return;
      await this.options.tasks.create(
        { title: a.taskTitle, description: a.description, assignee: a.agentId },
        run.taskId,
        "automation",
      );
      if (this.closing) return;
      const response = await this.options.execution.executeTask(run.taskId);
      await this.serial(async () => {
        const current = this.store.snapshot().runs.find((r) => r.id === run.id);
        if (!current || !active(current)) return;
        await this.saveRun({
          ...current,
          status: "running",
          executionId: response.execution?.id ?? null,
        });
        await this.reconcile();
      });
    } catch (error) {
      const raw = (error as { code?: unknown }).code;
      const code =
        typeof raw === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(raw)
          ? raw
          : "AUTOMATION_EXECUTION_FAILED";
      await this.serial(async () => {
        const current = this.store.snapshot().runs.find((r) => r.id === run.id);
        if (!current || !active(current)) return;
        await this.saveRun({
          ...current,
          status: "failed",
          errorCode: code,
          finishedAt: new Date(this.now()).toISOString(),
        });
      });
    }
  }
  private async saveRun(run: AutomationRun) {
    const data = this.store.snapshot();
    const interrupted = run.status === "interrupted",
      failed = run.status === "failed";
    const automations = data.automations.map((a) =>
      a.id === run.automationId
        ? {
            ...a,
            ...(interrupted || failed
              ? { enabled: false, nextRunAt: null, needsAttention: interrupted }
              : {}),
            revision: a.revision + 1,
            updatedAt: new Date(this.now()).toISOString(),
          }
        : a,
    );
    await this.store.save(
      automations,
      data.runs.map((old) => (old.id === run.id ? run : old)),
    );
    if (!active(run)) this.event("automation.run_finished", run.automationId, run);
  }
  private async reconcile(recovery = false) {
    for (const run of this.store.snapshot().runs.filter(active)) {
      const execution =
        run.taskId && this.options.tasks.get(run.taskId)
          ? this.options.execution.get(run.taskId).execution
          : null;
      if (!execution && !recovery) continue;
      if (!recovery && execution && isActiveExecution(execution)) continue;
      const status =
        execution?.status === "succeeded" ? "review" : recovery ? "interrupted" : "failed";
      await this.saveRun({
        ...run,
        status,
        executionId: execution?.id ?? run.executionId,
        finishedAt: new Date(this.now()).toISOString(),
        errorCode:
          status === "review"
            ? null
            : status === "interrupted"
              ? "AUTOMATION_INTERRUPTED"
              : (execution?.errorCode ?? "AUTOMATION_EXECUTION_FAILED"),
      });
    }
  }
  async tick(recovery = false) {
    return this.serial(async () => {
      this.healthy();
      await this.reconcile(recovery);
      const now = this.now();
      for (const a of this.store
        .snapshot()
        .automations.filter((a) => a.enabled && a.nextRunAt && Date.parse(a.nextRunAt) <= now)
        .sort(
          (a, b) =>
            (a.nextRunAt ?? "").localeCompare(b.nextRunAt ?? "") || a.id.localeCompare(b.id),
        )) {
        const due = Date.parse(a.nextRunAt ?? "");
        if ((recovery && due < now) || now - due > AUTOMATION_GRACE_MS) {
          const missed =
            a.schedule.kind === "once"
              ? 1
              : Math.floor((now - due) / (a.schedule.everyMinutes * 60000)) + 1;
          await this.reserve(a, "scheduled", a.nextRunAt, null, {
            code: "AUTOMATION_MISSED",
            missed,
          });
          continue;
        }
        const busy =
          this.store.snapshot().runs.some(active) ||
          this.options.execution.store
            .list()
            .some((e) => e.agentId === a.agentId && isActiveExecution(e));
        if (busy) {
          await this.reserve(a, "scheduled", a.nextRunAt, null, {
            code: "AUTOMATION_BUSY",
            missed: 0,
          });
          continue;
        }
        if (!this.options.agents.get(a.agentId)) {
          await this.reserve(a, "scheduled", a.nextRunAt, null, {
            code: "AUTOMATION_AGENT_NOT_FOUND",
            missed: 0,
          });
          await this.replace({ ...this.require(a.id), enabled: false, nextRunAt: null });
          continue;
        }
        if (recovery) continue;
        await this.reserve(a, "scheduled", a.nextRunAt, null);
      }
    });
  }
  async start() {
    if (this.running) return;
    this.healthy();
    await this.tick(true);
    this.running = true;
    this.subscription = this.options.execution.subscribe(() => {
      if (!this.closing && !this.fatal)
        void this.serial(() => this.reconcile()).catch(() => this.failClosed());
    });
    const wake = () => {
      if (!this.closing && !this.fatal)
        this.timer = setTimeout(() => {
          void this.tick()
            .catch(() => this.failClosed())
            .finally(wake);
        }, 1000);
    };
    wake();
  }
  async stop() {
    this.closing = true;
    this.running = false;
    clearTimeout(this.timer);
    this.subscription?.dispose();
    await this.queue;
    await Promise.all([...this.launches]);
  }
  async finishShutdown() {
    await this.serial(() => this.reconcile(true));
  }
}
