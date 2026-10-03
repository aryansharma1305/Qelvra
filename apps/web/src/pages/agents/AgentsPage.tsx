// Ported from the Stitch export (agent_hive_ai_team_directory/code.html). Keep visually identical to the design.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  deleteAgentInStore,
  refreshAgents,
  runAgentAction,
  useAgents,
} from "../../features/agents/agents-store";
import { ACTIVE_STATUSES } from "../../features/agents/presentation";
import {
  DEFAULT_DIRECTORY_FILTERS,
  matchesDirectoryFilters,
  summarizeAgents,
  type DirectoryFilters,
} from "./agentDirectory";
import { AgentDrawer } from "./AgentDrawer";
import { AgentFilters } from "./AgentFilters";
import { AgentGrid } from "./AgentGrid";

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

export function AgentsPage() {
  const navigate = useNavigate();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [filters, setFilters] = useState<DirectoryFilters>(DEFAULT_DIRECTORY_FILTERS);
  const { agents, status, error, pending } = useAgents();
  const [drawerAgentId, setDrawerAgentId] = useState<string | null>(null);
  const [lastDrawerAgentId, setLastDrawerAgentId] = useState<string | null>(null);

  const visibleAgents = useMemo(
    () => agents.filter((agent) => matchesDirectoryFilters(agent, filters)),
    [agents, filters],
  );
  const activeCount = agents.filter((agent) => ACTIVE_STATUSES.includes(agent.status)).length;

  const openDrawer = (agentId: string) => {
    setDrawerAgentId(agentId);
    setLastDrawerAgentId(agentId);
  };
  const closeDrawer = () => setDrawerAgentId(null);

  // Shortcuts from the design: Esc closes the drawer, ⌘/Ctrl+F focuses search, C creates.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerAgentId(null);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchInputRef.current?.focus();
      } else if (
        event.key.toLowerCase() === "c" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target)
      ) {
        navigate("/agents/new");
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  // Keep the last agent rendered while the drawer slides closed.
  const drawerAgent = agents.find((agent) => agent.id === (drawerAgentId ?? lastDrawerAgentId));

  return (
    <main className="relative pt-12 min-h-screen bg-background w-full">
      <div className="flex flex-col w-full">
        <div className="px-6 lg:px-10 py-6 max-w-[1720px] mx-auto w-full flex flex-col gap-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <h1 className="font-headline-lg text-headline-lg font-semibold tracking-tight text-on-surface bg-gradient-to-r from-on-surface via-primary-fixed to-primary bg-clip-text text-transparent">
                  Your AI Team
                </h1>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high/70 backdrop-blur-md shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                  <span className="font-label-sm text-label-sm text-on-surface-variant font-medium tracking-wide">
                    {status === "ready" ? summarizeAgents(agents) : "Loading operatives…"}
                  </span>
                </div>
              </div>
              <p className="font-body-md text-body-md text-outline">
                Build, configure, and monitor specialized autonomous agents orchestrating across
                your local cluster.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-all shadow-sm"
                type="button"
                disabled
                title="Manifest import is not available yet"
              >
                <span className="material-symbols-outlined text-[16px] text-outline">
                  file_download
                </span>
                <span>Import Manifest</span>
              </button>
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-all shadow-sm"
                type="button"
                onClick={() => void refreshAgents()}
                title="Reload agents from the server"
              >
                <span className="material-symbols-outlined text-[16px] text-outline">sync</span>
                <span>Re-index</span>
              </button>
              <button
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold transition-all shadow-lg hover:shadow-primary/20"
                id="btn-create-agent"
                onClick={() => navigate("/agents/new")}
                type="button"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Create Agent</span>
                <kbd className="font-label-sm text-label-sm bg-on-primary/15 text-on-primary px-1.5 py-0.5 rounded ml-0.5">
                  C
                </kbd>
              </button>
            </div>
          </div>
          <AgentFilters
            agents={agents}
            filters={filters}
            onChange={setFilters}
            searchInputRef={searchInputRef}
          />
          <AgentGrid
            agents={visibleAgents}
            hasAgents={agents.length > 0}
            state={status}
            error={error}
            onRetry={() => void refreshAgents()}
            onOpen={openDrawer}
            onInspect={(agentId) => navigate(`/agents/${agentId}`)}
          />
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-surface-container-high text-secondary">
                <span className="material-symbols-outlined text-[20px]">hub</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Agents
                </span>
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {agents.length} Registered
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-surface-container-high text-primary">
                <span className="material-symbols-outlined text-[20px]">dynamic_form</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Running
                </span>
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  {activeCount} Active Agents
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-surface-container-high text-tertiary">
                <span className="material-symbols-outlined text-[20px]">electric_bolt</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Inference Speed
                </span>
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  <span className="text-outline">Not measured</span>
                </span>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-surface-container-low shadow-sm flex items-center gap-4">
              <div className="p-2.5 rounded-lg bg-surface-container-high text-secondary-fixed">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
                  Hardware Enclave
                </span>
                <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                  <span className="text-outline">Not configured</span>
                </span>
              </div>
            </div>
          </div>
        </div>
        {drawerAgent && (
          <AgentDrawer
            agent={drawerAgent}
            open={drawerAgentId !== null}
            onClose={closeDrawer}
            pending={pending[drawerAgent.id]}
            onDelete={async () => {
              await deleteAgentInStore(drawerAgent.id);
              closeDrawer();
            }}
            // A failure is reflected by the reloaded status (e.g. "Error") on the card.
            onToggle={(action) =>
              void runAgentAction(drawerAgent.id, action).catch(() => undefined)
            }
            onOpenTerminal={() => navigate(`/terminal?agent=${encodeURIComponent(drawerAgent.id)}`)}
          />
        )}
        <div
          onClick={closeDrawer}
          className={`fixed inset-0 bg-background/60 backdrop-blur-xs z-40 ${drawerAgentId === null ? "hidden " : ""}transition-opacity`}
          id="drawer-backdrop"
        />
      </div>
    </main>
  );
}
