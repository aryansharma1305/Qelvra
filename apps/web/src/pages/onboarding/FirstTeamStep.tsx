// Ported from the Stitch export (agent_hive_onboarding_choose_your_first_team/code.html). Keep visually identical to the design.
import { useState } from "react";
import { useOnboardingNavigation } from "../../components/onboarding/useOnboardingNavigation";
import { AgentRoster } from "./AgentRoster";

const TAB_ACTIVE =
  "preset-tab active px-space-md py-2 rounded-lg font-body-sm text-body-sm transition-all duration-200 flex items-center gap-space-xs bg-surface-container-highest text-on-surface shadow-sm";
const TAB_INACTIVE =
  "preset-tab px-space-md py-2 rounded-lg font-body-sm text-body-sm transition-all duration-200 flex items-center gap-space-xs text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high";

type SquadPreset = "software" | "research" | "solo" | "custom";

// TODO(PR 12+): presets should configure which agents get created; today they are visual only.
export function FirstTeamStep() {
  const { goNext, goBack } = useOnboardingNavigation();
  const [preset, setPreset] = useState<SquadPreset>("software");
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  return (
    <main className="w-full pt-16 flex-1 flex flex-col justify-center relative">
      <div className="flex flex-col w-full">
        <div className="relative w-full max-w-7xl mx-auto px-margin sm:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-xl">
          <div className="absolute -top-16 right-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <div className="absolute top-1/2 left-10 w-80 h-80 bg-secondary-container/10 rounded-full blur-3xl pointer-events-none -z-10" />
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
            <div className="space-y-space-xs max-w-2xl">
              <div className="inline-flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container-high text-secondary font-label-md text-label-md tracking-wider uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                <span>03 / 05 — Swarm Squad</span>
              </div>
              <h1 className="font-display text-display text-on-surface tracking-tight">
                Deploy your genesis squad.
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant">
                Specialized roles form emergent intelligence. You can add, swap, or fine-tune agents
                anytime.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-md p-space-sm rounded-xl bg-surface-container-low shadow-sm">
              <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container text-tertiary font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[14px]">memory</span>
                <span>Not measured</span>
              </div>
              <div className="flex items-center gap-space-xs px-space-sm py-1 rounded bg-surface-container text-secondary font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[14px]">all_inclusive</span>
                <span>Context: not measured</span>
              </div>
            </div>
          </header>
          <div
            className="flex flex-wrap items-center gap-space-xs p-1.5 rounded-xl bg-surface-container-lowest shadow-inner"
            id="preset-selector"
          >
            <button
              className={preset === "software" ? TAB_ACTIVE : TAB_INACTIVE}
              data-preset="software"
              type="button"
              aria-pressed={preset === "software"}
              onClick={() => setPreset("software")}
            >
              <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
              <span>Software Squad (4)</span>
              <span className="ml-1 px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-label-sm text-label-sm uppercase">
                Rec
              </span>
            </button>
            <button
              className={preset === "research" ? TAB_ACTIVE : TAB_INACTIVE}
              data-preset="research"
              type="button"
              aria-pressed={preset === "research"}
              onClick={() => setPreset("research")}
            >
              <span className="material-symbols-outlined text-[16px]">menu_book</span>
              <span>Research Trio (3)</span>
            </button>
            <button
              className={preset === "solo" ? TAB_ACTIVE : TAB_INACTIVE}
              data-preset="solo"
              type="button"
              aria-pressed={preset === "solo"}
              onClick={() => setPreset("solo")}
            >
              <span className="material-symbols-outlined text-[16px]">bolt</span>
              <span>Solo Super-Agent (1)</span>
            </button>
            <button
              className={preset === "custom" ? TAB_ACTIVE : TAB_INACTIVE}
              data-preset="custom"
              type="button"
              aria-pressed={preset === "custom"}
              onClick={() => setPreset("custom")}
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Customize Squad (+)</span>
            </button>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-surface-container via-surface-container-high to-surface-container p-space-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md shadow-md">
            <div className="flex items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">verified</span>
              </div>
              <div>
                <div className="flex items-center gap-space-xs">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Recommended for Software Engineering
                  </span>
                  <span className="w-2 h-2 rounded-full bg-secondary" />
                </div>
                <p className="font-body-sm text-body-sm text-on-surface-variant">
                  Pre-tuned latency weighting, automated git tree commits, and distributed
                  cross-validation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-space-sm text-on-surface-variant font-code-sm text-code-sm">
              <span className="px-space-xs py-0.5 rounded bg-surface-container-lowest text-primary font-label-sm text-label-sm">
                AUTONOMOUS MESH
              </span>
              <span>Ready for instant dispatch</span>
            </div>
          </div>
          <AgentRoster selectedIndex={selectedAgent} onSelect={setSelectedAgent} />
          <div className="rounded-xl bg-surface-container-lowest p-space-lg flex flex-col md:flex-row items-center justify-between gap-space-lg shadow-inner">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-space-lg w-full md:w-auto">
              <div className="flex items-center gap-space-sm">
                <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-[18px]">hub</span>
                </div>
                <div>
                  <div className="font-headline-sm text-headline-sm text-on-surface">
                    Topology: Star-Mesh Hybrid
                  </div>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Michael manages synchronization; specialists execute peer-to-peer data
                    interchange.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-space-sm self-end md:self-center">
              <button
                disabled
                title="Coming later — this control is not available in the beta"
                aria-label="tune — coming later"
                className="px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm hover:bg-surface-bright transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">tune</span>
                <span>Fine-tune weights</span>
              </button>
              <button
                disabled
                title="Coming later — this control is not available in the beta"
                aria-label="add — coming later"
                className="px-space-md py-1.5 rounded-lg bg-surface-container-high text-on-surface font-body-sm text-body-sm hover:bg-surface-bright transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                <span>Add agent node</span>
              </button>
            </div>
          </div>
          <footer className="pt-space-md flex items-center justify-between gap-space-md">
            <button
              type="button"
              onClick={goBack}
              className="px-space-lg py-2.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-headline-sm text-headline-sm transition-all duration-200 flex items-center gap-space-xs"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back</span>
            </button>
            <div className="flex items-center gap-space-md">
              <span className="hidden sm:inline font-code-sm text-code-sm text-on-surface-variant">
                {" "}
                Stage <strong className="text-on-surface">3 of 5</strong> auto-saved{" "}
              </span>
              <button
                type="button"
                onClick={goNext}
                className="group relative px-space-xl py-3 rounded-lg bg-primary-container text-on-primary-container font-headline-sm text-headline-sm font-semibold tracking-wide shadow-lg hover:shadow-primary-container/30 hover:brightness-110 active:scale-[0.99] transition-all duration-200 flex items-center gap-space-xs overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span>{"Confirm Squad & Configure Runtime"}</span>
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">
                  arrow_forward
                </span>
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
}
