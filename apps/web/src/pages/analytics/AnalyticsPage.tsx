import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AnalyticsResponse, AnalyticsWarning } from "@qelvra/shared";
import { useAgents, refreshAgents } from "../../features/agents/agents-store";
import { ApiError, getAnalytics } from "../../lib/api";

const baseControl =
  "rounded-lg px-3 py-2 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const control = `${baseControl} bg-surface-container-high text-on-surface`;
const panel =
  "rounded-xl border border-outline-variant/30 bg-surface-container-low p-4 sm:p-6 min-w-0";
const warningText: Record<AnalyticsWarning, string> = {
  RETENTION_LIMIT: "Older events have fallen outside the 10,000-event retained snapshot.",
  RANGE_BEFORE_RETAINED_HISTORY:
    "This range begins before the oldest retained event. Earlier activity may be unrecorded or no longer retained.",
  RECORDING_ERRORS: "Some activity may be missing because event recording reported errors.",
  INTEGRITY_WARNINGS:
    "Unreadable or duplicate journal entries were skipped. History may be incomplete.",
  JOURNAL_CAP:
    "The Activity journal reached its storage cap. Further activity may not be recorded.",
};
const number = (value: number) => value.toLocaleString();

function CountTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <section className={panel} aria-label={title}>
      <h2 className="text-title-md font-medium text-on-surface mb-4">{title}</h2>
      {rows.length ? (
        <table className="w-full text-body-sm text-left">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-on-surface-variant border-b border-outline-variant/30">
              <th scope="col" className="pb-2 font-medium">
                Recorded event
              </th>
              <th scope="col" className="pb-2 font-medium text-right">
                Count
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, count]) => (
              <tr key={label} className="border-b border-outline-variant/20">
                <th scope="row" className="py-3 pr-3 font-normal break-all">
                  {label}
                </th>
                <td className="py-3 text-right tabular-nums">{number(count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          No event types recorded in this range.
        </p>
      )}
    </section>
  );
}

