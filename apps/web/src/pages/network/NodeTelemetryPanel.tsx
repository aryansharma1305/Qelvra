// Ported from the Stitch export (agent_hive_agent_network/code.html). Keep visually identical to the design.

export function NodeTelemetryPanel() {
  return (
    <aside className="w-full lg:w-80 bg-surface-container-lowest p-margin flex flex-col gap-space-md z-30 shadow-lg shrink-0">
      <div className="flex items-center justify-between pb-space-xs">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px]">cell_tower</span>
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline font-semibold">
            Node Telemetry
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            disabled
            aria-label="dock to right — coming later"
            className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container transition-colors"
            title="Minimize Panel"
            type="button"
          >
            {" "}
            <span className="material-symbols-outlined text-[16px]">dock_to_right</span>{" "}
          </button>
        </div>
      </div>
      <div className="bg-surface-container p-space-md rounded-xl flex flex-col gap-space-sm">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-secondary shadow-inner">
              <span className="material-symbols-outlined text-[24px]">web</span>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                  Nova
                </span>
                <span className="font-label-sm text-label-sm px-1.5 py-0.2 rounded bg-secondary-container/20 text-secondary">
                  OP-01
                </span>
              </div>
              <span className="font-code-sm text-code-sm text-outline">Frontend Architecture</span>
            </div>
          </div>
          <span className="font-label-sm text-label-sm text-tertiary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
            ACTIVE
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col">
            <span className="font-label-sm text-label-sm text-outline">Context Window</span>
            <span className="font-code-sm text-code-sm font-semibold text-on-surface">
              Not measured
            </span>
          </div>
          <div className="bg-surface-container-low p-2 rounded-lg flex flex-col">
            <span className="font-label-sm text-label-sm text-outline">Throughput</span>
            <span className="font-code-sm text-code-sm font-semibold text-secondary">
              Not measured
            </span>
          </div>
        </div>
      </div>
      <div className="bg-surface-container p-space-md rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between font-label-sm text-label-sm">
          <span className="text-outline uppercase tracking-wider">Channel Throughput</span>
          <span className="text-secondary font-code-sm">Not measured</span>
        </div>
        <div className="flex flex-col gap-2 pt-1 font-code-sm text-code-sm">
          <div>
            <div className="flex justify-between text-on-surface-variant pb-1">
              <span>Inbound (Michael OP-00)</span>
              <span className="text-on-surface">Not measured</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary w-0" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-on-surface-variant pb-1">
              <span>Outbound (Scout OP-05)</span>
              <span className="text-on-surface">Not measured</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-0" />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-on-surface-variant pb-1">
              <span>Token Sync (Pixel OP-04)</span>
              <span className="text-on-surface">Not measured</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-tertiary w-0" />
            </div>
          </div>
        </div>
      </div>
      <div className="bg-surface-container p-space-md rounded-xl flex flex-col gap-2">
        <div className="flex items-center justify-between font-label-sm text-label-sm">
          <span className="text-outline uppercase tracking-wider">Shared DAG Keys</span>
          <span className="font-code-sm text-outline">Coming later</span>
        </div>
        <div className="flex flex-col gap-1.5 font-code-sm text-code-sm">
          <div className="flex items-center justify-between p-1.5 rounded bg-surface-container-low text-on-surface-variant">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-primary">lock</span>
              <span className="text-on-surface">nav.sidebar.state</span>
            </div>
            <span className="text-outline text-label-sm font-label-sm">RW</span>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-surface-container-low text-on-surface-variant">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[13px] text-secondary">sync</span>
              <span className="text-on-surface">theme.palette.tokens</span>
            </div>
            <span className="text-outline text-label-sm font-label-sm">RO</span>
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span>INJECT STEERING PROMPT</span>
          <span className="font-code-sm text-secondary">IPC DIRECT</span>
        </div>
        <div className="relative">
          <input
            className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface-container-high text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none focus:bg-surface-bright transition-all"
            placeholder="Direct directive to @Nova..."
            type="text"
          />{" "}
          <button
            disabled
            aria-label="arrow upward — coming later"
            className="absolute right-1.5 top-1.5 p-1 rounded bg-primary-container text-on-primary-container hover:bg-primary transition-colors flex items-center justify-center"
            title="Send Directive"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
