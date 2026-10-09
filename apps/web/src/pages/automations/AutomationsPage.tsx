import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { z } from "zod";
import type {
  AutomationHistorySchema,
  AutomationInput,
  AutomationListSchema,
  AutomationView,
} from "@qelvra/shared";
import { useAgents } from "../../features/agents/agents-store";
import {
  ApiError,
  listAutomations,
  automationHistory,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  automationAction,
} from "../../lib/api";
import { AutomationForm, button, secondary } from "./AutomationForm";
const utc = (value: string | null) =>
  value ? value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC") : "Not scheduled";
const status = (value: string) =>
  value === "review" ? "Awaiting human review" : value.charAt(0).toUpperCase() + value.slice(1);
const message = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message} (${error.code ?? error.kind})`
    : "Could not save or load automations. Refresh and try again.";
function runRecovery(code: string) {
  if (code === "AUTOMATION_MISSED")
    return "This occurrence was missed and skipped. Future enabled intervals continue; an expired one-time schedule needs a new UTC time.";
  if (code === "AUTOMATION_BUSY")
    return "The agent or another automation was busy. This slot was skipped; future enabled scheduling continues.";
  if (code === "AUTOMATION_AGENT_NOT_FOUND")
    return "The assigned agent no longer exists. Edit this disabled automation and choose a registered agent.";
  if (code === "AGENT_BUSY")
    return "The assigned agent is executing another task. Inspect Tasks, then explicitly run a new task or enable future scheduling.";
  if (code === "PROVIDER_NOT_AUTOMATION_CAPABLE")
    return "This provider does not support task execution. Inspect providers in Settings, then edit this disabled automation to choose a supported agent.";
  if (code.startsWith("PROVIDER_"))
    return "Provider admission failed. Inspect provider status in Settings and resolve installation or sign-in through its own CLI before running new work.";
  if (code === "AUTOMATION_INTERRUPTED")
    return "This interrupted run will not restart automatically. Inspect its task and workspace, then acknowledge recovery before authorizing new work.";
  if (code === "EXECUTION_TIMED_OUT")
    return "Execution exceeded the server timeout. Inspect the task and any workspace edits before explicitly retrying new work.";
  if (code === "EXECUTION_CANCELLED")
    return "Execution was cancelled and scheduling disabled. Inspect its task before explicitly starting new work.";
  return "Execution failed and scheduling was disabled. Inspect the generated task, workspace and provider status before explicitly starting new work.";
}
export function AutomationsPage() {
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const id = params.get("automation");
  const [data, setData] = useState<z.infer<typeof AutomationListSchema> | null>(null);
  const [history, setHistory] = useState<z.infer<typeof AutomationHistorySchema> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null),
    [actionError, setActionError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0),
    [pending, setPending] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState<"new" | AutomationView | null>(null),
    [confirmDelete, setConfirmDelete] = useState(false),
    [ack, setAck] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let busy = false;
    const load = async () => {
      if (busy || controller.signal.aborted || document.visibilityState === "hidden") return;
      busy = true;
      try {
        const snapshot = await listAutomations({ signal: controller.signal });
        const runs =
          id && snapshot.automations.some((a) => a.id === id)
            ? await automationHistory(id, { signal: controller.signal })
            : null;
        if (!controller.signal.aborted) {
          setData(snapshot);
          setHistory(runs);
          setLoadError(null);
        }
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(message(error));
      } finally {
        busy = false;
      }
    };
    void load();
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibility = () => {
      clearInterval(timer);
      if (document.visibilityState !== "hidden") {
        void load();
        timer = setInterval(() => void load(), 5000);
      }
    };
    visibility();
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("focus", load);
    return () => {
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("focus", load);
    };
  }, [id, attempt]);
  const selected = data?.automations.find((a) => a.id === id);
  const active = !!selected && ["reserved", "running"].includes(selected.lastRun?.status ?? "");
  const unavailable = !data?.scheduler.healthy || pending || !!loadError;
  function select(value: string) {
    setParams({ automation: value });
    setHistory(null);
    setForm(null);
    setConfirmDelete(false);
    setAck(false);
    setActionError(null);
    setNotice(null);
  }
  async function mutate(work: () => Promise<unknown>, success: string) {
    setPending(true);
    setActionError(null);
    setNotice(null);
    try {
      await work();
      setNotice(success);
      setForm(null);
      setConfirmDelete(false);
      setAck(false);
    } catch (error) {
      setActionError(message(error));
    } finally {
      setPending(false);
      setAttempt((n) => n + 1);
    }
  }
  async function save(input: AutomationInput) {
    await mutate(async () => {
      const result =
        form && form !== "new"
          ? await updateAutomation(form.id, form.revision, input)
          : await createAutomation(input);
      setParams({ automation: result.automation.id });
    }, "Automation saved disabled.");
  }
  return (
    <main className="px-4 sm:px-8 lg:px-10 pt-20 pb-10 max-w-[1600px] mx-auto text-on-surface">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 max-w-prose">
          <h1 className="font-headline-lg text-headline-lg">Automations</h1>
          <p className="mt-3 text-body-lg text-on-surface-variant">
            Schedule agent tasks. Review every result.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className={secondary} onClick={() => setAttempt((n) => n + 1)}>
            Refresh
          </button>
          <button
            className={button}
            disabled={unavailable || agents.status !== "ready" || !agents.agents.length}
            onClick={() => {
              setForm("new");
              setActionError(null);
            }}
          >
            New automation
          </button>
        </div>
      </header>
      <p className="mt-6 text-body-md text-on-surface-variant max-w-prose">
        Schedules run only while this local Qelvra server is on. Missed occurrences are recorded and
        skipped, without catch-up runs. One automation task executes at a time; busy slots are
        skipped. Successful execution waits in Tasks for human review.
      </p>
      <div className="mt-5 space-y-3" aria-live="polite">
        {!data && !loadError && <p role="status">Loading automations…</p>}
        {loadError && (
          <p role="alert" className="text-error">
            {data ? "Showing last known state. " : "Automations could not be loaded. "}
            {loadError}{" "}
            <button
              className="underline underline-offset-4"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Retry
            </button>
          </p>
        )}
        {actionError && (
          <p role="alert" className="text-error">
            {actionError}
          </p>
        )}
        {notice && (
          <p role="status" className="text-secondary">
            {notice}
          </p>
        )}
        {agents.error && (
          <p role="alert" className="text-error">
            Agent list unavailable: {agents.error}
          </p>
        )}
        {data && !data.scheduler.healthy && (
          <p role="alert" className="text-error">
            Scheduler stopped after a storage error. Repair storage and restart the server; new work
            is blocked.
          </p>
        )}
        {data && (
          <p className="text-body-sm text-on-surface-variant">
            {data.scheduler.running ? "Local scheduler running" : "Local scheduler stopped"} · Up to
            100 automations · Up to 500 run records retained · Refreshes every 5 seconds while
            visible
          </p>
        )}
      </div>
      {data && (
        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.4fr)]">
          <section aria-label="Saved automations" className="min-w-0">
            <h2 className="font-headline-md text-headline-md">
              Saved automations{" "}
              <span className="text-on-surface-variant text-body-md">
                ({data.automations.length})
              </span>
            </h2>
            {!data.automations.length && (
              <div className="mt-6 text-body-md text-on-surface-variant max-w-prose">
                <p>
                  No automations yet. Save a task template, then enable its schedule or run it now.
                </p>
                {!agents.agents.length && (
                  <Link
                    className="block mt-3 text-primary underline underline-offset-4"
                    to="/agents/new"
                  >
                    Create an agent first
                  </Link>
                )}
              </div>
            )}
            <ul className="mt-4 divide-y divide-outline-variant/30">
              {data.automations.map((a) => (
                <li key={a.id}>
                  <button
                    aria-pressed={a.id === id}
                    onClick={() => select(a.id)}
                    className={`w-full text-left p-4 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${a.id === id ? "bg-surface-container-high" : "hover:bg-surface-container-low"}`}
                  >
                    <span className="flex justify-between items-start gap-3">
                      <span className="text-body-lg font-medium break-words min-w-0">
                        {a.title}
                      </span>
                      <span
                        className={`text-body-sm shrink-0 ${a.enabled ? "text-secondary" : "text-on-surface-variant"}`}
                      >
                        {a.needsAttention ? "Needs attention" : a.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </span>
                    <span className="block mt-2 text-body-sm text-on-surface-variant break-words">
                      {agents.agents.find((agent) => agent.id === a.agentId)?.name ?? a.agentId} ·{" "}
                      {a.schedule.kind === "once"
                        ? "One time"
                        : `Every ${a.schedule.everyMinutes} minutes`}
                    </span>
                    <span className="block mt-2 text-body-sm text-on-surface-variant break-words">
                      Next: {utc(a.nextRunAt)}
                    </span>
                    <span className="block mt-2 text-body-sm">
                      Last run: {a.lastRun ? status(a.lastRun.status) : "No runs recorded"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <div className="min-w-0">
            {form ? (
              <AutomationForm
                key={form === "new" ? "new" : form.id}
                automation={form === "new" ? undefined : form}
                agents={agents.agents}
                pending={pending}
                onSave={save}
                onCancel={() => setForm(null)}
              />
            ) : selected ? (
              <section aria-label="Automation details" className="min-w-0">
                <h2 className="font-headline-md text-headline-md break-words">{selected.title}</h2>
                <dl className="mt-5 space-y-4 text-body-md">
                  <div>
                    <dt className="text-on-surface-variant">Assigned agent</dt>
                    <dd className="mt-1">
                      <Link
                        to={`/agents/${encodeURIComponent(selected.agentId)}`}
                        className="text-primary underline underline-offset-4"
                      >
                        {agents.agents.find((a) => a.id === selected.agentId)?.name ??
                          selected.agentId}
                      </Link>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Task template</dt>
                    <dd className="mt-1 font-medium break-words">{selected.taskTitle}</dd>
                    <dd className="mt-2 whitespace-pre-wrap break-words max-w-prose">
                      {selected.description || "No additional instructions"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Cadence</dt>
                    <dd className="mt-1 break-words">
                      {selected.schedule.kind === "once"
                        ? `One time · ${utc(selected.schedule.at)}`
                        : `Every ${selected.schedule.everyMinutes} minutes · From ${utc(selected.schedule.startsAt)}`}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Next due (UTC)</dt>
                    <dd className="mt-1 font-code-md text-code-md tabular-nums">
                      {utc(selected.nextRunAt)}
                    </dd>
                  </div>
                </dl>
                {selected.needsAttention && (
                  <div className="mt-6 text-error">
                    <p role="alert">
                      A run was interrupted. It will not restart automatically. Inspect its task
                      before authorizing new work.
                    </p>
                    <label className="flex gap-3 mt-4 items-start text-on-surface">
                      <input
                        type="checkbox"
                        className="mt-1 accent-primary"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                      />
                      I checked the interrupted task and authorize a new run or future scheduling.
                    </label>
                  </div>
                )}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    className={button}
                    disabled={unavailable || (selected.needsAttention && !ack)}
                    onClick={() =>
                      void mutate(
                        () =>
                          automationAction(
                            selected.id,
                            selected.revision,
                            selected.enabled ? "disable" : "enable",
                            ack,
                          ),
                        selected.enabled
                          ? "Scheduling disabled. Active execution is unaffected."
                          : "Scheduling enabled.",
                      )
                    }
                  >
                    {selected.enabled ? "Disable schedule" : "Enable schedule"}
                  </button>
                  <button
                    className={secondary}
                    disabled={unavailable || active || (selected.needsAttention && !ack)}
                    onClick={() =>
                      void mutate(
                        () => automationAction(selected.id, selected.revision, "run", ack),
                        "Run admitted. A fresh task is being created.",
                      )
                    }
                  >
                    Run now
                  </button>
                  <button
                    className={secondary}
                    disabled={unavailable || selected.enabled || active}
                    onClick={() => setForm(selected)}
                  >
                    Edit
                  </button>
                  <button
                    className={secondary}
                    disabled={unavailable || active}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete
                  </button>
                </div>
                <p className="mt-3 text-body-sm text-on-surface-variant">
                  Disable scheduling and wait for execution before editing. Disabling never cancels
                  an active task; use Tasks to cancel execution.
                </p>
                {confirmDelete && (
                  <div className="mt-5 space-y-3">
                    <p>
                      Delete this automation and its run history? Generated tasks stay in Tasks.
                    </p>
                    <button
                      className={button}
                      disabled={pending}
                      onClick={() =>
                        void mutate(async () => {
                          await deleteAutomation(selected.id, selected.revision);
                          setParams({});
                          setHistory(null);
                        }, "Automation deleted. Generated tasks were kept.")
                      }
                    >
                      Confirm delete
                    </button>{" "}
                    <button
                      className={secondary}
                      disabled={pending}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep automation
                    </button>
                  </div>
                )}
                <section
                  aria-label="Run history"
                  className="mt-10 border-t border-outline-variant/30 pt-6"
                >
                  <h3 className="font-headline-sm text-headline-sm">Run history</h3>
                  {!history ? (
                    <p className="mt-4 text-on-surface-variant">Loading run history…</p>
                  ) : (
                    <>
                      <p className="mt-3 text-body-sm text-on-surface-variant">
                        {history.runs.length} shown · {history.retained} retained ·{" "}
                        {history.recorded} records overall
                        {history.truncated ? " · Older records are omitted" : ""}
                      </p>
                      {!history.runs.length && (
                        <p className="mt-5 text-on-surface-variant">
                          No runs recorded. Run now creates a fresh task even when scheduling is
                          disabled.
                        </p>
                      )}
                      <ol className="mt-4 divide-y divide-outline-variant/30">
                        {history.runs.map((run) => (
                          <li key={run.id} className="py-4 text-body-md space-y-2">
                            <p className={run.errorCode ? "text-error" : "text-on-surface"}>
                              {status(run.status)} ·{" "}
                              {run.trigger === "manual" ? "Run now" : "Scheduled"}
                            </p>
                            <p className="text-body-sm text-on-surface-variant tabular-nums break-words">
                              {utc(run.startedAt)}
                              {run.scheduledAt ? ` · Due ${utc(run.scheduledAt)}` : ""}
                            </p>
                            {run.errorCode && (
                              <div className="space-y-2">
                                <p className="text-body-md max-w-prose">
                                  {runRecovery(run.errorCode)}
                                </p>
                                <p className="text-body-sm text-on-surface-variant break-words">
                                  {run.errorCode}
                                  {run.missedOccurrences
                                    ? ` · ${run.missedOccurrences} occurrence(s) skipped`
                                    : ""}
                                </p>
                                <Link
                                  className="inline-block text-primary underline underline-offset-4 py-1"
                                  to="/settings"
                                >
                                  Inspect provider status
                                </Link>
                              </div>
                            )}
                            {run.taskId && (
                              <Link
                                className="inline-block text-primary underline underline-offset-4 py-1"
                                to={`/tasks?task=${encodeURIComponent(run.taskId)}`}
                              >
                                Open generated task
                              </Link>
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  )}
                </section>
              </section>
            ) : (
              <p className="mt-2 text-body-md text-on-surface-variant">
                {id
                  ? "Automation no longer exists. Choose another or refresh."
                  : "Choose an automation to inspect its template and run history."}
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
