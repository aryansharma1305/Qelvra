// Ported from the Stitch export (agent_hive_onboarding_build_your_ai_team/code.html). Keep visually identical to the design.

export function TeamPreview() {
  return (
    <div className="lg:col-span-6 relative w-full h-[460px] md:h-[540px] flex items-center justify-center">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-80 h-80 rounded-full bg-primary/10 blur-[80px]" />
        <div className="w-48 h-48 rounded-full bg-secondary-container/10 blur-[60px]" />
      </div>
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        fill="none"
        viewBox="0 0 600 600"
      >
        {" "}
        <defs>
          {" "}
          <radialGradient cx="50%" cy="50%" id="centerGlow" r="50%">
            {" "}
            <stop offset="0%" stopColor="#d0bcff" stopOpacity="0.35" />{" "}
            <stop offset="100%" stopColor="#131315" stopOpacity="0" />{" "}
          </radialGradient>{" "}
          <linearGradient id="gradNova" x1="0%" x2="100%" y1="0%" y2="100%">
            {" "}
            <stop offset="0%" stopColor="#a078ff" stopOpacity="0.8" />{" "}
            <stop offset="100%" stopColor="#d0bcff" stopOpacity="0.1" />{" "}
          </linearGradient>{" "}
          <linearGradient id="gradAtlas" x1="100%" x2="0%" y1="0%" y2="100%">
            {" "}
            <stop offset="0%" stopColor="#4cd7f6" stopOpacity="0.8" />{" "}
            <stop offset="100%" stopColor="#03b5d3" stopOpacity="0.1" />{" "}
          </linearGradient>{" "}
          <linearGradient id="gradScout" x1="100%" x2="0%" y1="100%" y2="0%">
            {" "}
            <stop offset="0%" stopColor="#4edea3" stopOpacity="0.8" />{" "}
            <stop offset="100%" stopColor="#00a572" stopOpacity="0.1" />{" "}
          </linearGradient>{" "}
          <linearGradient id="gradPixel" x1="0%" x2="100%" y1="100%" y2="0%">
            {" "}
            <stop offset="0%" stopColor="#ffb4ab" stopOpacity="0.8" />{" "}
            <stop offset="100%" stopColor="#d0bcff" stopOpacity="0.1" />{" "}
          </linearGradient>{" "}
        </defs>{" "}
        <circle
          cx="300"
          cy="300"
          r="190"
          stroke="#494454"
          strokeDasharray="4 6"
          strokeOpacity="0.25"
        />{" "}
        <circle cx="300" cy="300" r="130" stroke="#494454" strokeOpacity="0.2" />{" "}
        <circle
          cx="300"
          cy="300"
          r="230"
          stroke="#494454"
          strokeDasharray="2 8"
          strokeOpacity="0.15"
        />{" "}
        <path
          d="M300 300 L170 160"
          stroke="url(#gradNova)"
          strokeDasharray="3 3"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M300 300 L440 150"
          stroke="url(#gradAtlas)"
          strokeDasharray="3 3"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M300 300 L450 430"
          stroke="url(#gradScout)"
          strokeDasharray="3 3"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M300 300 L150 420"
          stroke="url(#gradPixel)"
          strokeDasharray="3 3"
          strokeWidth="1.5"
        />{" "}
        <circle className="animate-ping" cx="235" cy="230" fill="#d0bcff" r="2.5" />{" "}
        <circle
          className="animate-ping"
          cx="370"
          cy="225"
          fill="#4cd7f6"
          r="2.5"
          style={{ animationDelay: "Not measured" }}
        />{" "}
        <circle
          className="animate-ping"
          cx="375"
          cy="365"
          fill="#4edea3"
          r="2.5"
          style={{ animationDelay: "Not measured" }}
        />{" "}
        <circle
          className="animate-ping"
          cx="225"
          cy="360"
          fill="#ffb4ab"
          r="2.5"
          style={{ animationDelay: "Not measured" }}
        />{" "}
      </svg>
      <div className="relative z-20 flex flex-col items-center text-center p-space-md rounded-2xl bg-surface-container-high/90 backdrop-blur-md shadow-xl group cursor-default">
        <div className="relative w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center shadow-[0_0_24px_rgba(208,188,255,0.4)]">
          <span className="material-symbols-outlined text-primary text-[28px]">deployed_code</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-tertiary" />
        </div>
        <span className="font-headline-sm text-headline-sm text-on-surface mt-space-sm">
          Michael
        </span>
        <span className="font-code-sm text-code-sm text-primary">Orchestrator Core</span>
        <div className="flex items-center gap-space-xs mt-space-xs px-space-xs py-0.5 rounded bg-surface-container text-tertiary font-label-sm text-label-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
          <span>DISPATCHING • RUNNING</span>
        </div>
      </div>
      <div className="absolute top-12 left-6 md:left-10 z-20 flex items-center gap-space-sm p-space-sm pr-space-md rounded-xl bg-surface-container-low/90 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-[18px]">terminal</span>
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-space-xs">
            <span className="font-body-md text-body-md text-on-surface font-medium">Nova</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <span className="font-code-sm text-code-sm text-outline">Frontend Engine</span>
        </div>
      </div>
      <div className="absolute top-10 right-4 md:right-8 z-20 flex items-center gap-space-sm p-space-sm pr-space-md rounded-xl bg-surface-container-low/90 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
        <div className="w-8 h-8 rounded-lg bg-secondary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-secondary text-[18px]">dns</span>
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-space-xs">
            <span className="font-body-md text-body-md text-on-surface font-medium">Atlas</span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
          </div>
          <span className="font-code-sm text-code-sm text-outline">Systems Arch</span>
        </div>
      </div>
      <div className="absolute bottom-12 right-6 md:right-12 z-20 flex items-center gap-space-sm p-space-sm pr-space-md rounded-xl bg-surface-container-low/90 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
        <div className="w-8 h-8 rounded-lg bg-tertiary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-tertiary text-[18px]">bug_report</span>
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-space-xs">
            <span className="font-body-md text-body-md text-on-surface font-medium">Scout</span>
            <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
          </div>
          <span className="font-code-sm text-code-sm text-outline">Autonomous QA</span>
        </div>
      </div>
      <div className="absolute bottom-14 left-4 md:left-8 z-20 flex items-center gap-space-sm p-space-sm pr-space-md rounded-xl bg-surface-container-low/90 backdrop-blur-md shadow-lg transition-transform hover:-translate-y-1">
        <div className="w-8 h-8 rounded-lg bg-primary-fixed/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-fixed text-[18px]">palette</span>
        </div>
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-space-xs">
            <span className="font-body-md text-body-md text-on-surface font-medium">Pixel</span>
            <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed" />
          </div>
          <span className="font-code-sm text-code-sm text-outline">Design Tokens</span>
        </div>
      </div>
    </div>
  );
}
