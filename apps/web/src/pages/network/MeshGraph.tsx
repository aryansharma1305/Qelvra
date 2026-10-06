// Ported from the Stitch export (agent_hive_agent_network/code.html). Keep visually identical to the design.

export function MeshGraph() {
  return (
    <div
      className="relative flex-1 bg-surface-container-lowest overflow-hidden select-none"
      id="graph-viewport"
    >
      {" "}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: "radial-gradient(rgba(208, 188, 255, 0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />{" "}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl pointer-events-none" />{" "}
      <div className="absolute -bottom-32 left-1/3 w-[32rem] h-[32rem] rounded-full bg-secondary/10 blur-3xl pointer-events-none" />{" "}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container/90 backdrop-blur-md shadow-md">
        <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
        <span className="font-code-sm text-code-sm text-on-surface">Protocols:</span>
        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-secondary font-semibold">
          IPC v2.4
        </span>
        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-primary">
          WebSockets
        </span>
        <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-highest text-tertiary">
          Shared RAM
        </span>
      </div>{" "}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
        viewBox="0 0 1000 680"
      >
        {" "}
        <defs>
          {" "}
          <linearGradient id="link-violet-cyan" x1="0%" x2="100%" y1="0%" y2="100%">
            {" "}
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.8" />{" "}
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />{" "}
          </linearGradient>{" "}
          <linearGradient id="link-subtle" x1="0%" x2="100%" y1="0%" y2="100%">
            {" "}
            <stop offset="0%" stopColor="#494454" stopOpacity="0.3" />{" "}
            <stop offset="100%" stopColor="#958ea0" stopOpacity="0.2" />{" "}
          </linearGradient>{" "}
          <linearGradient id="link-active" x1="0%" x2="100%" y1="0%" y2="100%">
            {" "}
            <stop offset="0%" stopColor="#a078ff" stopOpacity="0.6" />{" "}
            <stop offset="100%" stopColor="#4edea3" stopOpacity="0.6" />{" "}
          </linearGradient>{" "}
          <filter height="140%" id="glow-cyan" width="140%" x="-20%" y="-20%">
            {" "}
            <feGaussianBlur result="blur" stdDeviation="3" />{" "}
            <feComposite in="SourceGraphic" in2="blur" operator="over" />{" "}
          </filter>{" "}
        </defs>{" "}
        <path
          d="M 460 290 C 350 250, 300 210, 240 180"
          fill="none"
          id="path-michael-nova"
          stroke="url(#link-violet-cyan)"
          strokeWidth="2.5"
        />{" "}
        <path
          d="M 460 290 C 350 250, 300 210, 240 180"
          fill="none"
          opacity="0.6"
          stroke="#06b6d4"
          strokeDasharray="6,8"
          strokeWidth="1.5"
        >
          {" "}
          <animate
            attributeName="stroke-dashoffset"
            dur="2s"
            from="100"
            repeatCount="indefinite"
            to="0"
          />{" "}
        </path>{" "}
        <path
          d="M 540 280 C 630 220, 680 180, 750 170"
          fill="none"
          id="path-michael-atlas"
          opacity="0.5"
          stroke="#a078ff"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M 540 280 C 630 220, 680 180, 750 170"
          fill="none"
          opacity="0.8"
          stroke="#8b5cf6"
          strokeDasharray="4,10"
          strokeWidth="1.5"
        >
          {" "}
          <animate
            attributeName="stroke-dashoffset"
            dur="3s"
            from="100"
            repeatCount="indefinite"
            to="0"
          />{" "}
        </path>{" "}
        <path
          d="M 460 340 C 330 380, 270 410, 210 470"
          fill="none"
          opacity="0.45"
          stroke="url(#link-active)"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M 500 370 C 500 420, 500 460, 500 520"
          fill="none"
          opacity="0.4"
          stroke="#d0bcff"
          strokeDasharray="3,6"
          strokeWidth="1.5"
        >
          {" "}
          <animate
            attributeName="stroke-dashoffset"
            dur="2.5s"
            from="50"
            repeatCount="indefinite"
            to="0"
          />{" "}
        </path>{" "}
        <path
          d="M 540 330 C 640 370, 700 400, 770 450"
          fill="none"
          stroke="url(#link-subtle)"
          strokeWidth="1.5"
        />{" "}
        <path
          d="M 180 230 C 140 320, 140 380, 170 440"
          fill="none"
          opacity="0.3"
          stroke="#06b6d4"
          strokeDasharray="2,4"
          strokeWidth="1"
        />{" "}
        <path
          d="M 230 220 C 320 330, 380 430, 460 530"
          fill="none"
          opacity="0.35"
          stroke="#a078ff"
          strokeDasharray="3,5"
          strokeWidth="1"
        />{" "}
        <path
          d="M 750 200 C 600 300, 350 400, 230 460"
          fill="none"
          opacity="0.2"
          stroke="#958ea0"
          strokeDasharray="2,6"
          strokeWidth="0.75"
        />{" "}
        <circle fill="#acedff" filter="url(#glow-cyan)" r="3.5">
          {" "}
          <animateMotion
            dur="2.2s"
            path="M 460 290 C 350 250, 300 210, 240 180"
            repeatCount="indefinite"
          />{" "}
        </circle>{" "}
        <circle fill="#4edea3" r="2.5">
          {" "}
          <animateMotion
            begin="0.8s"
            dur="1.8s"
            path="M 240 180 C 300 210, 350 250, 460 290"
            repeatCount="indefinite"
          />{" "}
        </circle>{" "}
        <circle fill="#d0bcff" r="3">
          {" "}
          <animateMotion
            dur="3.4s"
            path="M 540 280 C 630 220, 680 180, 750 170"
            repeatCount="indefinite"
          />{" "}
        </circle>{" "}
        <circle fill="#03b5d3" r="2.5">
          {" "}
          <animateMotion
            dur="4.2s"
            path="M 500 370 C 500 420, 500 460, 500 520"
            repeatCount="indefinite"
          />{" "}
        </circle>{" "}
      </svg>{" "}
      <MeshNodes />
    </div>
  );
}

