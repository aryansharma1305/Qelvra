import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  CreateOrchestrationRequestSchema,
  type Agent,
  type Orchestration,
  type Task,
} from "@qelvra/shared";
import { useOrchestrations } from "../../features/orchestration/useOrchestrations";
import { useProviders, canLaunchProvider } from "../../features/providers/useProviders";
import { createOrchestration, runOrchestrationAction } from "../../lib/api";
import { TASK_LABEL } from "./presentation";
const BUTTON_BASE =
  "px-3 py-2 rounded border border-outline-variant/30 font-body-sm text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const BUTTON = `${BUTTON_BASE} text-on-surface hover:bg-surface-container-high`;
const PRIMARY_BUTTON = `${BUTTON_BASE} bg-primary text-on-primary hover:bg-primary-container`;
const INPUT =
  "p-2 rounded bg-surface-container-low border border-outline-variant/30 text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary";
const ERRORS: Record<string, string> = {
  ORCHESTRATION_INVALID_PLAN: "The planner returned an invalid plan. Generate a new plan.",
  ORCHESTRATION_NO_AGENT_AVAILABLE:
    "No suitable automation agent is available. Configure an agent for each planned role, then run again.",
  ORCHESTRATION_ATTEMPT_LIMIT:
    "The attempt limit was reached. Inspect the task results before starting a new goal.",
  ORCHESTRATION_REVIEW_FAILED:
    "A review or summary could not be validated. Inspect the worker results.",
  ORCHESTRATION_EXECUTION_FAILED:
    "A worker execution failed. Open its task to inspect the controlled error.",
  ORCHESTRATION_PROVIDER_UNAVAILABLE:
    "The orchestrator provider is unavailable. Check installation and sign-in.",
  ORCHESTRATION_PERSISTENCE_FAILED:
    "Goal state could not be saved. Repair server storage; Resume can finish a partially materialized plan.",
  ORCHESTRATION_TASK_CHANGED:
    "A task or agent changed unexpectedly. Inspect Mission Control before continuing.",
  ORCHESTRATION_TIMED_OUT:
    "The goal timed out. Active work was cancelled and completed tasks were preserved.",
  ORCHESTRATION_CANCELLED: "This goal was cancelled. Its tasks and workspace edits are preserved.",
};
const LABELS: Record<Orchestration["status"], string> = {
  draft: "Draft",
  planning: "Planning",
  planned: "Ready",
  running: "Running",
  reviewing: "Reviewing",
  paused: "Paused — resume required",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function GoalPanel({
  agents,
  tasks,
  selectedId,
  onSelect,
  onClose,
}: {
  agents: readonly Agent[];
  tasks: readonly Task[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { goals, error, loading, refresh } = useOrchestrations();
  const providers = useProviders();
  const location = useLocation();
  const draftGoal = typeof location.state?.draftGoal === "string" ? location.state.draftGoal : null;
  const [creating, setCreating] = useState(draftGoal !== null),
    [title, setTitle] = useState((draftGoal ?? "").slice(0, 160)),
    [description, setDescription] = useState(draftGoal ?? ""),
    [orchestrator, setOrchestrator] = useState("");
  const [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState<string | null>(null);
  const submitting = useRef(false),
    alive = useRef(true),
    titleInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (creating) titleInput.current?.focus();
  }, [creating]);
  const selected = goals.find((g) => g.id === selectedId);
  const available = agents.filter((a) =>
    providers.providers.some(
      (p) => p.id === a.providerId && p.capabilities.automation && canLaunchProvider(p),
    ),
  );
  const action = async (operation: () => Promise<Orchestration>) => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const goal = await operation();
      if (alive.current) {
        onSelect(goal.id);
        setCreating(false);
        refresh();
      }
    } catch (error) {
      if (alive.current)
        setActionError(error instanceof Error ? error.message : "Goal action failed.");
    } finally {
      submitting.current = false;
      if (alive.current) setBusy(false);
    }
  };
  return (
    <section
      aria-label="Goals"
      className="p-6 w-full min-w-0 text-on-surface bg-background fixed inset-x-0 top-12 bottom-0 z-50 overflow-auto lg:static lg:z-auto lg:overflow-visible"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="font-headline-md text-headline-md">Goals</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
            Plan work with an orchestrator, then approve the task breakdown to run your team.
          </p>
        </div>
        <div className="flex gap-2">
          <button className={BUTTON} onClick={onClose}>
            Mission Control
          </button>
          <button
            className={PRIMARY_BUTTON}
            onClick={() => {
              setCreating(true);
              setActionError(null);
            }}
          >
            New Goal
          </button>
        </div>
      </div>
      {(error || actionError) && (
        <div role="alert" className="mb-4 text-error font-body-sm text-body-sm">
          {actionError ?? error}
          <button className={`${BUTTON} ml-2`} onClick={refresh}>
            Reload goals
          </button>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(180px,240px)_minmax(0,1fr)] gap-6">
        <nav aria-label="Goal list" className="flex flex-col gap-1">
          {loading && (
            <p role="status" className="text-on-surface-variant">
              Loading goals…
            </p>
          )}
          {!loading && !goals.length && (
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Create a goal to generate your first plan. No work runs until you choose Run Plan.
            </p>
          )}
          {goals.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onSelect(g.id);
                setCreating(false);
                setActionError(null);
              }}
              aria-current={selectedId === g.id ? "page" : undefined}
              className={`p-3 rounded text-left font-body-sm text-body-sm border ${selectedId === g.id ? "border-primary bg-primary/10" : "border-outline-variant/30 hover:bg-surface-container-low"}`}
            >
              <span className="block break-words">{g.title}</span>
              <span className="block mt-1 text-on-surface-variant">{LABELS[g.status]}</span>
            </button>
          ))}
        </nav>
        {creating ? (
          <form
            aria-label="New Goal"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = CreateOrchestrationRequestSchema.safeParse({
                title,
                description,
                orchestratorAgentId: orchestrator,
              });
              if (!parsed.success) {
                setActionError("Enter a title and choose an available orchestrator.");
                return;
              }
              void action(() => createOrchestration(parsed.data));
            }}
            className="flex flex-col gap-4 max-w-3xl"
            aria-busy={busy}
          >
            <h3 className="font-headline-md text-headline-md">New Goal</h3>
            <label className="flex flex-col gap-2 font-body-sm text-body-sm">
              Goal title
              <input
                ref={titleInput}
                className={INPUT}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={160}
                required
                disabled={busy}
              />
            </label>
            <label className="flex flex-col gap-2 font-body-sm text-body-sm">
              Goal description
              <textarea
                className={`${INPUT} resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={16384}
                rows={5}
                disabled={busy}
              />
            </label>
            <label className="flex flex-col gap-2 font-body-sm text-body-sm">
              Orchestrator
              <select
                aria-label="Orchestrator"
                className={INPUT}
                value={orchestrator}
                onChange={(e) => setOrchestrator(e.target.value)}
                required
                disabled={busy || providers.loading}
              >
                <option value="">Choose an agent</option>
                {available.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {a.role}
                  </option>
                ))}
              </select>
            </label>
            {providers.error && (
              <p role="alert" className="text-error">
                {providers.error}
                <button type="button" onClick={providers.retry} className="ml-2 underline">
                  Reload providers
                </button>
              </p>
            )}
            {!providers.loading && !providers.error && !available.length && (
              <p className="font-body-sm text-body-sm text-on-surface-variant">
                Create an agent with an available automation provider first.{" "}
                <Link to="/agents/new" className="text-primary underline">
                  Create Agent
                </Link>
              </p>
            )}
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Creating saves a draft. Generating a plan uses the selected provider; Run Plan
              authorizes bounded execution and automated review. Files remain in each agent’s
              workspace.
            </p>
            <div className="flex gap-2">
              <button className={PRIMARY_BUTTON} type="submit" disabled={busy || !available.length}>
                {busy ? "Saving…" : "Create Goal"}
              </button>
              <button
                className={BUTTON}
                type="button"
                disabled={busy}
                onClick={() => setCreating(false)}
              >
                Close form
              </button>
            </div>
          </form>
        ) : selected ? (
          <article aria-label="Goal details" className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap justify-between items-start gap-3">
              <div>
                <h3 className="font-headline-md text-headline-md break-words">{selected.title}</h3>
                <p role="status" className="font-body-sm text-body-sm text-secondary mt-2">
                  {LABELS[selected.status]} ·{" "}
                  {
                    selected.tasks.filter(
                      (s) => tasks.find((t) => t.id === s.taskId)?.status === "completed",
                    ).length
                  }{" "}
                  / {selected.taskIds.length} tasks completed
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["draft", "planned", "failed"].includes(selected.status) &&
                  !selected.taskIds.length && (
                    <button
                      disabled={busy}
                      className={BUTTON}
                      onClick={() => {
                        void action(() => runOrchestrationAction(selected.id, "plan"));
                      }}
                    >
                      Generate Plan
                    </button>
                  )}
                {selected.status === "planned" && (
                  <button
                    disabled={busy}
                    className={PRIMARY_BUTTON}
                    onClick={() => {
                      void action(() => runOrchestrationAction(selected.id, "run"));
                    }}
                  >
                    Run Plan
                  </button>
                )}
                {(selected.status === "paused" ||
                  (selected.status === "failed" &&
                    !selected.materialized &&
                    selected.taskIds.length > 0)) && (
                  <button
                    disabled={busy}
                    className={BUTTON}
                    onClick={() => {
                      void action(() => runOrchestrationAction(selected.id, "resume"));
                    }}
                  >
                    Resume
                  </button>
                )}
                {!["completed", "failed", "cancelled"].includes(selected.status) && (
                  <button
                    disabled={busy}
                    className={BUTTON}
                    onClick={() => {
                      void action(() => runOrchestrationAction(selected.id, "cancel"));
                    }}
                  >
                    Cancel Goal
                  </button>
                )}
              </div>
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words font-body-md text-body-md text-on-surface-variant">
              {selected.description}
            </p>
            <p className="mt-3 font-body-sm text-body-sm text-on-surface-variant">
              Orchestrator:{" "}
              <Link
                className="text-primary underline"
                to={`/agents/${selected.orchestratorAgentId}`}
              >
                {agents.find((a) => a.id === selected.orchestratorAgentId)?.name ??
                  selected.orchestratorAgentId}
              </Link>
            </p>
            {selected.errorCode && (
              <p role="alert" className="mt-4 font-body-sm text-body-sm text-error">
                {ERRORS[selected.errorCode] ??
                  "The goal needs attention. Inspect tasks and provider availability."}
              </p>
            )}
            {selected.plan && (
              <section aria-label="Task breakdown" className="mt-6">
                <h4 className="font-headline-sm text-headline-sm">Task breakdown</h4>
                <p className="mt-2 font-body-sm text-body-sm text-on-surface-variant">
                  {selected.plan.summary}
                </p>
                <ol className="mt-4 divide-y divide-outline-variant/30 border-y border-outline-variant/30">
                  {selected.plan.tasks.map((p) => {
                    const slot = selected.tasks.find((s) => s.key === p.key),
                      task = tasks.find((t) => t.id === slot?.taskId),
                      agent = agents.find((a) => a.id === slot?.agentId);
                    return (
                      <li key={p.key} className="py-4 font-body-sm text-body-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <h5 className="font-semibold">
                            {slot ? (
                              <Link
                                className="text-primary underline"
                                to={`/tasks?task=${slot.taskId}`}
                              >
                                {p.title}
                              </Link>
                            ) : (
                              p.title
                            )}
                          </h5>
                          <span className="text-secondary">
                            {task ? TASK_LABEL[task.status] : "Awaiting Run Plan"}
                          </span>
                        </div>
                        <p className="mt-2 text-on-surface-variant break-words">{p.description}</p>
                        <p className="mt-2">
                          {slot ? (
                            <>
                              <Link
                                to={`/agents/${slot.agentId}`}
                                className="text-primary underline"
                              >
                                {agent?.name ?? slot.agentId}
                              </Link>{" "}
                              · {agent?.providerId ?? "Provider unavailable"} · Attempt{" "}
                              {slot.attempts} / {selected.maxAttempts}
                            </>
                          ) : (
                            `Preferred role: ${p.preferredRole}`
                          )}
                        </p>
                        {p.dependsOn.length > 0 && (
                          <p className="mt-1 text-on-surface-variant">
                            Requires: {p.dependsOn.join(", ")}
                          </p>
                        )}
                        {slot?.review && (
                          <p className="mt-2 text-on-surface-variant">
                            Review: {slot.review.reason}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
            {selected.finalSummary && (
              <section aria-label="Final goal summary" className="mt-6 font-body-sm text-body-sm">
                <h4 className="font-headline-sm text-headline-sm">Goal completed</h4>
                <p className="mt-3 whitespace-pre-wrap break-words">
                  {selected.finalSummary.summary}
                </p>
                <h5 className="font-semibold mt-5">Files and workspaces</h5>
                <ul className="mt-2 space-y-3">
                  {selected.finalSummary.artifacts.map((a, i) => (
                    <li key={`${a.taskId}-${i}`}>
                      <Link to={`/agents/${a.agentId}`} className="text-primary underline">
                        {agents.find((agent) => agent.id === a.agentId)?.name ?? a.agentId}
                      </Link>
                      <p className="mt-1 text-on-surface-variant break-words">
                        hive/agents/{a.agentId}/workspace
                      </p>
                      <ul className="mt-1 font-code-sm text-code-sm">
                        {a.files.map((f) => (
                          <li className="break-all" key={f}>
                            {f}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-on-surface-variant">{selected.finalSummary.limitations}</p>
              </section>
            )}
            <p className="mt-6 font-body-sm text-body-sm text-on-surface-variant">
              Workspaces are separate. The goal coordinates tasks and reviews results; it does not
              merge the files into one project.
            </p>
          </article>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Select a goal to inspect its plan, tasks and results.
          </p>
        )}
      </div>
    </section>
  );
}
