// Ported from the Stitch export (agent_hive_onboarding_workspace_ready/code.html). Keep visually identical to the design.

export function LaunchedTeam() {
  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter mb-space-xl">
      <div className="bg-surface-container/80 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-300 hover:bg-surface-container-high/90 group shadow-md">
        <div>
          <div className="flex items-center justify-between gap-space-xs mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
                Active
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-outline-variant bg-surface-container-lowest px-2 py-0.5 rounded">
              0x01_ORCH
            </span>
          </div>
          <div className="flex items-center gap-space-md mb-space-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">alt_route</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">
                Michael
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                Master Orchestrator
              </p>
            </div>
          </div>
          <div className="mt-space-md py-space-xs px-space-sm rounded bg-surface-container-lowest/70 font-code-sm text-code-sm text-on-surface-variant mb-space-sm">
            <span className="text-tertiary mr-1.5">•</span>
            {"Online & Listening"}
          </div>
          <p className="font-body-sm text-body-sm text-outline">Loaded reasoning matrix [100%]</p>
        </div>
        <div className="mt-space-lg pt-space-md bg-surface-container-lowest/30">
          <div className="flex items-center justify-between font-code-sm text-code-sm mb-1.5">
            <span className="text-on-surface-variant">Cognitive Engine</span>
            <span className="text-tertiary">100%</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-tertiary w-full" />
          </div>
        </div>
      </div>
      <div className="bg-surface-container/80 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-300 hover:bg-surface-container-high/90 group shadow-md">
        <div>
          <div className="flex items-center justify-between gap-space-xs mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
                Active
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-outline-variant bg-surface-container-lowest px-2 py-0.5 rounded">
              0x02_VITE
            </span>
          </div>
          <div className="flex items-center gap-space-md mb-space-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-secondary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">developer_mode_tv</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">Nova</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                Frontend Architect
              </p>
            </div>
          </div>
          <div className="mt-space-md py-space-xs px-space-sm rounded bg-surface-container-lowest/70 font-code-sm text-code-sm text-on-surface-variant mb-space-sm">
            <span className="text-tertiary mr-1.5">•</span>
            Vite / Tailwind PTY Ready
          </div>
          <p className="font-body-sm text-body-sm text-outline">
            Sub-pixel UI parser mounted [100%]
          </p>
        </div>
        <div className="mt-space-lg pt-space-md bg-surface-container-lowest/30">
          <div className="flex items-center justify-between font-code-sm text-code-sm mb-1.5">
            <span className="text-on-surface-variant">Virtual DOM Hook</span>
            <span className="text-tertiary">100%</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-secondary to-tertiary w-full" />
          </div>
        </div>
      </div>
      <div className="bg-surface-container/80 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-300 hover:bg-surface-container-high/90 group shadow-md">
        <div>
          <div className="flex items-center justify-between gap-space-xs mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
                Active
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-outline-variant bg-surface-container-lowest px-2 py-0.5 rounded">
              0x03_PGSQL
            </span>
          </div>
          <div className="flex items-center gap-space-md mb-space-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary-fixed group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">database</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">Atlas</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {"Backend & IPC Engine"}
              </p>
            </div>
          </div>
          <div className="mt-space-md py-space-xs px-space-sm rounded bg-surface-container-lowest/70 font-code-sm text-code-sm text-on-surface-variant mb-space-sm">
            <span className="text-tertiary mr-1.5">•</span>
            IPC Sockets Bound
          </div>
          <p className="font-body-sm text-body-sm text-outline">
            Postgres schema inspector active [100%]
          </p>
        </div>
        <div className="mt-space-lg pt-space-md bg-surface-container-lowest/30">
          <div className="flex items-center justify-between font-code-sm text-code-sm mb-1.5">
            <span className="text-on-surface-variant">Schema Channel</span>
            <span className="text-tertiary">100%</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-primary to-tertiary w-full" />
          </div>
        </div>
      </div>
      <div className="bg-surface-container/80 backdrop-blur-md rounded-xl p-space-lg flex flex-col justify-between transition-all duration-300 hover:bg-surface-container-high/90 group shadow-md">
        <div>
          <div className="flex items-center justify-between gap-space-xs mb-space-md">
            <div className="flex items-center gap-space-xs">
              <span className="w-2 h-2 rounded-full bg-tertiary shadow-[0_0_8px_rgba(78,222,163,0.8)]" />
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-tertiary">
                Active
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-outline-variant bg-surface-container-lowest px-2 py-0.5 rounded">
              0x04_E2E
            </span>
          </div>
          <div className="flex items-center gap-space-md mb-space-sm">
            <div className="w-10 h-10 rounded-lg bg-surface-container-highest flex items-center justify-center text-tertiary group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[22px]">verified_user</span>
            </div>
            <div className="min-w-0">
              <h3 className="font-headline-sm text-headline-sm text-on-surface truncate">Scout</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                {"QA & Verification Lead"}
              </p>
            </div>
          </div>
          <div className="mt-space-md py-space-xs px-space-sm rounded bg-surface-container-lowest/70 font-code-sm text-code-sm text-on-surface-variant mb-space-sm">
            <span className="text-tertiary mr-1.5">•</span>
            Playwright Headless Ready
          </div>
          <p className="font-body-sm text-body-sm text-outline">
            Synthetic test harness primed [100%]
          </p>
        </div>
        <div className="mt-space-lg pt-space-md bg-surface-container-lowest/30">
          <div className="flex items-center justify-between font-code-sm text-code-sm mb-1.5">
            <span className="text-on-surface-variant">Trace Integrity</span>
            <span className="text-tertiary">100%</span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-tertiary to-secondary w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
