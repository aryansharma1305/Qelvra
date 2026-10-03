// Ported from the Stitch export (agent_hive_mission_control/code.html). Keep visually identical to the design.

export function MissionControlHeader() {
  return (
    <div className="px-6 py-5 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-md">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
              Mission Control
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Sprint v2.4 Active
            </span>
            <span className="font-code-sm text-code-sm text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">alt_route</span>
              Epoch #084
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Track work delegated across your AI team with sovereign telemetry.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-surface-container-low p-1 rounded border border-outline-variant/30">
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high text-primary font-body-sm text-body-sm font-medium shadow-sm transition-all"
              id="btn-kanban"
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              <span>Kanban</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px]">view_stream</span>
              <span>List</span>
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
              <span>DAG</span>
            </button>
          </div>
          <div className="h-6 w-px bg-outline-variant/30 hidden sm:block" />
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface border border-outline-variant/30 font-body-sm text-body-sm transition-all">
            <span className="material-symbols-outlined text-[16px]">filter_list</span>
            <span>Filter: All Swarms</span>
            <span className="material-symbols-outlined text-[14px]">expand_more</span>
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-secondary border border-secondary/20 hover:border-secondary/40 font-code-sm text-code-sm transition-all">
            <span className="material-symbols-outlined text-[16px] text-secondary">balance</span>
            <span>Auto-balance</span>
          </button>
          <button className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary shadow-[0_0_16px_rgba(160,120,255,0.35)] transition-all">
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>New Mission</span>
            <kbd className="font-label-sm text-label-sm px-1.5 py-0.2 rounded bg-black/25 text-white/90">
              ⌘N
            </kbd>
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">
                donut_large
              </span>
              Sprint Progress
            </span>
            <span className="font-code-sm text-code-sm text-primary font-semibold">
              42% (6/14 Done)
            </span>
          </div>
          <div className="mt-2.5">
            <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden flex">
              <div className="h-full bg-gradient-to-r from-primary via-primary-container to-secondary w-[42%] transition-all duration-700" />
            </div>
            <div className="flex justify-between font-label-sm text-label-sm text-outline mt-1.5">
              <span>Burn-down rate: 1.8 Tsk/hr</span>
              <span>Target ETA: 19:30 UTC</span>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Active Tasks</span>
            <span className="material-symbols-outlined text-[15px] text-secondary">
              pending_actions
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              7
            </span>
            <span className="font-label-sm text-label-sm text-secondary">3 running</span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Swarm Work</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-secondary font-semibold">
              3
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">of 6 Agents</span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Completed</span>
            <span className="material-symbols-outlined text-[15px] text-tertiary">
              check_circle
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-tertiary font-semibold">4</span>
            <span className="font-label-sm text-label-sm text-tertiary-fixed">+2 vs yday</span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Avg Velocity</span>
            <span className="material-symbols-outlined text-[15px] text-primary">bolt</span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              18m
            </span>
            <span className="font-label-sm text-label-sm text-outline">/ task cycle</span>
          </div>
        </div>
      </div>
    </div>
  );
}
