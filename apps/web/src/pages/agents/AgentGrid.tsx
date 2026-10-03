import type { Agent } from "@qelvra/shared";
import { Link } from "react-router";
import { toDirectoryCard } from "../../features/agents/presentation";
import { useNow } from "../../hooks/useNow";
import { DirectoryAgentCard } from "./DirectoryAgentCard";

interface AgentGridProps {
  agents: readonly Agent[];
  /** Whether any agents exist at all (vs. none matching the filters). */
  hasAgents: boolean;
  state: "idle" | "loading" | "ready" | "error";
  error: string | null;
  onRetry: () => void;
  onOpen: (agentId: string) => void;
  onInspect: (agentId: string) => void;
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="col-span-full py-12 flex flex-col items-center gap-3 text-center rounded-2xl bg-surface-container-low">
      {children}
    </div>
  );
}

export function AgentGrid({
  agents,
  hasAgents,
  state,
  error,
  onRetry,
  onOpen,
  onInspect,
}: AgentGridProps) {
  const now = useNow();
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
      id="agents-grid"
      aria-busy={state === "loading"}
    >
      {agents.map((agent) => (
        <DirectoryAgentCard
          key={agent.id}
          agent={toDirectoryCard(agent, now)}
          onOpen={() => onOpen(agent.id)}
          onInspect={() => onInspect(agent.id)}
        />
      ))}
      {agents.length === 0 && state === "error" && (
        <Notice>
          <span className="material-symbols-outlined text-[28px] text-error">cloud_off</span>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Could not load agents: {error}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-body-sm text-body-sm"
          >
            Retry
          </button>
        </Notice>
      )}
      {agents.length === 0 && (state === "loading" || state === "idle") && (
        <Notice>
          <p className="font-body-sm text-body-sm text-outline">Loading agents…</p>
        </Notice>
      )}
      {agents.length === 0 && state === "ready" && !hasAgents && (
        <Notice>
          <span className="material-symbols-outlined text-[28px] text-outline">smart_toy</span>
          <p className="font-body-md text-body-md text-on-surface-variant">No agents yet.</p>
          <Link
            to="/agents/new"
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create your first agent
          </Link>
        </Notice>
      )}
      {agents.length === 0 && state === "ready" && hasAgents && (
        <p className="col-span-full py-10 text-center font-body-sm text-body-sm text-outline">
          No agents match the current filters.
        </p>
      )}
    </div>
  );
}