function DailyChart({ daily }: { daily: AnalyticsResponse["daily"] }) {
  const maximum = Math.max(1, ...daily.map((day) => day.recordedEvents));
  const step = 700 / daily.length;
  const ticks = [...new Set([0, Math.floor((daily.length - 1) / 2), daily.length - 1])];
  return (
    <section className={panel} aria-label="Activity over time">
      <h2 className="text-title-md font-medium text-on-surface">Activity over time</h2>
      <p className="text-body-sm text-on-surface-variant mt-1">
        Recorded events per UTC day. Partial boundary days include only events inside the selected
        range.
      </p>
      <div className="overflow-x-auto mt-4" tabIndex={0} aria-label="Scrollable daily chart">
        <svg
          viewBox="0 0 800 240"
          className="w-full min-w-[640px] text-on-surface-variant"
          role="img"
          aria-label="Recorded events by UTC day; the Daily values table below includes every day and zero count."
        >
          <line x1="50" x2="750" y1="195" y2="195" stroke="currentColor" />
          <text x="40" y="195" textAnchor="end" fill="currentColor" fontSize="14">
            0
          </text>
          <text x="40" y="20" textAnchor="end" fill="currentColor" fontSize="14">
            {maximum}
          </text>
          <text x="50" y="235" fill="currentColor" fontSize="14">
            UTC date
          </text>
          {daily.map((day, index) => (
            <rect
              key={day.date}
              x={50 + index * step + step * 0.15}
              y={195 - (170 * day.recordedEvents) / maximum}
              width={step * 0.7}
              height={(170 * day.recordedEvents) / maximum}
              fill="currentColor"
              className="text-secondary"
            >
              <title>
                {day.date}: {number(day.recordedEvents)} recorded events
              </title>
            </rect>
          ))}
          {ticks.map((index) => (
            <text
              key={index}
              x={50 + (index + 0.5) * step}
              y="215"
              textAnchor="middle"
              fill="currentColor"
              fontSize="14"
            >
              {daily[index]?.date.slice(5)}
            </text>
          ))}
        </svg>
      </div>
      <details className="mt-4 text-body-sm">
        <summary className="cursor-pointer text-primary py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          Daily values (UTC)
        </summary>
        <table className="w-full text-left" aria-label="Daily recorded events">
          <caption className="sr-only">Daily recorded events, including zero days</caption>
          <thead>
            <tr className="text-on-surface-variant">
              <th scope="col" className="py-2 font-medium">
                UTC date
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Recorded events
              </th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date} className="border-t border-outline-variant/20">
                <th scope="row" className="py-2 font-normal tabular-nums">
                  {day.date}
                </th>
                <td className="py-2 text-right tabular-nums">{number(day.recordedEvents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}

export function AnalyticsPage() {
  const agents = useAgents();
  const [preset, setPreset] = useState("7");
  const [agentId, setAgentId] = useState("");
  const [from, setFrom] = useState(() =>
    new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setError(null);
      if (preset === "custom" && (!from || !to)) {
        setError("Choose both UTC dates.");
        setLoading(false);
        return;
      }
      setLoading(true);
      const end = new Date();
      const query =
        preset === "custom"
          ? { from, to }
          : {
              from: new Date(end.getTime() - Number(preset) * 86_400_000).toISOString(),
              to: end.toISOString(),
            };
      try {
        const result = await getAnalytics(
          { ...query, ...(agentId ? { agentId } : {}) },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setData(result);
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof ApiError
              ? failure.message
              : "Could not load Analytics. Retry when the server is available.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [preset, from, to, agentId, refresh]);
  return (
    <main className="pt-12 min-h-screen bg-background text-on-surface">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <header>
          <h1 className="text-headline-lg font-semibold tracking-tight">Analytics</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            Insights from Qelvra's retained Activity event history.
          </p>
        </header>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void refreshAgents();
            setRefresh((value) => value + 1);
          }}
          className="flex flex-wrap items-end gap-4"
          aria-label="Analytics filters"
        >
          <label className="text-body-sm flex flex-col gap-2">
            Date range
            <select
              aria-label="Date range"
              className={control}
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
            >
              <option value="1">Last 24 hours</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom UTC dates</option>
            </select>
          </label>
          {preset === "custom" && (
            <>
              <label className="text-body-sm flex flex-col gap-2">
                From (UTC, included)
                <input
                  aria-label="From UTC date"
                  className={control}
                  type="date"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label className="text-body-sm flex flex-col gap-2">
                To (UTC, excluded)
                <input
                  aria-label="To UTC date"
                  className={control}
                  type="date"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </>
          )}
          <label className="text-body-sm flex flex-col gap-2">
            Agent
            <select
              aria-label="Analytics agent"
              className={control}
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
            >
              <option value="">All agents</option>
              {agentId && !agents.agents.some((agent) => agent.id === agentId) && (
                <option value={agentId}>Unavailable agent · {agentId}</option>
              )}
              {agents.agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} — {agent.role}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className={`${baseControl} bg-primary text-on-primary hover:bg-primary-container disabled:cursor-not-allowed`}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <p className="text-body-sm text-on-surface-variant py-2">
            UTC · maximum 90 days · end excluded
          </p>
        </form>
        {agents.status === "error" && (
          <p role="status" className="text-body-sm text-on-surface-variant">
            Agent filters could not be loaded.{" "}
            <button className="text-primary underline" onClick={() => void refreshAgents()}>
              Retry agents
            </button>
          </p>
        )}
        {loading && (
          <p role="status" className="text-body-sm text-on-surface-variant">
            Loading recorded Activity events…
          </p>
        )}
        {error && (
          <div role="alert" className={panel}>
            <p>
              {data
                ? "Refresh failed. Showing the last known snapshot. "
                : "Analytics could not be loaded. "}
              {error}
            </p>
            <button
              className={`${control} mt-3`}
              onClick={() => setRefresh((value) => value + 1)}
              disabled={loading}
            >
              Retry
            </button>
          </div>
        )}
        {data && (
          <>
            <p
              className="text-body-sm text-on-surface-variant break-words"
              data-testid="analytics-range"
            >
              Showing {data.range.from} to {data.range.to} (end excluded)
              {data.filter.agentId ? ` · ${data.filter.agentId}` : " · all agents"}.
            </p>
            <section aria-label="Recorded event summary">
              <h2 className="sr-only">Recorded event summary</h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  ["Recorded events", data.summary.recordedEvents, "recorded-events"],
                  ["Agents involved", data.summary.involvedAgents, "involved-agents"],
                  ["Task outcome events", data.summary.taskOutcomeEvents, "task-outcome-events"],
                  ["Goal outcome events", data.summary.goalOutcomeEvents, "goal-outcome-events"],
                ].map(([label, value, id]) => (
                  <div key={id} className={panel}>
                    <dt className="text-body-sm text-on-surface-variant">{label}</dt>
                    <dd
                      className="mt-2 text-headline-md font-semibold tabular-nums"
                      data-testid={id}
                    >
                      {number(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
            {data.summary.recordedEvents === 0 && (
              <p role="status" className={panel}>
                No recorded Activity events in this range.
              </p>
            )}
            <DailyChart daily={data.daily} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <CountTable
                title="Event type breakdown"
                rows={data.byType.map((item) => [item.type, item.count])}
              />
              <CountTable
                title="Task outcome events"
                rows={[
                  ["Completion events", data.taskOutcomes.completed],
                  ["Failure events", data.taskOutcomes.failed],
                  ["Review requested", data.taskOutcomes.reviewRequested],
                  ["Returned to inbox", data.taskOutcomes.returnedToInbox],
                ]}
              />
              <CountTable
                title="Goal outcome events"
                rows={[
                  ["Completion events", data.goalOutcomes.completed],
                  ["Failure events", data.goalOutcomes.failed],
                  ["Cancellation events", data.goalOutcomes.cancelled],
                ]}
              />
            </div>
            <section className={panel} aria-label="Agent involvement">
              <h2 className="text-title-md font-medium">Agent involvement</h2>
              <p className="text-body-sm text-on-surface-variant mt-2 mb-4">
                An event can involve multiple agents. Per-agent involvement counts may sum to more
                than the global event count.
              </p>
              {data.agents.length ? (
                <div
                  className="overflow-x-auto"
                  tabIndex={0}
                  aria-label="Scrollable agent involvement table"
                >
                  <table className="w-full text-left text-body-sm">
                    <caption className="sr-only">Agent involvement in recorded events</caption>
                    <thead>
                      <tr className="text-on-surface-variant">
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Agent
                        </th>
                        <th scope="col" className="py-2 pr-4 font-medium">
                          Role
                        </th>
                        <th scope="col" className="py-2 text-right font-medium">
                          Recorded involvement
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.agents.map((agent) => (
                        <tr key={agent.agentId} className="border-t border-outline-variant/30">
                          <th scope="row" className="py-3 pr-4 font-normal">
                            {agent.registered ? (
                              <Link
                                className="text-primary hover:underline"
                                to={`/agents/${agent.agentId}`}
                              >
                                {agent.name}
                              </Link>
                            ) : (
                              <span>Deleted / unregistered agent</span>
                            )}
                            <span className="block font-mono text-on-surface-variant break-all mt-1">
                              {agent.agentId}
                            </span>
                          </th>
                          <td className="py-3 pr-4">{agent.role ?? "Not registered"}</td>
                          <td className="py-3 text-right tabular-nums">
                            {number(agent.recordedInvolvement)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-body-sm text-on-surface-variant">
                  No agent involvement recorded in this range.
                </p>
              )}
            </section>
            <section className={panel} aria-label="Coverage and recording health">
              <h2 className="text-title-md font-medium">Coverage &amp; recording health</h2>
              <p className="text-body-sm mt-3" role="status">
                {data.coverage.recordingHealthy
                  ? "Activity recording is healthy."
                  : "Activity recording reported errors; some operations may be missing."}
              </p>
              <dl className="grid sm:grid-cols-3 gap-4 text-body-sm mt-4">
                <div>
                  <dt className="text-on-surface-variant">Retained source events</dt>
                  <dd className="mt-1 tabular-nums">{number(data.coverage.retainedEvents)}</dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Oldest retained event (UTC)</dt>
                  <dd className="mt-1 break-all">
                    {data.coverage.oldestRetainedAt ?? "No retained events"}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Newest retained event (UTC)</dt>
                  <dd className="mt-1 break-all">
                    {data.coverage.newestRetainedAt ?? "No retained events"}
                  </dd>
                </div>
              </dl>
              {data.coverage.warnings.length > 0 && (
                <ul className="mt-4 list-disc pl-5 space-y-2 text-body-sm text-on-surface-variant">
                  {data.coverage.warnings.map((warning) => (
                    <li key={warning}>{warningText[warning]}</li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-body-sm text-on-surface-variant">
                Analytics reflects retained event history, not guaranteed lifetime totals. Up to
                10,000 valid events are retained in memory; the Activity journal is capped at 32
                MiB. Counts describe events, including repeated outcomes, rather than unique tasks
                or current task state.
              </p>
              <p className="mt-3 text-body-sm text-on-surface-variant">
                AI token usage, provider cost and machine utilization: Not available yet. No
                external telemetry is sent.
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
