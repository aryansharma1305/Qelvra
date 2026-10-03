// Ported from the Stitch export (agent_hive_onboarding_choose_your_goal/code.html). Keep visually identical to the design.
import { useState } from "react";
import { useOnboardingNavigation } from "../../components/onboarding/useOnboardingNavigation";
import { ArchetypeGrid } from "./ArchetypeGrid";
import type { Archetype } from "./archetypes";

const TOOLS_BY_ARCHETYPE: Record<Archetype, string> = {
  software: "7 standard tools",
  research: "5 synthesis tools",
  content: "4 generation tools",
  automation: "8 telemetry tools",
  custom: "0 default tools",
};

// TODO(PR 12+): persist the chosen archetype once workspace setup has a backend.
export function GoalStep() {
  const { goNext, goBack } = useOnboardingNavigation();
  const [archetype, setArchetype] = useState<Archetype>("software");
  return (
    <main className="w-full pt-16 flex-1 flex flex-col justify-center relative">
      <div className="flex flex-col w-full">
        <div className="relative w-full max-w-7xl mx-auto px-margin sm:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-xl">
          <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-gradient-to-b from-primary/10 via-secondary/5 to-transparent blur-3xl -z-10 rounded-full" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
            <div className="flex flex-col gap-space-xs max-w-2xl">
              <div className="flex items-center gap-space-sm font-label-md text-label-md uppercase tracking-wider text-secondary">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-secondary/10 text-secondary font-code-sm text-code-sm">
                  02
                </span>
                <span className="text-outline-variant">/</span>
                <span className="text-on-surface-variant font-code-sm text-code-sm">
                  05 — Purpose
                </span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
                What will your agents build first?
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant leading-relaxed">
                Select an operational archetype. Qelvra calibrates autonomy protocols, toolkits, and
                agent archetypes accordingly.
              </p>
            </div>
            <div className="flex items-center gap-space-md p-space-sm rounded-lg bg-surface-container-low shadow-sm">
              <div className="flex flex-col text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Runtime Core
                </span>
                <span className="font-code-sm text-code-sm text-tertiary flex items-center gap-1.5 justify-end">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                  v3.8-hypervisor
                </span>
              </div>
              <div className="w-px h-7 bg-surface-variant" />
              <div className="flex flex-col text-right">
                <span className="font-label-sm text-label-sm text-on-surface-variant uppercase">
                  Telemetry
                </span>
                <span className="font-code-sm text-code-sm text-secondary">Low Latency</span>
              </div>
            </div>
          </div>
          <ArchetypeGrid selected={archetype} onSelect={setArchetype} />
          <div className="rounded-xl bg-surface-container-lowest p-space-md flex flex-col lg:flex-row lg:items-center justify-between gap-space-md shadow-sm">
            <div className="flex items-start sm:items-center gap-space-md">
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0">
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Auto-injected MCP Server Matrix
                </span>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Selected archetype activates{" "}
                  <span className="text-primary font-code-sm" id="active-tools-count">
                    {TOOLS_BY_ARCHETYPE[archetype]}
                  </span>{" "}
                  (GitHub, Postgres, FileSystem, Docker, Linear, Shell, Redis).
                </span>
              </div>
            </div>
            <div className="flex items-center gap-space-xs overflow-x-auto py-1">
              <span className="px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                git
              </span>
              <span className="px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                fs-bridge
              </span>
              <span className="px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                pty-exec
              </span>
              <span className="px-space-sm py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                +4 more
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-space-md">
            <button
              onClick={goBack}
              className="h-10 px-space-lg rounded-lg bg-surface-container-high hover:bg-surface-variant text-on-surface-variant hover:text-on-surface font-body-md text-body-md flex items-center gap-space-xs transition-colors shadow-sm"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back</span>
            </button>
            <div className="flex items-center gap-space-md">
              <span className="hidden sm:inline-flex items-center gap-space-xs text-on-surface-variant font-code-sm text-code-sm">
                <span>Press</span>
                <kbd className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/30 text-[10px]">
                  ⌘ ↵
                </kbd>
              </span>
              <button
                className="h-11 px-space-xl rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-headline-sm flex items-center gap-space-sm transition-all duration-200 shadow-md hover:bg-primary hover:shadow-[0_0_20px_rgba(139,92,246,0.4)] active:scale-[0.98]"
                id="continue-btn"
                onClick={goNext}
                type="button"
              >
                <span>Continue to Team Selection</span>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
