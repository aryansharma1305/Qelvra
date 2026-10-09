import { useState, type FormEvent } from "react";
import type { Agent, AutomationInput, AutomationView } from "@qelvra/shared";
import { AUTOMATION_LIMITS } from "@qelvra/shared";
export const button =
  "rounded-lg px-4 py-2 min-h-11 text-body-md font-medium bg-primary text-on-primary hover:bg-primary-container focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
export const secondary =
  "rounded-lg px-4 py-2 min-h-11 text-body-md border border-outline-variant/40 hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
const field =
  "mt-2 w-full min-w-0 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 text-on-surface focus:outline focus:outline-2 focus:outline-primary caret-primary";
export function AutomationForm({
  automation,
  agents,
  pending,
  onSave,
  onCancel,
}: {
  automation?: AutomationView | undefined;
  agents: readonly Agent[];
  pending: boolean;
  onSave: (input: AutomationInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<"once" | "interval">(automation?.schedule.kind ?? "once");
  const [error, setError] = useState<string | null>(null);
  const [date] = useState(() =>
    automation
      ? automation.schedule.kind === "once"
        ? automation.schedule.at
        : automation.schedule.startsAt
      : new Date(Date.now() + 3600000).toISOString(),
  );
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const at = String(data.get("at")),
      parsed = new Date(at.length === 16 ? at + ":00Z" : at + "Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() <= Date.now()) {
      setError("Choose a future UTC time.");
      return;
    }
    setError(null);
    await onSave({
      title: String(data.get("title")),
      taskTitle: String(data.get("taskTitle")),
      description: String(data.get("description")),
      agentId: String(data.get("agent")),
      schedule:
        kind === "once"
          ? { kind, at: parsed.toISOString() }
          : { kind, startsAt: parsed.toISOString(), everyMinutes: Number(data.get("minutes")) },
    });
  }
  return (
    <section
      aria-label={automation ? "Edit automation" : "New automation"}
      className="min-w-0 border border-outline-variant/30 rounded-xl bg-surface-container-low p-4 sm:p-6"
    >
      <h2 className="font-headline-md text-headline-md">
        {automation ? "Edit automation" : "New automation"}
      </h2>
      <p className="mt-2 text-body-md text-on-surface-variant">
        Saved disabled. Enable scheduling when you’re ready.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-error">
          {error}
        </p>
      )}
      <form onSubmit={submit} className="mt-6 space-y-5">
        <label className="block">
          Automation title
          <input
            className={field}
            name="title"
            required
            maxLength={160}
            defaultValue={automation?.title}
          />
        </label>
        <label className="block">
          Task title
          <input
            className={field}
            name="taskTitle"
            required
            maxLength={160}
            defaultValue={automation?.taskTitle}
          />
        </label>
        <label className="block">
          Task instructions
          <textarea
            className={field}
            aria-label="Task instructions"
            name="description"
            required
            rows={5}
            maxLength={16384}
            defaultValue={automation?.description}
          />
        </label>
        <label className="block">
          Assigned agent
          <select
            className={field}
            aria-label="Assigned agent"
            name="agent"
            required
            defaultValue={automation?.agentId ?? ""}
          >
            <option value="" disabled>
              Choose a registered agent
            </option>
            {agents.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name} · {a.providerId ?? "No provider"}
              </option>
            ))}
          </select>
        </label>
        <p className="text-body-sm text-on-surface-variant">
          Execution requires an available, authenticated provider with automation support.{" "}
          <a className="text-primary underline underline-offset-4" href="/settings">
            Inspect providers in Settings
          </a>
          .
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <label>
            Cadence
            <select
              className={field}
              aria-label="Cadence"
              value={kind}
              onChange={(e) => setKind(e.target.value as "once" | "interval")}
            >
              <option value="once">One time</option>
              <option value="interval">Fixed interval</option>
            </select>
          </label>
          <label>
            First run (UTC)
            <input
              className={field + " [color-scheme:dark]"}
              name="at"
              type="datetime-local"
              step="1"
              required
              defaultValue={date.slice(0, 19)}
            />
          </label>
        </div>
        {kind === "interval" && (
          <label className="block">
            Interval in minutes
            <input
              className={field}
              aria-label="Interval in minutes"
              name="minutes"
              type="number"
              required
              min={AUTOMATION_LIMITS.minMinutes}
              max={AUTOMATION_LIMITS.maxMinutes}
              step="1"
              defaultValue={
                automation?.schedule.kind === "interval" ? automation.schedule.everyMinutes : 60
              }
            />
            <span className="block mt-2 text-body-sm text-on-surface-variant">
              5 minutes–30 days (43,200 minutes). Anchored to the first run in UTC.
            </span>
          </label>
        )}
        <div className="flex flex-wrap gap-3">
          <button className={button} disabled={pending || !agents.length}>
            {pending ? "Saving…" : automation ? "Save changes" : "Save automation"}
          </button>
          <button className={secondary} type="button" onClick={onCancel} disabled={pending}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
