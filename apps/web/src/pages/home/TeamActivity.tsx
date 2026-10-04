// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.
import { useEffect, useState } from "react";
import type { ActivityFeedState } from "../../features/activity/use-activity";

import { ActivityItem } from "./ActivityItem";

const TAB_ACTIVE =
  "px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm";
const TAB_INACTIVE =
  "px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant font-label-sm text-label-sm transition-colors";

const FILTERS = ["All", "Agents", "Tasks", "Messages", "System"] as const;
export function TeamActivity({ feed, full = false }: { feed: ActivityFeedState; full?: boolean }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const prefix = {
    All: "",
    Agents: "agent.",
    Tasks: "task.",
    Messages: "message.",
    System: "router.",
  }[filter];
  const visible = feed.events
    .filter((event) => event.type.startsWith(prefix))
    .slice(0, full ? 100 : 5);
  return (
    <div
      data-testid="team-activity"
      className="lg:col-span-7 rounded-2xl bg-surface-container-low p-3 sm:p-6 border border-outline-variant/20 shadow-sm flex flex-col gap-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-secondary">stream</span>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Team Activity
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1 p-0.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
          {FILTERS.map((label) => (
            <button
              key={label}
              className={filter === label ? TAB_ACTIVE : TAB_INACTIVE}
              type="button"
              aria-pressed={filter === label}
              onClick={() => setFilter(label)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {feed.status?.degraded && (
        <p role="status" className="text-error text-body-sm">
          Activity recording is degraded. Some events may be missing.
        </p>
      )}
      {(feed.state === "error" || feed.state === "reconnecting") && (
        <p role="status" className="text-body-sm text-on-surface-variant">
          {feed.state === "error" ? "Could not connect to activity." : "Reconnecting to activity…"}{" "}
          <button className="text-primary underline" type="button" onClick={feed.retry}>
            Retry
          </button>
        </p>
      )}
      <div className="flex flex-col gap-4 relative before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-outline-variant/20">
        {!visible.length && (
          <p className="text-body-md text-on-surface-variant">
            {feed.state === "loading"
              ? "Loading activity…"
              : filter === "All"
                ? "Activity will appear here as your team works."
                : `No ${filter.toLowerCase()} activity yet.`}
          </p>
        )}
        {visible.map((event) => (
          <ActivityItem key={event.id} event={event} now={now} />
        ))}
      </div>
      {full && (
        <button
          type="button"
          onClick={feed.retry}
          className="self-start text-primary text-body-sm hover:underline"
        >
          Latest activity
        </button>
      )}
      {full && feed.cursor && (
        <button
          type="button"
          disabled={feed.loadingOlder}
          onClick={() => void feed.loadOlder()}
          className="self-start text-primary text-body-sm hover:underline disabled:opacity-50"
        >
          {feed.loadingOlder ? "Loading…" : "Older activity"}
        </button>
      )}
      {feed.olderError && (
        <p role="alert" className="text-error text-body-sm">
          Could not load older activity. Try again.
        </p>
      )}
    </div>
  );
}
