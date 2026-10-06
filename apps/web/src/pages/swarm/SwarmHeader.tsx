// Ported from the Stitch export (agent_hive_swarm_command_center/code.html). Keep visually identical to the design.

export function SwarmHeader() {
  return (
    <header className="flex flex-col gap-space-md">
      <div className="flex items-center gap-space-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-80" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
        </span>
        <span className="font-label-sm text-label-sm uppercase tracking-widest text-on-surface-variant flex items-center gap-1.5">
          <span className="text-secondary font-medium">NEURAL SWARM SYNCHRONIZED</span>
          <span className="text-outline">/</span>
          <span>Coming later</span>
          <span className="text-outline">/</span>
          <span className="text-tertiary">Not measured</span>
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold flex items-center gap-3">
          Your autonomous AI swarm is active
          <span className="font-code-sm text-code-sm bg-surface-container-high text-primary px-2 py-0.5 rounded-full border border-primary/20 font-normal">
            {" "}
            EPOCH #4,812{" "}
          </span>
        </h1>
        <p className="font-body-md text-body-md text-outline max-w-3xl">
          Coordinating distributed feature synthesis, microservice self-healing, and end-to-end
          edge-case fuzzing across isolated VRAM sandboxes.
        </p>
      </div>
      <div className="mt-space-xs relative group">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary-container/20 via-secondary-container/20 to-primary-container/20 rounded-xl blur opacity-40 group-hover:opacity-75 transition duration-300" />
        <div className="relative bg-surface-container-lowest/90 backdrop-blur-xl rounded-xl p-2 pl-4 flex items-center justify-between shadow-2xl border border-outline-variant/30">
          <div className="flex items-center gap-3 flex-1 min-w-0 mr-3">
            <span className="material-symbols-outlined text-[20px] text-primary">terminal</span>
            <input
              className="w-full bg-transparent text-on-surface placeholder:text-outline font-body-md text-body-md focus:outline-none"
              id="omnibarInput"
              placeholder="What should your swarm build? (e.g. '@Nova implement responsive nav drawer or @Atlas fix rate limiter')"
              type="text"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-surface-container-low rounded border border-outline-variant/20 text-on-surface-variant font-code-sm text-code-sm">
              <span className="material-symbols-outlined text-[14px] text-outline">tune</span>
              <span>Claude 3.5 • O3-Mini</span>
            </div>
            <button
              disabled
              aria-label="attachment — coming later"
              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
              title="Attach Context File"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">attachment</span>{" "}
            </button>
            <button
              disabled
              aria-label="mic — coming later"
              className="p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded transition-colors"
              title="Voice Input"
              type="button"
            >
              {" "}
              <span className="material-symbols-outlined text-[18px]">mic</span>{" "}
            </button>
            <button
              disabled
              title="Coming later — this control is not available in the beta"
              aria-label="Coming later — coming later"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-on-primary font-headline-sm text-headline-sm font-semibold tracking-tight transition-all shadow-[0_0_16px_rgba(208,188,255,0.25)] active:scale-95"
              type="button"
            >
              <span>Dispatch</span>
              <kbd className="font-label-sm text-label-sm bg-on-primary/20 text-on-primary px-1 rounded">
                ↵
              </kbd>
            </button>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2.5 py-1 rounded bg-surface-container-high text-primary font-code-sm text-code-sm font-medium border border-primary/30"
          >
            All Agents (6)
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-code-sm text-code-sm transition-colors"
          >
            {"Frontend & UI (2)"}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-code-sm text-code-sm transition-colors"
          >
            {"Backend & Infra (1)"}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-code-sm text-code-sm transition-colors"
          >
            {"QA & Sec (1)"}
          </button>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="Coming later — coming later"
            className="px-2.5 py-1 rounded bg-surface-container-lowest text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low font-code-sm text-code-sm transition-colors"
          >
            Orchestration (2)
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-label-sm text-label-sm text-outline">SORT:</span>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="unfold more — coming later"
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-surface-container-low text-on-surface font-code-sm text-code-sm hover:bg-surface-container-high"
          >
            <span>Recent Activity</span>
            <span className="material-symbols-outlined text-[14px]">unfold_more</span>
          </button>
        </div>
      </div>
    </header>
  );
}
