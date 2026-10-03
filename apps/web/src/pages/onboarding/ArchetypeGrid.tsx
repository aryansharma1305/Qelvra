// Ported from the Stitch export (agent_hive_onboarding_choose_your_goal/code.html). Keep visually identical to the design.
import type React from "react";

import type { Archetype } from "./archetypes";

// The design's selected-card treatment (ring + gradient bar + "Selected" pill) applied to
// whichever archetype is chosen.
const SELECTED_RING = { boxShadow: "0 0 0 1px #8b5cf6, 0 0 24px -4px rgba(139, 92, 246, 0.35)" };

function SelectedBar() {
  return (
    <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-primary-container to-secondary" />
  );
}

function SelectedBadge() {
  return (
    <div className="flex items-center gap-space-xs">
      <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary">
        Selected
      </span>
      <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-sm">
        <span className="material-symbols-outlined text-[14px]">check</span>
      </span>
    </div>
  );
}

interface ArchetypeGridProps {
  selected: Archetype;
  onSelect: (archetype: Archetype) => void;
}

export function ArchetypeGrid({ selected, onSelect }: ArchetypeGridProps) {
  const cardProps = (archetype: Archetype) => ({
    role: "radio",
    tabIndex: 0,
    "aria-checked": selected === archetype,
    style: selected === archetype ? SELECTED_RING : undefined,
    onClick: () => onSelect(archetype),
    onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(archetype);
      }
    },
  });

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter lg:gap-gutter-lg"
      id="archetype-grid"
      role="radiogroup"
      aria-label="Agent team archetype"
    >
      <div
        className="archetype-card group relative p-space-lg rounded-xl bg-surface-container-low shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        data-archetype="software"
        {...cardProps("software")}
      >
        {selected === "software" && <SelectedBar />}
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-primary-container/20 flex items-center justify-center text-primary shadow-inner">
              <span className="material-symbols-outlined text-[20px]">terminal</span>
            </div>
            {selected === "software" && <SelectedBadge />}
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs font-code-sm text-code-sm text-secondary">
              <span>ARCHETYPE_DEV_01</span>
              <span>•</span>
              <span className="text-on-surface-variant">Turing Complete</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-primary transition-colors">
              Build software
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Full-stack engineering, test automation, refactoring, and PR orchestration.
            </p>
          </div>
        </div>
        <div className="pt-space-lg mt-space-md flex flex-col gap-space-sm bg-surface-container-lowest/50 -mx-space-lg -mb-space-lg p-space-md">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-tertiary">bolt</span>
              Est. Autonomous Velocity
            </span>
            <span className="text-tertiary font-medium">9.4k LOC/cycle</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-gradient-to-r from-primary to-secondary h-full rounded-full w-[88%]" />
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Stack: Rust • TS • Py • Go</span>
            <span className="text-secondary">MCP Bound</span>
          </div>
        </div>
      </div>
      <div
        className="archetype-card group relative p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        data-archetype="research"
        {...cardProps("research")}
      >
        {selected === "research" && <SelectedBar />}
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-secondary group-hover:bg-secondary/10 transition-colors">
              <span className="material-symbols-outlined text-[20px]">travel_explore</span>
            </div>
            {selected === "research" ? (
              <SelectedBadge />
            ) : (
              <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm">
                {" "}
                02_SYNTH{" "}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs font-code-sm text-code-sm text-outline">
              <span>ARCHETYPE_RES_02</span>
              <span>•</span>
              <span className="text-on-surface-variant">Multimodal</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-secondary transition-colors">
              Research
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Deep synthesis, paper analysis, competitive landscape mining, citation graphs.
            </p>
          </div>
        </div>
        <div className="pt-space-lg mt-space-md flex flex-col gap-space-sm bg-surface-container-lowest/40 -mx-space-lg -mb-space-lg p-space-md">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-secondary">insights</span>
              Est. Autonomous Velocity
            </span>
            <span className="text-secondary font-medium">140 Papers/hr</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full w-[72%]" />
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Graph RAG • ArXiv Sync</span>
            <span className="text-tertiary">Verified</span>
          </div>
        </div>
      </div>
      <div
        className="archetype-card group relative p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        data-archetype="content"
        {...cardProps("content")}
      >
        {selected === "content" && <SelectedBar />}
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-tertiary group-hover:bg-tertiary/10 transition-colors">
              <span className="material-symbols-outlined text-[20px]">menu_book</span>
            </div>
            {selected === "content" ? (
              <SelectedBadge />
            ) : (
              <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm">
                {" "}
                03_CORPUS{" "}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs font-code-sm text-code-sm text-outline">
              <span>ARCHETYPE_TXT_03</span>
              <span>•</span>
              <span className="text-on-surface-variant">Deterministic</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-tertiary transition-colors">
              Content
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Technical documentation, copy architectures, changelog generation, localized guides.
            </p>
          </div>
        </div>
        <div className="pt-space-lg mt-space-md flex flex-col gap-space-sm bg-surface-container-lowest/40 -mx-space-lg -mb-space-lg p-space-md">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-tertiary">translate</span>
              Est. Autonomous Velocity
            </span>
            <span className="text-tertiary font-medium">420 Pages/hr</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-tertiary h-full rounded-full w-[80%]" />
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Markdown • MDX • i18n</span>
            <span className="text-on-surface-variant">AST-Safe</span>
          </div>
        </div>
      </div>
      <div
        className="archetype-card group relative p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
        data-archetype="automation"
        {...cardProps("automation")}
      >
        {selected === "automation" && <SelectedBar />}
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-secondary group-hover:bg-secondary/10 transition-colors">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            {selected === "automation" ? (
              <SelectedBadge />
            ) : (
              <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm">
                {" "}
                04_CRON{" "}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs font-code-sm text-code-sm text-outline">
              <span>ARCHETYPE_OPS_04</span>
              <span>•</span>
              <span className="text-on-surface-variant">Continuous</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-secondary transition-colors">
              Automation
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Background cron jobs, CI/CD pipeline healing, telemetry triage, cloud audits.
            </p>
          </div>
        </div>
        <div className="pt-space-lg mt-space-md flex flex-col gap-space-sm bg-surface-container-lowest/40 -mx-space-lg -mb-space-lg p-space-md">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-secondary">memory</span>
              Est. Autonomous Velocity
            </span>
            <span className="text-secondary font-medium">1.2k Events/sec</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-secondary h-full rounded-full w-[94%]" />
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Daemon • Webhooks • K8s</span>
            <span className="text-tertiary">Live Loop</span>
          </div>
        </div>
      </div>
      <div
        className="archetype-card group relative p-space-lg rounded-xl bg-surface-container-low hover:bg-surface-container shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden md:col-span-2 lg:col-span-1"
        data-archetype="custom"
        {...cardProps("custom")}
      >
        {selected === "custom" && <SelectedBar />}
        <div className="flex flex-col gap-space-md">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center text-on-surface-variant group-hover:text-primary group-hover:bg-primary/10 transition-colors">
              <span className="material-symbols-outlined text-[20px]">architecture</span>
            </div>
            {selected === "custom" ? (
              <SelectedBadge />
            ) : (
              <span className="font-label-sm text-label-sm uppercase px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-code-sm">
                {" "}
                05_TABULA{" "}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-space-xs">
            <div className="flex items-center gap-space-xs font-code-sm text-code-sm text-outline">
              <span>ARCHETYPE_CUSTOM_05</span>
              <span>•</span>
              <span className="text-on-surface-variant">Sovereign</span>
            </div>
            <h2 className="font-headline-md text-headline-md text-on-surface tracking-tight group-hover:text-primary transition-colors">
              Custom
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
              Blank canvas for designing proprietary agent loops, custom skills, and tailored MCP
              servers.
            </p>
          </div>
        </div>
        <div className="pt-space-lg mt-space-md flex flex-col gap-space-sm bg-surface-container-lowest/40 -mx-space-lg -mb-space-lg p-space-md">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-primary">
                dynamic_form
              </span>
              Est. Autonomous Velocity
            </span>
            <span className="text-primary font-medium">User Tuned</span>
          </div>
          <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full w-[50%]" />
          </div>
          <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-label-sm uppercase">
            <span>Raw Protocol • Zero Defaults</span>
            <span className="text-secondary">Unconstrained</span>
          </div>
        </div>
      </div>
    </div>
  );
}
