// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.
import { useLinkBehavior } from "../../hooks/useLinkBehavior";
import { HOME_OPERATIVES } from "../../mocks/agents";
import { OperativeCard } from "./OperativeCard";
import { useAgents } from "../../features/agents/agents-store";
import { Link, useNavigate } from "react-router";

export function ActiveOperatives() {
  const navigate = useNavigate();
  const { agents, status } = useAgents();
  if (status === "ready" && !agents.length)
    return (
      <section className="rounded-2xl bg-surface-container-low p-6 flex flex-col gap-3">
        <h2 className="font-headline-md text-headline-md">Create your first agent</h2>
        <p>Choose a local provider, then create a task or goal. Your workspace starts empty.</p>
        <Link
          to="/agents/new"
          className="self-start px-4 py-2 rounded-lg bg-primary text-on-primary"
        >
          Create Agent
        </Link>
      </section>
    );
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="material-symbols-outlined text-[20px] text-primary">hub</span>
          <h2 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
            Sample agent cards
          </h2>
          <span className="font-label-sm text-label-sm px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">
            COMING LATER
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="pause circle — coming later"
            className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors flex items-center gap-1.5"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">pause_circle</span>
            <span>Pause All</span>
          </button>
          <button
            className="px-3 py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors flex items-center gap-1.5"
            type="button"
            onClick={() => navigate("/network")}
          >
            <span className="material-symbols-outlined text-[15px]">account_tree</span>
            <span>Topology Graph</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <OrchestratorCard />
        {HOME_OPERATIVES.map((operative) => (
          <OperativeCard key={operative.id} operative={operative} />
        ))}
      </div>
    </div>
  );
}

export function OrchestratorCard() {
  const link = useLinkBehavior("/agents");
  return (
    <div
      {...link}
      className="lg:col-span-2 rounded-2xl bg-surface-container-low p-6 border border-primary/30 relative overflow-hidden flex flex-col justify-between shadow-[0_8px_32px_-4px_rgba(0,0,0,0.5)]"
    >
      <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div>
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-outline-variant/20">
          <div className="flex items-center gap-3.5">
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-primary to-secondary p-0.5 shadow-md">
              <div className="w-full h-full bg-surface-container-lowest rounded-[10px] flex items-center justify-center relative overflow-hidden">
                <span className="material-symbols-outlined text-[24px] text-primary">grain</span>
                <span className="absolute inset-0 bg-primary/15 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
                  Michael
                </h3>
                <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 uppercase">
                  Lead Orchestrator
                </span>
              </div>
              <p className="font-code-sm text-code-sm text-outline mt-0.5">
                Runtime: o3-mini (High Reasoning) • DAG Controller
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-tertiary/10 border border-tertiary/20 text-tertiary font-code-sm text-code-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping" />
              <span>Coming later</span>
            </span>
            <button
              disabled
              title="Coming later — this control is not available in the beta"
              aria-label="more horiz — coming later"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">more_horiz</span>{" "}
            </button>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
            Sample task — no live work
          </span>
          <p className="font-body-lg text-body-lg text-on-surface font-medium">
            {"Decomposing Auth0 + Biometric passkey pipeline & dispatching tasks to worker mesh"}
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex justify-between items-center font-code-sm text-code-sm">
            <span className="text-on-surface-variant">Sample workflow — no live work</span>
            <span className="text-primary font-medium">Not measured</span>
          </div>
          <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-secondary w-0 rounded-full transition-all duration-500" />
          </div>
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm pt-1">
            <span className="text-tertiary flex items-center gap-1">✓ Schema Validation</span>
            <span className="text-tertiary flex items-center gap-1">✓ Threat Modeling</span>
            <span className="text-primary flex items-center gap-1">● Sub-Agent Dispatch</span>
            <span className="text-outline">○ End-to-End Attestation</span>
          </div>
        </div>
      </div>
      <div className="mt-6 pt-4 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-outline uppercase">Sample roles:</span>
          <div className="flex items-center -space-x-1.5">
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-code-sm font-code-sm border border-outline-variant/30">
              Nova
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-code-sm font-code-sm border border-outline-variant/30">
              Atlas
            </span>
            <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface text-code-sm font-code-sm border border-outline-variant/30">
              Scout
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 font-code-sm text-code-sm text-outline">
          <span className="material-symbols-outlined text-[15px] text-tertiary">outgoing_mail</span>
          <span>
            Sample event — no live work{" "}
            <strong className="text-on-surface-variant font-medium">Atlas</strong> Not measured
          </span>
        </div>
      </div>
    </div>
  );
}
