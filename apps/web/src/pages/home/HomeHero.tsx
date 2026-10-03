// Ported from the Stitch export (agent_hive_home_command_center/code.html). Keep visually identical to the design.

export function HomeHero() {
  return (
    <div className="flex flex-col gap-4 relative">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest">
              MISSION DIRECTORY
            </span>
            <span className="inline-block w-1 h-1 rounded-full bg-outline-variant" />
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              NODE: US-WEST-LOCAL-01
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
            Good evening,{" "}
            <span className="bg-gradient-to-r from-on-surface via-primary to-secondary bg-clip-text text-transparent">
              Aryan
            </span>
            .
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Your autonomous agent collective is actively executing across{" "}
            <span className="text-on-surface font-medium">4 production DAGs</span>.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-center bg-surface-container-low px-4 py-2 rounded-xl border border-outline-variant/20 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
            <span className="font-code-sm text-code-sm text-on-surface font-medium">
              Swarm Synced
            </span>
          </div>
          <span className="text-outline-variant/60 font-code-sm text-code-sm">/</span>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[15px] text-tertiary">group_work</span>
            <span>5 Active Operatives</span>
          </div>
          <span className="text-outline-variant/60 font-code-sm text-code-sm">/</span>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[15px] text-secondary">speed</span>
            <span>12ms Latency</span>
          </div>
        </div>
      </div>
      <div className="relative w-full rounded-2xl bg-surface-container-low/90 backdrop-blur-xl border border-primary/20 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.6)] p-3 sm:p-4 transition-all duration-300 focus-within:border-primary/60 focus-within:shadow-[0_0_24px_rgba(208,188,255,0.15)]">
        <div className="flex items-start gap-3 w-full">
          <div className="mt-1 flex items-center justify-center w-8 h-8 rounded-lg bg-surface-container-high text-primary shadow-inner">
            <span className="material-symbols-outlined text-[18px]">neurology</span>
          </div>
          <textarea
            className="w-full bg-transparent resize-none outline-none font-body-lg text-body-lg text-on-surface placeholder:text-outline font-normal py-1"
            placeholder={
              "What should your team work on? (e.g. Audit biometric passkey fallback & synthesize performance benchmarks)"
            }
            rows={2}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-outline-variant/20">
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface text-body-sm font-body-sm transition-all duration-150"
              type="button"
            >
              <span className="material-symbols-outlined text-[16px] text-outline">
                attach_file
              </span>
              <span>Attach context / files</span>
            </button>
            <div className="relative group cursor-pointer">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all duration-150">
                <span className="material-symbols-outlined text-[15px] text-secondary">bolt</span>
                <span>
                  Project:{" "}
                  <strong className="text-on-surface font-medium">Hyperion Core v2.4</strong>
                </span>
                <span className="material-symbols-outlined text-[14px] text-outline">
                  arrow_drop_down
                </span>
              </div>
            </div>
            <div className="relative group cursor-pointer">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-body-sm font-body-sm text-on-surface-variant hover:text-on-surface transition-all duration-150">
                <span className="material-symbols-outlined text-[15px] text-primary">
                  psychology
                </span>
                <span>
                  Orchestrator:{" "}
                  <strong className="text-on-surface font-medium">Michael (o3-mini)</strong>
                </span>
                <span className="material-symbols-outlined text-[14px] text-outline">
                  arrow_drop_down
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 ml-auto">
            <button
              aria-label="Voice input"
              className="p-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-outline hover:text-primary transition-colors"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">graphic_eq</span>{" "}
            </button>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold tracking-tight shadow-[0_0_16px_rgba(208,188,255,0.35)] transition-all duration-200"
              type="button"
            >
              <span>Dispatch</span>
              <kbd className="font-label-sm text-label-sm bg-on-primary/20 px-1.5 py-0.5 rounded text-on-primary">
                ⌘↵
              </kbd>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
