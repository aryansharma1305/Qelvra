import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { AutomationInput, Execution, ActivityInput } from "@qelvra/shared";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { TaskRegistry } from "../../apps/server/src/tasks/task-registry";
import { AutomationService } from "../../apps/server/src/automations/automation-service";
import type { writeFileAtomic } from "../../apps/server/src/lib/atomic-write";
export const AUTOMATION_NOW = Date.parse("2030-01-01T00:00:00.000Z");
export const template = (at = AUTOMATION_NOW + 300000): AutomationInput => ({
  title: "Daily workspace review",
  taskTitle: "PRIVATE_TEMPLATE_TITLE",
  description: "PRIVATE_PROMPT_MARKER",
  agentId: "nova",
  schedule: { kind: "interval", startsAt: new Date(at).toISOString(), everyMinutes: 5 },
});
export async function automationFixture(dir: string, persist?: typeof writeFileAtomic) {
  let now = AUTOMATION_NOW;
  const agents = await AgentRegistry.open({
    file: join(dir, "agents.json"),
    clock: () => new Date(now),
  });
  await agents.create({ id: "nova", name: "Nova", role: "Disposable", providerId: "fake" });
  const tasks = await TaskRegistry.open({
    file: join(dir, "tasks.json"),
    registry: agents,
    clock: () => new Date(now),
  });
  const executions = new Map<string, Execution>(),
    events: ActivityInput[] = [],
    listeners = new Set<(e: Execution) => void>();
  let errorCode: string | null = null,
    calls = 0;
  const gateway = {
    store: { list: () => [...executions.values()] },
    get: (id: string) => ({ execution: executions.get(id) ?? null, result: null }),
    subscribe: (listener: (e: Execution) => void) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
    executeTask: async (id: string) => {
      calls++;
      if (errorCode) throw Object.assign(new Error("PRIVATE_PROVIDER_OUTPUT"), { code: errorCode });
      const task = await tasks.start(id);
      const execution: Execution = {
        id: "exec-" + randomUUID(),
        taskId: id,
        agentId: task.assignee ?? "nova",
        providerId: "fake",
        status: "running",
        startedAt: new Date(now).toISOString(),
        finishedAt: null,
        errorCode: null,
        requestMessageId: null,
        resultMessageId: null,
        result: null,
      };
      executions.set(id, execution);
      for (const listener of listeners) listener(execution);
      return { execution, result: null };
    },
  };
  const options = {
    dataDir: dir,
    agents,
    tasks,
    execution: gateway,
    activity: {
      publish: async (event: ActivityInput) => {
        events.push(event);
        return null;
      },
    },
    clock: () => new Date(now),
    ...(persist ? { persist } : {}),
  };
  const service = await AutomationService.open(options);
  return {
    service,
    options,
    agents,
    tasks,
    executions,
    events,
    setNow: (value: number) => {
      now = value;
    },
    get calls() {
      return calls;
    },
    setError: (code: string | null) => {
      errorCode = code;
    },
    finish: async (id: string, status: Execution["status"] = "succeeded") => {
      const old = executions.get(id);
      if (!old) throw new Error("No execution");
      if (status === "succeeded") await tasks.review(id);
      else await tasks.retryExecution(id, "nova");
      const execution = {
        ...old,
        status,
        errorCode: status === "failed" ? "EXECUTION_TIMED_OUT" : null,
        finishedAt: new Date(now).toISOString(),
      };
      executions.set(id, execution);
      for (const listener of listeners) listener(execution);
      await service.tick();
    },
  };
}

export function required<T>(value: T | null | undefined): T {
  if (value === undefined || value === null) throw new Error("Missing required test value");
  return value;
}
