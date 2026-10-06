// Ported from the Stitch export (agent_hive_ai_team_directory/code.html). Keep visually identical to the design.
import type { RefObject } from "react";
import type { Agent } from "@qelvra/shared";
import type { StatusGroup } from "../../features/agents/presentation";
import { CAPABILITY_TAGS, countByStatus, type DirectoryFilters } from "./agentDirectory";

const STATUS_TABS: readonly {
  status: StatusGroup | "all";
  label: string;
  dotClass?: string;
}[] = [
  { status: "all", label: "All" },
  { status: "working", label: "Working", dotClass: "bg-secondary" },
  { status: "thinking", label: "Thinking", dotClass: "bg-primary-container" },
  { status: "waiting", label: "Waiting", dotClass: "bg-secondary-fixed" },
  { status: "offline", label: "Offline", dotClass: "bg-outline" },
];

const TAB_ACTIVE =
  "filter-tab active flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-high text-on-surface font-body-sm text-body-sm font-medium transition-all";
const TAB_INACTIVE =
  "filter-tab flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-surface-container-high/60 text-outline hover:text-on-surface font-body-sm text-body-sm transition-all";
const TAG_ACTIVE =
  "cap-tag px-2.5 py-1 rounded bg-primary/10 text-primary font-label-sm text-label-sm font-semibold transition-all";
const TAG_INACTIVE =
  "cap-tag px-2.5 py-1 rounded bg-surface-container-highest/60 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-label-sm text-label-sm transition-all";

interface AgentFiltersProps {
  agents: readonly Agent[];
  filters: DirectoryFilters;
  onChange: (filters: DirectoryFilters) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function AgentFilters({ agents, filters, onChange, searchInputRef }: AgentFiltersProps) {
  return (
    <div className="flex flex-col gap-3 p-3 rounded-xl bg-surface-container-low shadow-sm">
      <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3">
        <div className="relative flex-1 min-w-0 sm:min-w-[280px]">
          <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-outline">
            search
          </span>{" "}
          <input
            ref={searchInputRef}
            className="w-full pl-10 pr-12 py-2 rounded-lg bg-surface-container-lowest text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none focus:bg-surface-container-high transition-colors"
            id="agent-search-input"
            placeholder="Search agents by name, role or id…"
            type="text"
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
          />{" "}
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-outline">
            ⌘F
          </kbd>
        </div>
        <div className="flex items-center overflow-x-auto gap-1 bg-surface-container-lowest p-1 rounded-lg">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.status}
              className={filters.status === tab.status ? TAB_ACTIVE : TAB_INACTIVE}
              data-status={tab.status}
              type="button"
              aria-pressed={filters.status === tab.status}
              onClick={() => onChange({ ...filters, status: tab.status })}
            >
              {tab.dotClass && <span className={`w-1.5 h-1.5 rounded-full ${tab.dotClass}`} />}
              <span>{tab.label}</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.2 rounded-full bg-surface-container-highest text-on-surface-variant">
                {countByStatus(agents, tab.status)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-surface-container-lowest p-1 rounded-lg">
            <button
              disabled
              aria-label="grid view — coming later"
              className="p-1.5 rounded bg-surface-container-high text-on-surface shadow-xs"
              title="Grid View"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">grid_view</span>{" "}
            </button>
            <button
              disabled
              aria-label="table rows — coming later"
              className="p-1.5 rounded hover:bg-surface-container-high/50 text-outline hover:text-on-surface transition-colors"
              title="Table View"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">table_rows</span>{" "}
            </button>
            <button
              disabled
              aria-label="account tree — coming later"
              className="p-1.5 rounded hover:bg-surface-container-high/50 text-outline hover:text-on-surface transition-colors"
              title="Swarm Topology"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[16px]">account_tree</span>{" "}
            </button>
          </div>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="arrow downward — coming later"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors"
            type="button"
          >
            <span className="text-outline">Sort:</span>
            <span className="font-medium">Last Active</span>
            <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
          </button>
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
        <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider mr-1">
          Capabilities:
        </span>
        {/* Agents have no capabilities until providers exist (PR 13); only "All" applies. */}
        <button
          disabled
          title="Coming later — this control is not available in the beta"
          aria-label="Coming later — coming later"
          className={TAG_ACTIVE}
          type="button"
          aria-pressed="true"
        >
          All
        </button>
        {CAPABILITY_TAGS.map((tag) => (
          <button
            key={tag}
            className={TAG_INACTIVE}
            type="button"
            disabled
            title="Capability filters arrive with AI providers"
          >
            {tag}
          </button>
        ))}
      </div>
    </div>
  );
}