export function MeshNodes() {
  return (
    <div className="relative w-full h-full p-6">
      {" "}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 cursor-pointer group"
        style={{ width: "280px" }}
      >
        {" "}
        <div className="absolute -inset-2 bg-primary/20 rounded-2xl blur-xl group-hover:bg-primary/30 transition-all" />
        <div className="relative bg-surface-container/95 backdrop-blur-xl p-space-md rounded-xl shadow-xl transition-all duration-200">
          <div className="flex items-center justify-between pb-space-xs">
            <div className="flex items-center gap-space-sm">
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center text-primary shadow-sm font-semibold">
                  <span className="material-symbols-outlined text-[20px]">hub</span>
                </div>
                <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-tertiary" />
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-semibold tracking-tight">
                  Michael
                </span>
                <span className="font-code-sm text-code-sm text-primary">OP-00 · Orchestrator</span>
              </div>
            </div>
            <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-primary-container/20 text-primary font-medium">
              LEAD
            </span>
          </div>
          <div className="bg-surface-container-low p-2 rounded-lg my-2 flex flex-col gap-1">
            <div className="flex items-center justify-between font-label-sm text-label-sm">
              <span className="text-outline">DAG PHASE</span>
              <span className="text-secondary font-medium font-code-sm">Not measured</span>
            </div>
            <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-secondary w-0" />
            </div>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-1">
            <span className="flex items-center gap-1 font-code-sm text-on-surface-variant">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              o3-mini
            </span>
            <span className="text-tertiary font-code-sm">Coming later</span>
          </div>
        </div>
      </div>{" "}
      <div
        className="absolute left-[10%] top-[12%] z-20 cursor-pointer group"
        style={{ width: "240px" }}
      >
        {" "}
        <div className="absolute -inset-1 bg-secondary/15 rounded-xl blur-lg" />
        <div className="relative bg-surface-container/90 backdrop-blur-md p-space-sm rounded-xl shadow-md transition-all">
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-[16px]">web</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-medium leading-none">
                  Nova
                </span>
                <span className="font-code-sm text-code-sm text-secondary">OP-01 · Frontend</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          </div>
          <div className="bg-surface-container-low px-2 py-1 rounded my-1 text-on-surface-variant font-code-sm text-code-sm flex items-center justify-between">
            <span className="text-outline truncate max-w-[130px]">AST Mutation</span>
            <span className="text-secondary font-medium">Not measured</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
            <span>Gemini 2.5 Pro</span>
            <span className="text-tertiary">Not measured</span>
          </div>
        </div>
      </div>{" "}
      <div
        className="absolute right-[12%] top-[14%] z-20 cursor-pointer group"
        style={{ width: "240px" }}
      >
        <div className="relative bg-surface-container/90 backdrop-blur-md p-space-sm rounded-xl shadow-md hover:bg-surface-container-high transition-all">
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[16px]">dns</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-medium leading-none">
                  Atlas
                </span>
                <span className="font-code-sm text-code-sm text-primary">OP-03 · Backend</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-tertiary" />
          </div>
          <div className="bg-surface-container-low px-2 py-1 rounded my-1 text-on-surface-variant font-code-sm text-code-sm flex items-center justify-between">
            <span className="text-outline truncate max-w-[130px]">Redis Session Store</span>
            <span className="text-on-surface font-medium">READY</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
            <span>GPT-4o</span>
            <span className="text-on-surface-variant">Not measured</span>
          </div>
        </div>
      </div>{" "}
      <div
        className="absolute left-[8%] bottom-[24%] z-20 cursor-pointer group"
        style={{ width: "240px" }}
      >
        <div className="relative bg-surface-container/90 backdrop-blur-md p-space-sm rounded-xl shadow-md hover:bg-surface-container-high transition-all">
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[16px]">verified</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-medium leading-none">
                  Scout
                </span>
                <span className="font-code-sm text-code-sm text-tertiary">OP-05 · QA Runner</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
          </div>
          <div className="bg-surface-container-low px-2 py-1 rounded my-1 text-on-surface-variant font-code-sm text-code-sm flex items-center justify-between">
            <span className="text-outline truncate max-w-[130px]">Playwright E2E</span>
            <span className="text-tertiary font-medium">Not measured</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
            <span>Claude 3.5 Sonnet</span>
            <span className="text-on-surface-variant">Not measured</span>
          </div>
        </div>
      </div>{" "}
      <div
        className="absolute left-[42%] bottom-[12%] z-20 cursor-pointer group"
        style={{ width: "240px" }}
      >
        <div className="relative bg-surface-container/90 backdrop-blur-md p-space-sm rounded-xl shadow-md hover:bg-surface-container-high transition-all">
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-primary-container">
                <span className="material-symbols-outlined text-[16px]">palette</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-medium leading-none">
                  Pixel
                </span>
                <span className="font-code-sm text-code-sm text-primary-container">
                  OP-04 · Designer
                </span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-secondary" />
          </div>
          <div className="bg-surface-container-low px-2 py-1 rounded my-1 text-on-surface-variant font-code-sm text-code-sm flex items-center justify-between">
            <span className="text-outline truncate max-w-[130px]">CSS Tokens Audit</span>
            <span className="text-secondary font-medium">REVIEWING</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
            <span>Gemini 1.5 Pro</span>
            <span className="text-on-surface-variant">Not measured</span>
          </div>
        </div>
      </div>{" "}
      <div
        className="absolute right-[10%] bottom-[22%] z-20 cursor-pointer group"
        style={{ width: "240px" }}
      >
        <div className="relative bg-surface-container/90 backdrop-blur-md p-space-sm rounded-xl shadow-md hover:bg-surface-container-high transition-all">
          <div className="flex items-center justify-between pb-1.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-surface-container-high flex items-center justify-center text-outline">
                <span className="material-symbols-outlined text-[16px]">auto_stories</span>
              </div>
              <div className="flex flex-col">
                <span className="font-headline-sm text-headline-sm text-on-surface font-medium leading-none">
                  Echo
                </span>
                <span className="font-code-sm text-code-sm text-outline">OP-06 · Research</span>
              </div>
            </div>
            <span className="w-2 h-2 rounded-full bg-outline-variant" />
          </div>
          <div className="bg-surface-container-low px-2 py-1 rounded my-1 text-on-surface-variant font-code-sm text-code-sm flex items-center justify-between">
            <span className="text-outline truncate max-w-[130px]">RFC Spec Verification</span>
            <span className="text-outline font-medium">STANDBY</span>
          </div>
          <div className="flex items-center justify-between font-label-sm text-label-sm text-outline pt-0.5">
            <span>DeepSeek-R1</span>
            <span className="text-on-surface-variant">--</span>
          </div>
        </div>
      </div>{" "}
      <div className="absolute left-[26%] top-[25%] z-40 max-w-xs bg-surface-container-high/95 backdrop-blur-md p-3.5 rounded-xl shadow-xl transition-all">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-1.5 font-label-sm text-label-sm text-secondary font-semibold">
            <span className="material-symbols-outlined text-[14px]">swap_horiz</span>
            <span>PIPE #04: MICHAEL ↔ NOVA</span>
          </div>
          <span className="font-code-sm text-code-sm px-1.5 py-0.2 rounded bg-tertiary-container/30 text-tertiary font-medium">
            Not measured
          </span>
        </div>
        <div className="text-body-sm font-body-sm text-on-surface bg-surface-container-lowest p-2 rounded mb-2 leading-relaxed">
          <span className="text-secondary font-code-sm">@Nova</span>Not measured
        </div>
        <div className="flex items-center justify-between text-outline font-label-sm text-label-sm pt-1">
          <span>Not measured</span>
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="chevron right — coming later"
            className="text-primary hover:text-primary-fixed-dim font-medium transition-colors flex items-center gap-0.5"
            type="button"
          >
            Inspect Stream
            <span className="material-symbols-outlined text-[12px]">chevron_right</span>
          </button>
        </div>
      </div>
    </div>
  );
}
