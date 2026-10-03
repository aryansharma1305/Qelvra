// Ported from the Stitch export (agent_hive_onboarding_build_your_ai_team/code.html). Keep visually identical to the design.
import { Link } from "react-router";
import { TeamPreview } from "./TeamPreview";

export function BuildTeamStep() {
  return (
    <main className="w-full pt-16 flex-1 flex flex-col justify-center relative">
      <div className="flex flex-col w-full">
        <div className="relative w-full max-w-7xl mx-auto px-gutter md:px-margin-lg py-space-xl flex flex-col items-center justify-between min-h-[calc(100vh-8rem)]">
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-[640px] h-[360px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10" />
          <div className="absolute top-1/3 left-1/4 w-[380px] h-[380px] bg-secondary/5 rounded-full blur-[100px] pointer-events-none -z-10" />
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-space-sm bg-surface-container-high/60 backdrop-blur-md px-space-md py-1 rounded-full shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="font-label-md text-label-md uppercase tracking-widest text-primary-fixed-dim">
                Stage 01 / 05 — Genesis Protocol
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-space-lg text-on-surface-variant font-code-sm text-code-sm">
              <span className="flex items-center gap-space-xs">
                <span className="text-tertiary material-symbols-outlined text-[14px]">bolt</span>
                <span>Sub-12ms Local IPC</span>
              </span>
              <span className="flex items-center gap-space-xs">
                <span className="text-secondary material-symbols-outlined text-[14px]">
                  verified_user
                </span>
                <span>Zero Data Egress</span>
              </span>
            </div>
          </div>
          <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-gutter-lg items-center my-auto py-space-lg">
            <div className="lg:col-span-6 flex flex-col items-start gap-space-lg z-10">
              <div className="flex items-center gap-space-xs px-space-sm py-1 rounded-lg bg-surface-container-low text-secondary font-code-sm text-code-sm">
                <span className="material-symbols-outlined text-[16px]">hub</span>
                <span>Sovereign Hive Multi-Agent Runtime</span>
              </div>
              <div className="flex flex-col gap-space-xs">
                <h1 className="font-display text-display text-on-surface tracking-tight max-w-xl">
                  Build your{" "}
                  <span className="bg-gradient-to-r from-primary via-secondary to-tertiary-fixed-dim bg-clip-text text-transparent">
                    AI team
                  </span>
                  .
                </h1>
                <p className="font-body-lg text-body-lg text-on-surface-variant max-w-lg mt-space-xs">
                  Give specialized agents tasks. Let them collaborate. Stay in deterministic control
                  across every execution loop.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-space-md pt-space-xs">
                <Link
                  className="group relative flex items-center gap-space-sm px-space-lg py-space-md rounded-xl bg-primary text-on-primary font-headline-sm text-headline-sm transition-all duration-300 hover:bg-primary-container hover:shadow-[0_0_24px_rgba(208,188,255,0.35)] shadow-md"
                  to="/onboarding/goal"
                >
                  <span>Create your workspace</span>
                  <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-1">
                    arrow_forward
                  </span>
                </Link>
                <a
                  className="flex items-center gap-space-xs px-space-md py-space-md rounded-xl bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors font-body-md text-body-md"
                  href="#"
                >
                  <span className="material-symbols-outlined text-[18px]">terminal</span>
                  <span>Explore interactive sandbox</span>
                </a>
              </div>
              <div className="grid grid-cols-3 gap-space-md pt-space-sm w-full max-w-lg">
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-xs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    ISOLATION
                  </span>
                  <span className="font-headline-sm text-headline-sm text-tertiary">Sandboxed</span>
                  <span className="font-body-sm text-body-sm text-outline">
                    Per-agent kernel jails
                  </span>
                </div>
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-xs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">MEMORY</span>
                  <span className="font-headline-sm text-headline-sm text-secondary">
                    RAG Vector
                  </span>
                  <span className="font-body-sm text-body-sm text-outline">
                    Zero shared state leak
                  </span>
                </div>
                <div className="bg-surface-container-low p-space-md rounded-xl flex flex-col gap-space-xs">
                  <span className="font-code-sm text-code-sm text-on-surface-variant">
                    THROUGHPUT
                  </span>
                  <span className="font-headline-sm text-headline-sm text-primary">48.2k</span>
                  <span className="font-body-sm text-body-sm text-outline">
                    Tokens / sec routed
                  </span>
                </div>
              </div>
            </div>
            <TeamPreview />
          </div>
          <div className="w-full pt-space-md flex flex-col md:flex-row items-center justify-between gap-space-md bg-surface-container-lowest/50 p-space-md rounded-2xl shadow-sm">
            <div className="flex items-center gap-space-md">
              <span className="font-code-sm text-code-sm text-outline uppercase tracking-wider">
                Active Protocols
              </span>
              <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded text-on-surface font-code-sm text-code-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                <span>Docker Daemon: OK</span>
              </div>
              <div className="flex items-center gap-space-xs bg-surface-container-high px-space-sm py-0.5 rounded text-on-surface font-code-sm text-code-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                <span>Qdrant Store: Connected</span>
              </div>
            </div>
            <div className="flex items-center gap-space-md">
              <a
                className="text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors"
                href="#"
              >
                Import existing repository
              </a>
              <span className="text-outline">•</span>
              <a
                className="text-on-surface-variant hover:text-on-surface font-body-sm text-body-sm transition-colors"
                href="#"
              >
                Read Architectural Whitepaper
              </a>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
