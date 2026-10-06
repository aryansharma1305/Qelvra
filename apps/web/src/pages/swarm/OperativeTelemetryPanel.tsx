// Ported from the Stitch export (agent_hive_swarm_command_center/code.html). Keep visually identical to the design.

export function OperativeTelemetryPanel() {
  return (
    <aside className="hidden xl:flex w-96 flex-col border-l border-outline-variant/30 bg-surface-container-lowest/95 backdrop-blur-xl p-margin-md gap-space-md sticky top-12 h-[calc(100vh-3rem)] overflow-y-auto">
      <div className="flex flex-col gap-3 pb-4 border-b border-outline-variant/20">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Operative Telemetry
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled
              aria-label="pause — coming later"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Pause Agent"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">pause</span>{" "}
            </button>
            <button
              disabled
              aria-label="terminal — coming later"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Terminal"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">terminal</span>{" "}
            </button>
            <button
              disabled
              aria-label="settings — coming later"
              className="p-1 rounded text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
              title="Settings"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">settings</span>{" "}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_12px_rgba(208,188,255,0.15)]">
            <span className="material-symbols-outlined text-[26px]">brush</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                Nova
              </h3>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded-full bg-secondary-container/30 text-secondary border border-secondary/30">
                WORKING
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-outline">Not measured</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
          System Diagnostics
        </span>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1">
            <div className="flex justify-between font-code-sm text-code-sm">
              <span className="text-outline">CPU Load</span>
              <span className="text-secondary font-medium">Not measured</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-0" />
            </div>
          </div>
          <div className="p-2.5 rounded bg-surface-container-low border border-outline-variant/30 flex flex-col gap-1">
            <div className="flex justify-between font-code-sm text-code-sm">
              <span className="text-outline">VRAM Alloc</span>
              <span className="text-primary font-medium">Not measured</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary w-0" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between p-2 rounded bg-surface-container-low border border-outline-variant/30 font-code-sm text-code-sm">
          <span className="text-outline">Session Tokens</span>
          <span className="text-on-surface font-medium">
            Not measured <span className="text-outline">Not measured</span>
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Current Mission
          </span>
          <span className="font-code-sm text-code-sm text-primary">nova/agent-grid-v2</span>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-primary/30 flex flex-col gap-2.5">
          <p className="font-body-sm text-body-sm text-on-surface font-medium leading-relaxed">
            Refactor agent telemetry cards with Tailwind CSS and hardware-accelerated CSS
            animations.
          </p>
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input defaultChecked className="accent-primary rounded" type="checkbox" />
              <span className="font-code-sm text-code-sm text-on-surface line-through text-outline">
                Generate component hierarchy
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input defaultChecked className="accent-primary rounded" type="checkbox" />
              <span className="font-code-sm text-code-sm text-on-surface line-through text-outline">
                Sync color tokens with Pixel
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input defaultChecked className="accent-primary rounded" type="checkbox" />
              <span className="font-code-sm text-code-sm text-on-surface line-through text-outline">
                Write Playwright viewport checks
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input className="accent-primary rounded" type="checkbox" />
              <span className="font-code-sm text-code-sm text-secondary font-medium">
                Benchmark paint latency on Safari
              </span>
            </label>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <div className="flex items-center justify-between">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
            Inter-Agent Comms
          </span>
          <span className="font-label-sm text-label-sm text-tertiary flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            PREVIEW
          </span>
        </div>
        <div className="flex-1 p-2.5 rounded-lg bg-surface-container-low border border-outline-variant/30 overflow-y-auto flex flex-col gap-2.5">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm font-semibold text-primary">@Michael</span>
              <span className="font-label-sm text-label-sm text-outline">Not measured</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant bg-surface-container-highest/60 p-2 rounded">
              @Nova, make sure the glowing status ring uses composited CSS transforms rather than
              layout repaints.
            </p>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center justify-between">
              <span className="font-code-sm text-code-sm font-semibold text-secondary">@Nova</span>
              <span className="font-label-sm text-label-sm text-outline">Not measured</span>
            </div>
            <p className="font-body-sm text-body-sm text-on-surface bg-surface-container-high p-2 rounded border border-outline-variant/30">
              Not measured
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/20">
        <div className="relative flex items-center">
          <input
            className="w-full pl-3 pr-9 py-2 rounded-lg bg-surface-container-low border border-outline-variant/40 focus:border-primary text-on-surface placeholder:text-outline font-body-sm text-body-sm focus:outline-none"
            placeholder="Instruct Nova directly..."
            type="text"
          />
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="send — coming later"
            className="absolute right-2 p-1 text-primary hover:text-on-surface transition-colors"
          >
            {" "}
            <span className="material-symbols-outlined text-[16px]">send</span>{" "}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="py-1.5 px-2 rounded bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-on-surface font-code-sm text-code-sm text-center transition-colors"
          >
            {" "}
            Git Diff (+184/-32){" "}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="py-1.5 px-2 rounded bg-surface-container-low hover:bg-surface-container-high border border-outline-variant/30 text-on-surface-variant hover:text-on-surface font-code-sm text-code-sm text-center transition-colors"
          >
            {" "}
            Terminal stdout{" "}
          </button>
        </div>
      </div>
    </aside>
  );
}
