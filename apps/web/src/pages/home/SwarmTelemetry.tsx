// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.

export function SwarmTelemetry() {
  return (
    <div className="lg:col-span-5 flex flex-col gap-4">
      <div className="rounded-2xl bg-surface-container-low p-6 border border-outline-variant/20 shadow-sm flex flex-col gap-5">
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">query_stats</span>
            <h3 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight">
              Swarm Telemetry
            </h3>
          </div>
          <span className="font-code-sm text-code-sm text-tertiary">Real-time</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Active Capacity
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                5 / 6
              </span>
              <span className="font-code-sm text-code-sm text-tertiary">92% load</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Operatives assigned
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Completed Today
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                28
              </span>
              <span className="font-code-sm text-code-sm text-primary">+14%</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Autonomous DAG runs
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Active Concurrency
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                4
              </span>
              <span className="font-code-sm text-code-sm text-secondary">Sub-DAGs</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              Parallel execution
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-surface-container border border-outline-variant/15 flex flex-col gap-1">
            <span className="font-label-sm text-label-sm text-outline uppercase">
              Avg Dispatch Rate
            </span>
            <div className="flex items-baseline justify-between">
              <span className="font-headline-md text-headline-md text-on-surface font-semibold">
                4m 18s
              </span>
              <span className="font-code-sm text-code-sm text-tertiary">P95</span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              End-to-end task time
            </span>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-surface-container-high/60 border border-outline-variant/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">memory</span>
              <span className="font-body-sm text-body-sm text-on-surface font-medium">
                Local GPU Engine
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              RTX 4090 (24GB)
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between font-code-sm text-code-sm">
              <span className="text-on-surface-variant">VRAM Allocation</span>
              <span className="text-secondary font-medium">14.2 GB / 24.0 GB (59%)</span>
            </div>
            <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden flex">
              <div className="bg-secondary h-full w-[45%]" title="Model Weights" />
              <div className="bg-primary h-full w-[14%]" title="KV Cache" />
            </div>
            <div className="flex items-center justify-between text-outline font-label-sm text-label-sm pt-0.5">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                Weights: 10.8 GB
              </span>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                KV Cache: 3.4 GB
              </span>
              <span>Free: 9.8 GB</span>
            </div>
          </div>
          <div className="mt-1 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-code-sm text-code-sm text-outline">
            <div className="flex items-center gap-1.5 text-on-surface-variant">
              <span className="material-symbols-outlined text-[14px] text-tertiary">
                thermostat
              </span>
              <span>Thermal: 54°C</span>
            </div>
            <div className="flex items-center gap-1.5 text-tertiary">
              <span className="material-symbols-outlined text-[14px]">savings</span>
              <span>Inference Cost: $0.00 (Local)</span>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-2xl bg-gradient-to-br from-surface-container-low to-surface-container-high/40 p-5 border border-primary/20 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <span className="material-symbols-outlined text-[20px]">auto_awesome</span>
          </div>
          <div>
            <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
              Autonomous Sprint Planner
            </h4>
            <p className="font-code-sm text-code-sm text-outline mt-0.5">
              Allow Michael to autonomously synthesize pending backlog issues
            </p>
          </div>
        </div>
        <button
          className="shrink-0 px-3.5 py-1.5 rounded-lg bg-surface-container hover:bg-surface-bright text-on-surface font-body-sm text-body-sm font-medium border border-outline-variant/30 hover:border-primary/40 transition-colors"
          type="button"
        >
          {" "}
          Run Sprint{" "}
        </button>
      </div>
    </div>
  );
}
