// Ported from the Stitch export (agent_hive_multi_agent_terminal_workspace/code.html). Keep visually identical to the design.
import { useState } from "react";
import { useSearchParams } from "react-router";
import { refreshAgents, useAgents } from "../../features/agents/agents-store";
import { ACTIVE_STATUSES } from "../../features/agents/presentation";
import { useNow } from "../../hooks/useNow";
import { AgentContextPanel } from "./AgentContextPanel";
import { CommandBar } from "./CommandBar";
import { SessionTabs } from "./SessionTabs";
import { AgentPane, DevShellPane } from "./TerminalPanes";

const VIEW_ACTIVE = "bg-surface-container-high text-primary shadow-sm";

function elapsed(since: string, now: number): string {
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${seconds % 60}s`;
}

// Tabs and the first pane are the registered agents' real shells (?agent=<id> selects
// one); the split view's second pane is a developer shell. The context panel and command
// bar remain design mock-ups until the mailbox and tasks exist.
export function TerminalPage() {
  const [layout, setLayout] = useState<"single" | "split">("split");
  const { agents, status, pending, error } = useAgents();
  const [searchParams, setSearchParams] = useSearchParams();
  const now = useNow(1_000);
  const requested = searchParams.get("agent");
  // The requested agent, else the first running one, else the first.
  const selected =
    agents.find((agent) => agent.id === requested) ??
    agents.find((agent) => ACTIVE_STATUSES.includes(agent.status)) ??
    agents[0];
  const activeCount = agents.filter((agent) => ACTIVE_STATUSES.includes(agent.status)).length;
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full text-on-surface">
        <div className="terminal-workspace w-full min-w-0 flex flex-col gap-3 p-4 lg:p-6 bg-surface-container-lowest">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-low px-4 py-2.5 rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-outline font-label-sm text-label-sm">
                <span>Workspace</span>
                <span className="text-outline-variant">/</span>
                <span>Terminal</span>
                <span className="text-outline-variant">/</span>
                <span className="text-secondary font-code-sm text-code-sm font-medium">
                  Swarm Console
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-surface-container font-label-sm text-label-sm text-tertiary">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                <span>
                  {activeCount} Agent {activeCount === 1 ? "Shell" : "Shells"} Active
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded bg-surface-container-lowest">
                <button
                  className={`px-2.5 py-1 rounded ${layout === "single" ? VIEW_ACTIVE : "text-outline hover:text-on-surface"} font-label-sm text-label-sm transition-all`}
                  id="btn-single-view"
                  type="button"
                  aria-pressed={layout === "single"}
                  onClick={() => setLayout("single")}
                >
                  {" "}
                  Single{" "}
                </button>
                <button
                  className={`px-2.5 py-1 rounded ${layout === "split" ? "bg-surface-container-high text-primary font-label-sm text-label-sm shadow-sm" : "text-outline hover:text-on-surface font-label-sm text-label-sm"} flex items-center gap-1 transition-all`}
                  id="btn-split-view"
                  type="button"
                  aria-pressed={layout === "split"}
                  onClick={() => setLayout("split")}
                >
                  <span className="material-symbols-outlined text-[13px]">view_column</span>
                  Split View (Dual)
                </button>
                <button
                  disabled
                  title="Coming later — this control is not available in the beta"
                  aria-label="Coming later — coming later"
                  className="px-2.5 py-1 rounded text-outline hover:text-on-surface font-label-sm text-label-sm transition-all"
                  type="button"
                >
                  {" "}
                  Grid (4x){" "}
                </button>
              </div>
              <div className="h-4 w-px bg-surface-container-highest" />
              <div className="flex items-center gap-1">
                <button
                  disabled
                  aria-label="pause — coming later"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface font-label-sm text-label-sm transition-colors"
                  title="Pause session execution"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">pause</span>
                  <span>Pause All</span>
                </button>
                <button
                  disabled
                  aria-label="close — coming later"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-outline hover:text-error font-label-sm text-label-sm transition-colors"
                  title="Send SIGTERM to active swarms"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                  <span>Kill</span>
                </button>
                <button
                  disabled
                  aria-label="backspace — coming later"
                  className="flex items-center gap-1 px-2.5 py-1 rounded bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface font-label-sm text-label-sm transition-colors"
                  id="btn-clear-buffer"
                  title="Clear terminal screen"
                  type="button"
                >
                  <span className="material-symbols-outlined text-[14px]">backspace</span>
                  <span>Clear (⌘K)</span>
                </button>
                <button
                  disabled
                  aria-label="open in new — coming later"
                  className="p-1 rounded bg-surface-container hover:bg-surface-container-high text-outline hover:text-on-surface transition-colors"
                  title="Pop out into separate window"
                  type="button"
                >
                  {" "}
                  <span className="material-symbols-outlined text-[15px]">open_in_new</span>{" "}
                </button>
              </div>
            </div>
          </div>
          <SessionTabs
            agents={agents}
            selectedId={selected?.id ?? null}
            onSelect={(agentId) => setSearchParams({ agent: agentId }, { replace: true })}
          />
          <div className="terminal-task-strip flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-surface-container-low shadow-sm">
            <div className="flex items-center gap-3 min-w-0 max-w-full">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-primary/10 text-primary font-label-sm text-label-sm uppercase">
                <span className="material-symbols-outlined text-[13px]">bolt</span>
                <span>Task</span>
              </div>
              <span className="font-body-sm text-body-sm text-on-surface truncate">
                {selected ? `${selected.name} • No task assigned` : "No agent selected"}
              </span>
            </div>
            <div className="flex items-center gap-4 min-w-0 max-w-full">
              <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-outline">
                <span className="material-symbols-outlined text-[14px] text-secondary">
                  schedule
                </span>
                <span
                  className="text-on-surface truncate"
                  id="elapsed-counter"
                  title="Time since the agent record was updated"
                >
                  {selected ? `Updated ${elapsed(selected.updatedAt, now)} ago` : "—"}
                </span>
              </div>
              <div className="h-3.5 w-px bg-surface-container-highest" />
              <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-outline">
                <span className="material-symbols-outlined text-[14px] text-primary">memory</span>
                <span className="text-on-surface">{selected?.providerId ?? "No provider"}</span>
              </div>
              <div className="h-3.5 w-px bg-surface-container-highest" />
              <div className="flex items-center gap-2">
                <span className="font-label-sm text-label-sm text-outline">Context:</span>
                <div className="w-24 h-1.5 rounded-full bg-surface-container-highest overflow-hidden">
                  <div className="h-full bg-secondary rounded-full" style={{ width: "0%" }} />
                </div>
                <span className="font-code-sm text-code-sm text-outline">No model</span>
              </div>
              <div className="h-3.5 w-px bg-surface-container-highest" />
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-tertiary/10 text-tertiary font-label-sm text-label-sm">
                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                <span>Workspace per agent</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-start min-w-0">
            <div className="xl:col-span-8 flex flex-col gap-3 min-w-0" id="terminals-container">
              <div
                className={`grid grid-cols-1 ${layout === "split" ? "lg:grid-cols-2" : ""} gap-3`}
              >
                <AgentPane
                  agent={selected}
                  pending={selected ? pending[selected.id] : undefined}
                  emptyMessage={status === "ready" ? "No agents yet." : "Loading agents…"}
                  loadError={error}
                  onRetry={() => void refreshAgents()}
                />
                {layout === "split" && <DevShellPane />}
              </div>
              <CommandBar />
            </div>
            <AgentContextPanel />
          </div>
        </div>
      </div>
    </main>
  );
}
