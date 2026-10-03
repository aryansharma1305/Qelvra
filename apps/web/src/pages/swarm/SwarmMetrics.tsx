// Ported from the Stitch export (agent_hive_swarm_command_center/code.html). Keep visually identical to the design.

export function SwarmMetrics() {
  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-space-md">
      <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
        <div className="flex items-center justify-between text-outline">
          <span className="font-label-sm text-label-sm uppercase tracking-wider">
            Swarm Execution
          </span>
          <span className="flex h-2 w-2 rounded-full bg-tertiary" />
        </div>
        <div className="my-2 flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            5 <span className="font-body-md text-body-md text-outline font-normal">/ 6 active</span>
          </span>
          <span className="font-code-sm text-code-sm text-tertiary">83% load</span>
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <svg className="w-full h-4 text-tertiary" fill="none" viewBox="0 0 100 16">
            {" "}
            <path
              d="M0 12 L15 10 L30 14 L45 6 L60 8 L75 3 L90 5 L100 2"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.75"
            />{" "}
          </svg>
        </div>
      </div>
      <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
        <div className="flex items-center justify-between text-outline">
          <span className="font-label-sm text-label-sm uppercase tracking-wider">
            Sprint Velocity
          </span>
          <span className="font-code-sm text-code-sm text-primary">v2.4.0</span>
        </div>
        <div className="my-2 flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            68%
          </span>
          <span className="font-code-sm text-code-sm text-outline">14 / 20 tasks</span>
        </div>
        <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden flex">
          <div className="h-full bg-primary" style={{ width: "50%" }} />
          <div className="h-full bg-secondary" style={{ width: "18%" }} />
        </div>
      </div>
      <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
        <div className="flex items-center justify-between text-outline">
          <span className="font-label-sm text-label-sm uppercase tracking-wider">Burn Rate</span>
          <span className="material-symbols-outlined text-[16px] text-secondary">token</span>
        </div>
        <div className="my-2 flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            1.42M{" "}
            <span className="font-label-sm text-label-sm font-normal text-outline">tok/hr</span>
          </span>
          <span className="font-code-sm text-code-sm text-secondary font-medium">~$3.12/hr</span>
        </div>
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span>Cache hit: 94.2%</span>
          <span className="text-tertiary">Optimal</span>
        </div>
      </div>
      <div className="p-3.5 rounded-lg bg-surface-container-lowest border border-outline-variant/30 flex flex-col justify-between hover:border-primary/40 transition-all">
        <div className="flex items-center justify-between text-outline">
          <span className="font-label-sm text-label-sm uppercase tracking-wider">PR Output</span>
          <span className="material-symbols-outlined text-[16px] text-tertiary">merge</span>
        </div>
        <div className="my-2 flex items-baseline justify-between">
          <span className="font-headline-lg text-headline-lg font-bold text-on-surface tracking-tight">
            4.8{" "}
            <span className="font-body-md text-body-md text-outline font-normal">PRs / day</span>
          </span>
          <span className="font-code-sm text-code-sm text-tertiary font-medium">+24% vs avg</span>
        </div>
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span>Fails: 0</span>
          <span>Diff: +1.8k / -640</span>
        </div>
      </div>
    </section>
  );
}
