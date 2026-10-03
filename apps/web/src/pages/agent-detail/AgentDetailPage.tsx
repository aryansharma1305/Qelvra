// Ported from the Stitch export (agent_hive_nova_profile/code.html). Keep visually identical to the design.
import type { Agent } from "@qelvra/shared";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
import { deleteAgentInStore, runAgentAction, useAgents } from "../../features/agents/agents-store";
import { STATUS_GROUP } from "../../features/agents/presentation";
import { AgentProfileHeader } from "./AgentProfileHeader";
import { PendingPanel } from "./PendingPanel";

const BREADCRUMB_DOT = {
  working: "bg-secondary",
  thinking: "bg-primary",
  waiting: "bg-secondary-fixed",
  offline: "bg-outline",
} as const;

export function AgentDetailPage({ agent: loaded }: { agent: Agent }) {
  const navigate = useNavigate();
  const { agents, pending } = useAgents();
  // The shared list has the latest status (after lifecycle actions and on focus).
  const agent = agents.find((a) => a.id === loaded.id) ?? loaded;
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async () => {
    await deleteAgentInStore(agent.id);
    navigate("/agents");
  };
  const act = (action: "start" | "stop" | "restart") => {
    setActionError(null);
    runAgentAction(agent.id, action).catch((error: unknown) =>
      setActionError(error instanceof Error ? error.message : `Could not ${action} the agent`),
    );
  };

  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full text-on-surface">
        <div className="relative w-full overflow-hidden">
          <div className="absolute -top-32 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />{" "}
          <div className="absolute top-12 right-1/4 w-80 h-80 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />{" "}
          <div className="relative z-10 p-space-md lg:p-space-lg flex flex-col gap-space-md">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs font-label-md text-label-md text-on-surface-variant">
                <Link
                  className="hover:text-primary transition-colors flex items-center gap-1"
                  to="/"
                >
                  <span className="material-symbols-outlined text-[16px]">hub</span>
                  <span>Workspace</span>
                </Link>
                <span className="text-outline-variant">/</span>
                <Link className="hover:text-primary transition-colors" to="/agents">
                  Agents
                </Link>
                <span className="text-outline-variant">/</span>
                <span className="text-primary font-medium flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${BREADCRUMB_DOT[STATUS_GROUP[agent.status]]}`}
                  />
                  {agent.name} ({agent.id})
                </span>
              </div>
              <div className="flex items-center gap-space-sm">
                <button
                  type="button"
                  onClick={() => navigate("/agents")}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-all shadow-sm"
                >
                  <span className="material-symbols-outlined text-[15px]">arrow_back</span>
                  <span>Directory</span>
                </button>
                <div className="h-4 w-px bg-surface-variant mx-0.5" />
                <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-surface-container-low font-code-sm text-code-sm text-on-surface-variant">
                  <span className="text-outline">RUNTIME:</span>
                  <span className="text-outline font-medium">Not configured</span>
                </div>
              </div>
            </div>
            <AgentProfileHeader
              agent={agent}
              pending={pending[agent.id]}
              onAction={act}
              onOpenTerminal={() => navigate(`/terminal?agent=${encodeURIComponent(agent.id)}`)}
              onDelete={remove}
            />
            {actionError && (
              <p role="alert" className="font-code-sm text-code-sm text-error -mt-2">
                {actionError}
              </p>
            )}
            {/* Same grid as the design; each panel's feature arrives in a later release. */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-md items-start">
              <PendingPanel
                className="lg:col-span-3"
                icon="tune"
                title="Directives & Stack"
                message="No provider or system directive configured. These arrive with AI providers."
              />
              <div className="lg:col-span-6 flex flex-col gap-space-md">
                <PendingPanel
                  icon="flag"
                  title="Active Mission"
                  message="No task assigned. Tasks arrive with the task system."
                />
                <PendingPanel
                  icon="terminal"
                  title="Terminal"
                  message={
                    agent.status === "running"
                      ? "The agent's shell is running. Open Terminal to use it."
                      : "Not running. Start the agent to get a shell."
                  }
                />
              </div>
              <PendingPanel
                className="lg:col-span-3"
                icon="query_stats"
                title="Throughput"
                message="No telemetry yet."
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
