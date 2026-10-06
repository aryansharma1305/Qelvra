// Ported from the Stitch export (agent_hive_onboarding_choose_your_first_team/code.html). Keep visually identical to the design.

import type { KeyboardEvent } from "react";

interface AgentRosterProps {
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function AgentRoster({ selectedIndex, onSelect }: AgentRosterProps) {
  const cardProps = (index: number) => ({
    tabIndex: 0,
    "aria-pressed": selectedIndex === index,
    onClick: () => onSelect(index),
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(index);
      }
    },
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-gutter-lg" id="agent-roster">
      <article
        className={`agent-card group relative flex flex-col justify-between rounded-xl bg-surface-container-low p-space-lg shadow-sm hover:shadow-xl hover:bg-surface-container transition-all duration-200 cursor-pointer${selectedIndex === 0 ? " ring-2 ring-primary" : ""}`}
        {...cardProps(0)}
      >
        <div className="space-y-space-md">
          <div className="flex items-start justify-between gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-mono">
                NODE // 01
              </span>
            </div>
            <span className="px-space-xs py-0.5 rounded bg-primary-container/20 text-primary font-label-sm text-label-sm uppercase font-mono tracking-wider">
              Core Lead
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <img
              className="w-14 h-14 rounded-lg object-cover bg-surface-container-high"
              data-alt="High tech minimal cybernetic avatar portrait representing an analytical system orchestrator named Michael, moody ambient violet volumetric lighting, ultra detailed obsidian finish, cinematic studio render"
              src="/stitch/avatar-michael.jpg"
            />
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Michael</h3>
              <p className="font-body-sm text-body-sm text-primary font-medium">Orchestrator</p>
            </div>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-lowest space-y-space-xs">
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Primary Model</span>
              <span className="text-on-surface font-mono">Reasoning Engine</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Status</span>
              <span className="text-secondary font-mono">Autonomous Lead</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Throughput</span>
              <span className="text-on-surface font-mono">Not measured</span>
            </div>
          </div>
          <div className="space-y-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Domain Focus
            </span>
            <p className="font-body-sm text-body-sm text-on-surface">
              Multi-agent consensus, plan decomposition, critical telemetry loops.
            </p>
          </div>
        </div>
        <div className="mt-space-lg pt-space-sm flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">psychology</span>
            <span>Meta-Planner</span>
          </span>
          <span className="material-symbols-outlined text-[16px] group-hover:text-primary transition-colors">
            arrow_forward
          </span>
        </div>
      </article>
      <article
        className={`agent-card group relative flex flex-col justify-between rounded-xl bg-surface-container-low p-space-lg shadow-sm hover:shadow-xl hover:bg-surface-container transition-all duration-200 cursor-pointer${selectedIndex === 1 ? " ring-2 ring-primary" : ""}`}
        {...cardProps(1)}
      >
        <div className="space-y-space-md">
          <div className="flex items-start justify-between gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-mono">
                NODE // 02
              </span>
            </div>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase font-mono tracking-wider">
              Specialist
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <img
              className="w-14 h-14 rounded-lg object-cover bg-surface-container-high"
              data-alt="High tech minimalist synthetic agent portrait named Nova, representing a front-end UI engineer, cyan telemetry lighting, geometric obsidian accents, refined futuristic portrait"
              src="/stitch/avatar-nova-portrait.jpg"
            />
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Nova</h3>
              <p className="font-body-sm text-body-sm text-secondary font-medium">
                Frontend Engineer
              </p>
            </div>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-lowest space-y-space-xs">
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Primary Model</span>
              <span className="text-on-surface font-mono">Claude-3.7-Sonnet</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Core Tool</span>
              <span className="text-secondary font-mono truncate max-w-[120px]">
                {"ast_grep & DOM"}
              </span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Specialty</span>
              <span className="text-on-surface font-mono">UI Architecture</span>
            </div>
          </div>
          <div className="space-y-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Technical Stack
            </span>
            <p className="font-body-sm text-body-sm text-on-surface">
              React, Tailwind CSS, DOM synthesis, responsive design engineering.
            </p>
          </div>
        </div>
        <div className="mt-space-lg pt-space-sm flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">view_quilt</span>
            <span>Client Architecture</span>
          </span>
          <span className="material-symbols-outlined text-[16px] group-hover:text-secondary transition-colors">
            arrow_forward
          </span>
        </div>
      </article>
      <article
        className={`agent-card group relative flex flex-col justify-between rounded-xl bg-surface-container-low p-space-lg shadow-sm hover:shadow-xl hover:bg-surface-container transition-all duration-200 cursor-pointer${selectedIndex === 2 ? " ring-2 ring-primary" : ""}`}
        {...cardProps(2)}
      >
        <div className="space-y-space-md">
          <div className="flex items-start justify-between gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-secondary" />
              <span className="font-label-sm text-label-sm text-secondary uppercase tracking-widest font-mono">
                NODE // 03
              </span>
            </div>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase font-mono tracking-wider">
              Specialist
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <img
              className="w-14 h-14 rounded-lg object-cover bg-surface-container-high"
              data-alt="High tech minimalist synthetic human agent portrait named Atlas, representing backend systems architect, warm amber and violet side lighting, sharp precision cyberware, dark background"
              src="/stitch/avatar-atlas.jpg"
            />
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Atlas</h3>
              <p className="font-body-sm text-body-sm text-secondary font-medium">
                Backend Engineer
              </p>
            </div>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-lowest space-y-space-xs">
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Primary Model</span>
              <span className="text-on-surface font-mono">DeepSeek-R1-671B</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Core Tool</span>
              <span className="text-secondary font-mono truncate max-w-[120px]">DB Migrations</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Specialty</span>
              <span className="text-on-surface font-mono">Distributed Ops</span>
            </div>
          </div>
          <div className="space-y-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Technical Stack
            </span>
            <p className="font-body-sm text-body-sm text-on-surface">
              Node.js, Python, PostgreSQL, RPC pipelines, API contract safety.
            </p>
          </div>
        </div>
        <div className="mt-space-lg pt-space-sm flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">database</span>
            <span>Persistence Layer</span>
          </span>
          <span className="material-symbols-outlined text-[16px] group-hover:text-secondary transition-colors">
            arrow_forward
          </span>
        </div>
      </article>
      <article
        className={`agent-card group relative flex flex-col justify-between rounded-xl bg-surface-container-low p-space-lg shadow-sm hover:shadow-xl hover:bg-surface-container transition-all duration-200 cursor-pointer${selectedIndex === 3 ? " ring-2 ring-primary" : ""}`}
        {...cardProps(3)}
      >
        <div className="space-y-space-md">
          <div className="flex items-start justify-between gap-space-xs">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary" />
              <span className="font-label-sm text-label-sm text-tertiary uppercase tracking-widest font-mono">
                NODE // 04
              </span>
            </div>
            <span className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-label-sm uppercase font-mono tracking-wider">
              Quality Lead
            </span>
          </div>
          <div className="flex items-center gap-space-md">
            <img
              className="w-14 h-14 rounded-lg object-cover bg-surface-container-high"
              data-alt="High tech minimalist synthetic human agent portrait named Scout, representing QA E2E and security tester, subtle green radar glow, sleek dark headset, focused expression"
              src="/stitch/avatar-scout.jpg"
            />
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Scout</h3>
              <p className="font-body-sm text-body-sm text-tertiary font-medium">
                {"QA & E2E Lead"}
              </p>
            </div>
          </div>
          <div className="p-space-sm rounded-lg bg-surface-container-lowest space-y-space-xs">
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Primary Model</span>
              <span className="text-on-surface font-mono">GPT-4o-Mini-Fast</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Core Tool</span>
              <span className="text-tertiary font-mono truncate max-w-[120px]">Playwright E2E</span>
            </div>
            <div className="flex justify-between items-center font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Specialty</span>
              <span className="text-on-surface font-mono">Sandboxing</span>
            </div>
          </div>
          <div className="space-y-space-xs">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              Technical Stack
            </span>
            <p className="font-body-sm text-body-sm text-on-surface">
              Edge testing, penetration checks, DOM assertions, headless browser suites.
            </p>
          </div>
        </div>
        <div className="mt-space-lg pt-space-sm flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">format_image_left</span>
            <span>{"Security & Verif"}</span>
          </span>
          <span className="material-symbols-outlined text-[16px] group-hover:text-tertiary transition-colors">
            arrow_forward
          </span>
        </div>
      </article>
    </div>
  );
}
