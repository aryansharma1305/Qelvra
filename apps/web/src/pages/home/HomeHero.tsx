import { useState } from "react";
import { useNavigate } from "react-router";
import type { ConnectionState } from "../../features/activity/activity-client";
import { useAgents } from "../../features/agents/agents-store";
import { ACTIVE_STATUSES } from "../../features/agents/presentation";
// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.

export function HomeHero({ activityState }: { activityState: ConnectionState }) {
  const { agents } = useAgents();
  const [description, setDescription] = useState("");
  const navigate = useNavigate();
  const active = agents.filter((agent) => ACTIVE_STATUSES.includes(agent.status)).length;
  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest">
              MISSION DIRECTORY
            </span>
            <span className="inline-block w-1 h-1 rounded-full bg-outline-variant" />
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              LOCAL WORKSPACE
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
            Welcome to{" "}
            <span className="bg-gradient-to-r from-on-surface via-primary to-secondary bg-clip-text text-transparent">
              Qelvra
            </span>
            .
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Your agent collective has{" "}
            <span className="text-on-surface font-medium">{agents.length} registered agents</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-center bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/20 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
            <span className="font-code-sm text-code-sm text-on-surface font-medium">
              {activityState === "live"
                ? "Activity live"
                : activityState === "error"
                  ? "Activity paused"
                  : "Connecting…"}
            </span>
          </div>
          <span className="text-outline-variant/60 font-code-sm text-code-sm">/</span>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[15px] text-tertiary">group_work</span>
            <span>{active} Active Operatives</span>
          </div>
          <span className="text-outline-variant/60 font-code-sm text-code-sm">/</span>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[15px] text-secondary">speed</span>
            <span>Latency: —</span>
          </div>
        </div>
      </div>
      <div className="relative w-full rounded-2xl bg-surface-container-low/90 backdrop-blur-xl border border-primary/20 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] p-3 sm:p-4 transition-all duration-300 focus-within:border-primary/60 focus-within:shadow-[0_0_24px_rgba(208,188,255,0.15)]">
        <div className="flex items-start gap-3 w-full">
          <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container-high text-primary shadow-inner">
            <span className="material-symbols-outlined text-[18px]">neurology</span>
          </div>
          <textarea
            aria-label="Goal draft"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="w-full bg-transparent resize-none outline-none font-body-lg text-body-lg text-on-surface placeholder:text-outline font-normal py-1"
            placeholder={
              "What should your team work on? (e.g. Audit biometric passkey fallback & synthesize performance benchmarks)"
            }
            rows={2}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-outline-variant/20">
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled
              title="Coming later — this control is not available in the beta"
              aria-label="attach file — coming later"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-body-sm font-body-sm transition-all duration-150"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">
                attach_file
              </span>
              <span>Attach context / files</span>
            </button>
            <div className="relative group">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all duration-150">
                <span className="material-symbols-outlined text-[15px] text-secondary">bolt</span>
                <span>
                  Project:{" "}
                  <strong className="text-on-surface font-medium">Isolated workspaces</strong>
                </span>
                <span className="material-symbols-outlined text-[14px] text-outline">
                  arrow_drop_down
                </span>
              </div>
            </div>
            <div className="relative group">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all duration-150">
                <span className="material-symbols-outlined text-[15px] text-primary">
                  psychology
                </span>
                <span>
                  Orchestrator:{" "}
                  <strong className="text-on-surface font-medium">Choose in Goals</strong>
                </span>
                <span className="material-symbols-outlined text-[14px] text-outline">
                  arrow_drop_down
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              disabled
              title="Coming later — this control is not available in the beta"
              aria-label="Voice input"
              className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-outline hover:text-primary transition-colors"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">graphic_eq</span>{" "}
            </button>
            <button
              aria-label="Create Goal"
              onClick={() => navigate("/tasks?view=goals", { state: { draftGoal: description } })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold tracking-tight shadow-[0_0_16px_rgba(208,188,255,0.35)] transition-all duration-200"
              type="button"
            >
              <span>Create Goal</span>
              <kbd className="font-label-sm text-label-sm bg-on-primary/20 px-1.5 py-0.5 rounded text-on-primary">
                →
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
