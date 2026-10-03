// Ported from the Stitch export (agent_hive_agent_network/code.html). Keep visually identical to the design.

export function NetworkHeader() {
  return (
    <header className="w-full bg-surface-container-lowest px-margin-md py-space-sm flex flex-col xl:flex-row xl:items-center justify-between gap-space-md shadow-sm">
      <div className="flex flex-wrap items-center gap-space-md">
        <div className="flex items-center gap-space-xs font-code-sm text-code-sm">
          <span className="text-outline">Workspace</span>
          <span className="text-outline-variant font-code-sm">/</span>
          <span className="text-outline">Topology</span>
          <span className="text-outline-variant font-code-sm">/</span>
          <span className="text-primary font-semibold">Swarm Mesh Network</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-ping" />
          <span className="font-medium tracking-wide">IPC ACTIVE (48 MSGS/MIN)</span>
        </div>
        <div className="h-3.5 w-px bg-surface-container-highest hidden sm:block" />
        <div className="flex items-center p-0.5 rounded-lg bg-surface-container-low">
          <button
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm font-semibold transition-all"
            type="button"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            LIVE
          </button>
          <button
            className="px-2.5 py-1 rounded text-outline hover:text-on-surface font-label-sm text-label-sm transition-colors"
            type="button"
          >
            5 MIN
          </button>
          <button
            className="px-2.5 py-1 rounded text-outline hover:text-on-surface font-label-sm text-label-sm transition-colors"
            type="button"
          >
            1 HOUR
          </button>
        </div>
        <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container-low text-on-surface-variant font-code-sm text-code-sm cursor-pointer hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-[14px] text-secondary">alt_route</span>
          <span className="font-medium text-on-surface">#TSK-8924: Nav Redesign</span>
          <span className="material-symbols-outlined text-[14px] text-outline">expand_more</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-space-lg">
        <div className="flex items-center gap-space-lg text-left">
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Messages Today
            </span>
            <span className="font-code-md text-code-md font-semibold text-on-surface">1,428</span>
          </div>
          <div className="h-6 w-px bg-surface-container-highest" />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Active Channels
            </span>
            <span className="font-code-md text-code-md font-semibold text-secondary">
              5 / 5 <span className="font-label-sm text-label-sm text-outline">FULL</span>
            </span>
          </div>
          <div className="h-6 w-px bg-surface-container-highest" />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Throughput
            </span>
            <span className="font-code-md text-code-md font-semibold text-tertiary">14.2 KB/s</span>
          </div>
          <div className="h-6 w-px bg-surface-container-highest" />
          <div className="flex flex-col">
            <span className="font-label-sm text-label-sm text-outline uppercase tracking-wider">
              Mesh RTT
            </span>
            <span className="font-code-md text-code-md font-semibold text-primary">1.2 ms</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-lg">
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Zoom Out"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">remove</span>
          </button>
          <span className="font-code-sm text-code-sm px-1 text-outline">100%</span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Zoom In"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">add</span>
          </button>
          <div className="h-3.5 w-px bg-surface-container-highest mx-0.5" />
          <button
            className="w-6 h-6 flex items-center justify-center rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
            title="Reset Graph"
            type="button"
          >
            <span className="material-symbols-outlined text-[15px]">center_focus_strong</span>
          </button>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-high text-secondary font-label-sm text-label-sm"
            title="Toggle Physics Layout"
            type="button"
          >
            <span className="material-symbols-outlined text-[13px]">scatter_plot</span>
            <span>PHYSICS</span>
          </button>
        </div>
      </div>
    </header>
  );
}
