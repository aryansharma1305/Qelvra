// Ported from the Stitch export (agent_hive_onboarding_build_your_ai_team/code.html). Keep visually identical to the design.

export function OnboardingFooter() {
  return (
    <footer className="w-full bg-surface-container-lowest/80 backdrop-blur-md py-space-sm z-40">
      <div className="w-full px-gutter-lg flex flex-col sm:flex-row items-center justify-between gap-space-sm text-on-surface-variant font-code-sm text-code-sm">
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-xs">
            <kbd className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/30 text-[10px]">
              Esc
            </kbd>
            <span>Skip setup</span>
          </span>
          <span className="text-outline-variant">•</span>
          <span className="flex items-center gap-space-xs">
            <kbd className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/30 text-[10px]">
              ← / →
            </kbd>
            <span>Cycle stages</span>
          </span>
        </div>
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-xs">
            <kbd className="px-space-xs py-0.5 rounded bg-surface-container-high text-on-surface border border-outline-variant/30 text-[10px]">
              {"&x2318 ↵"}
            </kbd>
            <span>{"Commit & advance"}</span>
          </span>
          <span className="text-outline-variant">•</span>
          <span className="text-tertiary flex items-center gap-space-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
            <span>Telemetry Active</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
