// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.
import { useState } from "react";
import { TEAM_ACTIVITY, type ActivityKind } from "../../mocks/activity";
import { ActivityItem } from "./ActivityItem";

const TAB_ACTIVE =
  "px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface font-label-sm text-label-sm shadow-sm";
const TAB_INACTIVE =
  "px-2.5 py-1 rounded hover:bg-surface-container text-on-surface-variant font-label-sm text-label-sm transition-colors";

const FILTERS: readonly { label: string; kind: ActivityKind | "all" }[] = [
  { label: "All", kind: "all" },
  { label: "Assignments", kind: "assignment" },
  { label: "Commits", kind: "commit" },
  { label: "Alerts", kind: "alert" },
];

export function TeamActivity() {
  const [filter, setFilter] = useState<ActivityKind | "all">("all");
  const visible = TEAM_ACTIVITY.filter((event) => filter === "all" || event.kind === filter);
  return (
    <div className="lg:col-span-7 rounded-2xl bg-surface-container-low p-6 border border-outline-variant/20 shadow-sm flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-secondary">stream</span>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Team Activity
          </h3>
        </div>
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-surface-container-high border border-outline-variant/30">
          {FILTERS.map(({ label, kind }) => (
            <button
              key={label}
              className={filter === kind ? TAB_ACTIVE : TAB_INACTIVE}
              type="button"
              aria-pressed={filter === kind}
              onClick={() => setFilter(kind)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4 relative before:absolute before:top-2 before:bottom-2 before:left-[17px] before:w-px before:bg-outline-variant/20">
        {visible.map((event) => (
          <ActivityItem key={event.id} event={event} />
        ))}
      </div>
    </div>
  );
}
