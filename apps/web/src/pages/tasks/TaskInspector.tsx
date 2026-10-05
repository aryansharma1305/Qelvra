import type { Agent, Task } from "@qelvra/shared";
import { useEffect, useRef, useState } from "react";
import { updateTask } from "../../features/tasks/tasks-store";
import { assigneeName, taskLabelId, TASK_LABEL } from "./presentation";
import { useTaskExecution } from "../../features/tasks/useTaskExecution";
import {
  useProviders,
  canLaunchProvider,
  providerStatus,
} from "../../features/providers/useProviders";
import { TaskExecutionDetails } from "./TaskExecutionDetails";

export function TaskInspector({
  task,
  agents,
  busy: taskBusy,
  agentsError,
  onRetryAgents,
  onClose,
}: {
  task: Task;
  agents: readonly Agent[];
  busy: boolean;
  agentsError: string | null;
  onRetryAgents: () => void;
  onClose: () => void;
}) {
  const [agentId, setAgentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const execution = useTaskExecution(task.id);
  const { providers, error: providerError } = useProviders();
  const agent = agents.find((a) => a.id === task.assignee);
  const provider = providers.find((p) => p.id === (agent?.providerId ?? "shell"));
  const providerName = provider?.name ?? execution.execution?.providerId ?? "Checking provider…";
  const canExecute = !!provider?.capabilities.automation && canLaunchProvider(provider);
  const executeEligible =
    task.status === "assigned" ||
    (task.status === "working" && execution.execution?.status === "succeeded");
  const busy = taskBusy || execution.pending || execution.active;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
  }, []);
  const assignee = assigneeName(task.assignee, agents);
  const run = async (action: "assign" | "start" | "review" | "complete" | "fail") => {
    setError(null);
    try {
      await updateTask(task.id, action, agentId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not update task");
    }
  };
  return (
    <section
      aria-label="Task details"
      id="inspector-drawer"
      data-task={task.id}
      className="w-[480px] max-w-full lg:max-w-[calc(100vw-14rem)] flex-shrink-0 border-l border-outline-variant/30 bg-surface-container-lowest flex flex-col justify-between overflow-y-auto custom-scrollbar fixed right-0 top-12 bottom-0 z-50 lg:z-30 lg:static"
    >
      <div className="p-5 border-b border-outline-variant/20 bg-surface-container-low/40">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              title={task.id}
              className="font-code-sm text-code-sm text-secondary font-semibold"
            >
              {taskLabelId(task.id)}
            </span>
            <span
              data-testid="task-status"
              className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-secondary/10 text-secondary border border-secondary/20"
            >
              {TASK_LABEL[task.status]}
            </span>
          </div>
          <button
            ref={close}
            onClick={onClose}
            title="Close Drawer (ESC)"
            aria-label="Close task details"
            className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        <h2 className="font-headline-md text-headline-md font-semibold text-on-surface leading-tight break-words">
          {task.title}
        </h2>
        <div className="mt-4 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex items-center gap-3">
          <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-tr from-primary-container to-secondary flex items-center justify-center text-on-primary font-bold font-code-sm">
            {assignee.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <span className="font-body-md text-body-md font-medium text-on-surface break-words">
              {assignee}
            </span>
            <p className="font-code-sm text-code-sm text-outline">
              {task.assignee
                ? (agents.find((agent) => agent.id === task.assignee)?.role ??
                  "Historical assignee")
                : "Choose an agent to assign this task"}
            </p>
          </div>
        </div>
      </div>
      <div className="p-5 flex flex-col gap-6 flex-1">
        <div className="flex flex-col gap-2">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Task Description
          </span>
          <div className="p-3.5 rounded-lg bg-surface-container-low border border-outline-variant/20 font-body-sm text-body-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap break-words">
            {task.description || "No description provided"}
          </div>
        </div>
        <dl className="font-body-sm text-body-sm text-on-surface-variant flex flex-col gap-3">
          <div>
            <dt className="text-outline">Created</dt>
            <dd>
              <time dateTime={task.createdAt}>{new Date(task.createdAt).toLocaleString()}</time>
            </dd>
          </div>
          <div>
            <dt className="text-outline">Updated</dt>
            <dd>
              <time dateTime={task.updatedAt}>{new Date(task.updatedAt).toLocaleString()}</time>
            </dd>
          </div>
          <div>
            <dt className="text-outline">Created by</dt>
            <dd>{task.createdBy}</dd>
          </div>
        </dl>
        <p className="font-body-sm text-body-sm text-outline">
          Task state is managed here. Assignment does not start an agent or execute this task.
        </p>
        <TaskExecutionDetails
          execution={execution.execution}
          result={execution.result}
          active={execution.active}
          providerName={providerName}
        />
        {executeEligible && providerError && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {providerError}
            <button onClick={() => window.location.reload()} className="ml-2 underline">
              Reload providers
            </button>
          </p>
        )}
        {executeEligible && !canExecute && !providerError && (
          <p className="font-body-sm text-body-sm text-outline">
            {provider
              ? !provider.capabilities.automation
                ? `${provider.name} supports terminal sessions only. Choose an execution-capable provider for this task.`
                : providerStatus(provider)
              : "Checking execution availability…"}
          </p>
        )}
        {execution.error && (
          <div role="alert" className="font-body-sm text-body-sm text-error">
            {execution.error}
            <button
              onClick={() => {
                void execution.reload();
              }}
              className="ml-2 underline"
            >
              Refresh status
            </button>
          </div>
        )}
        {task.status === "inbox" && (
          <div className="flex flex-col gap-2">
            <label htmlFor="task-assignee" className="font-body-sm text-body-sm text-on-surface">
              Assign agent
            </label>
            <select
              id="task-assignee"
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              disabled={busy}
              className="p-2 rounded bg-surface-container-low border border-outline-variant/30 text-on-surface"
            >
              <option value="">Choose an agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
            {agents.length === 0 && (
              <p className="text-outline font-body-sm text-body-sm">
                Create an agent first, then refresh this list.
              </p>
            )}
            {agentsError && (
              <div role="alert" className="text-error font-body-sm text-body-sm">
                {agentsError}
                <button onClick={onRetryAgents} className="ml-2 underline">
                  Retry agents
                </button>
              </div>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="font-body-sm text-body-sm text-error">
            {error}
          </p>
        )}
      </div>
      <div
        className="p-4 border-t border-outline-variant/30 bg-surface-container-low/70 flex items-center justify-end flex-wrap gap-2"
        aria-busy={busy}
      >
        {executeEligible && (
          <Action
            disabled={busy || !canExecute}
            onClick={() => {
              void execution.run();
            }}
          >
            Execute
          </Action>
        )}
        {execution.active && (
          <Action
            disabled={execution.pending}
            onClick={() => {
              void execution.run(true);
            }}
          >
            Cancel execution
          </Action>
        )}
        {task.status === "inbox" && (
          <Action
            disabled={busy || !agents.some((agent) => agent.id === agentId)}
            onClick={() => {
              void run("assign");
            }}
          >
            Assign
          </Action>
        )}
        {task.status === "assigned" && (
          <Action
            disabled={busy}
            onClick={() => {
              void run("start");
            }}
          >
            Start
          </Action>
        )}
        {task.status === "working" && (
          <Action
            disabled={busy}
            onClick={() => {
              void run("review");
            }}
          >
            Send to Review
          </Action>
        )}
        {task.status === "review" && (
          <>
            <Action
              disabled={busy}
              onClick={() => {
                void run("start");
              }}
            >
              Return to Working
            </Action>
            <Action
              disabled={busy}
              onClick={() => {
                void run("complete");
              }}
            >
              Complete
            </Action>
          </>
        )}
        {["assigned", "working", "review"].includes(task.status) && (
          <button
            disabled={busy}
            onClick={() => {
              void run("fail");
            }}
            className="px-3 py-2 rounded bg-surface-container-high border border-error/30 text-error font-body-sm text-body-sm disabled:opacity-50"
          >
            Fail
          </button>
        )}
        {["completed", "failed"].includes(task.status) && (
          <span className="font-body-sm text-body-sm text-outline">Read-only</span>
        )}
      </div>
    </section>
  );
}
function Action({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary-container disabled:opacity-50"
    >
      {children}
    </button>
  );
}
