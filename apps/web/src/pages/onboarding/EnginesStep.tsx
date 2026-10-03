// Ported from the Stitch export (agent_hive_onboarding_choose_ai_engines/code.html). Keep visually identical to the design.
import { useState } from "react";
import { useOnboardingNavigation } from "../../components/onboarding/useOnboardingNavigation";
import { ComputeSelector } from "./ComputeSelector";

// TODO(PR 13): the chosen engine should select the default provider adapter.
export function EnginesStep() {
  const { goNext, goBack } = useOnboardingNavigation();
  const [engine, setEngine] = useState(0);
  return (
    <main className="w-full pt-16 flex-1 flex flex-col justify-center relative">
      <div className="flex flex-col w-full">
        <div className="relative w-full max-w-7xl mx-auto px-margin sm:px-margin-md lg:px-margin-lg py-space-xl flex flex-col gap-space-xl overflow-hidden">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-primary-container/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/3 -right-32 w-96 h-96 bg-secondary/10 rounded-full blur-[140px] pointer-events-none" />
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-space-lg">
            <div className="flex flex-col gap-space-sm max-w-3xl">
              <div className="flex items-center gap-space-sm">
                <span className="px-space-sm py-0.5 rounded-full bg-surface-container-high text-primary font-code-sm text-code-sm tracking-wider uppercase">
                  {"04 / 05 — Compute & Runtime"}
                </span>
                <span className="inline-flex items-center gap-1.5 px-space-sm py-0.5 rounded-full bg-tertiary-container/20 text-tertiary font-label-sm text-label-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse" />
                  Hardware Scanned
                </span>
              </div>
              <h1 className="font-display text-display text-on-surface tracking-tight">
                Where should your agents think?
              </h1>
              <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl">
                Select your compute topology. Keep your code 100% private or scale with cloud
                reasoning.
              </p>
            </div>
            <div className="flex items-center gap-space-md self-start md:self-end">
              <div className="bg-surface-container-lowest px-space-md py-space-sm rounded-xl flex items-center gap-space-md shadow-inner">
                <div className="flex flex-col">
                  <span className="font-label-sm text-label-sm uppercase text-outline">
                    Network State
                  </span>
                  <span className="font-code-sm text-code-sm text-tertiary font-medium">
                    Sovereign Isolation
                  </span>
                </div>
                <span
                  className="material-symbols-outlined text-secondary"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  shield_with_heart
                </span>
              </div>
            </div>
          </div>
          <div className="relative w-full rounded-xl bg-gradient-to-r from-surface-container-high via-surface-container to-surface-container-high p-px shadow-2xl">
            <div className="relative w-full rounded-[calc(0.5rem-1px)] bg-surface-container-lowest/90 backdrop-blur-xl p-space-lg sm:p-space-xl flex flex-col lg:flex-row lg:items-center justify-between gap-space-lg overflow-hidden">
              <div className="absolute -right-20 -bottom-20 w-72 h-72 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="flex items-start sm:items-center gap-space-lg relative z-10">
                <div className="w-14 h-14 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-lg">
                  <span className="material-symbols-outlined text-[32px]">memory</span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <span className="font-headline-md text-headline-md text-on-surface">
                      Run fully local with Ollama.
                    </span>
                    <span className="px-space-sm py-0.5 rounded bg-primary-container text-on-primary-container font-label-sm text-label-sm uppercase">
                      Zero Egress Verified
                    </span>
                  </div>
                  <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl">
                    Zero telemetry egress. Works offline on your Apple Silicon or NVIDIA RTX GPU.
                    Open weights, full data sovereignty.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-space-md self-start lg:self-center shrink-0 relative z-10">
                <div className="flex flex-col text-left lg:text-right">
                  <span className="font-code-sm text-code-sm text-tertiary font-medium">
                    Auto-configured
                  </span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    Socket: localhost:11434
                  </span>
                </div>
                <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">bolt</span>
                </div>
              </div>
            </div>
          </div>
          <ComputeSelector selected={engine} onSelect={setEngine} />
          <div className="w-full rounded-xl bg-surface-container-low p-space-lg flex flex-col sm:flex-row sm:items-center justify-between gap-space-md shadow-inner">
            <div className="flex items-start sm:items-center gap-space-md">
              <div className="w-10 h-10 rounded-lg bg-tertiary/15 text-tertiary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">enhanced_encryption</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-space-sm flex-wrap">
                  <span className="font-headline-sm text-headline-sm text-on-surface">
                    Enforce Zero Data Egress
                  </span>
                  <span className="px-space-xs py-0.5 rounded bg-tertiary-container/30 text-tertiary font-label-sm text-label-sm uppercase">
                    Air-gapped firewall
                  </span>
                </div>
                <span className="font-body-sm text-body-sm text-on-surface-variant">
                  Block outbound telemetry, diagnostic dumps, and model metric dispatch at kernel
                  socket level.
                </span>
              </div>
            </div>
            <div className="flex items-center self-end sm:self-center shrink-0">
              <label className="relative inline-flex items-center cursor-pointer">
                <input defaultChecked className="sr-only peer" id="egress-toggle" type="checkbox" />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-on-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-container" />
              </label>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-space-md pt-space-lg">
            <button
              onClick={goBack}
              className="w-full sm:w-auto px-space-lg py-space-sm rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-headline-sm flex items-center justify-center gap-space-xs transition-colors"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              <span>Back</span>
            </button>
            <div className="flex items-center gap-space-md w-full sm:w-auto">
              <span className="hidden md:inline font-code-sm text-code-sm text-outline">
                Press ⌘+↵ to advance
              </span>
              <button
                onClick={goNext}
                className="w-full sm:w-auto px-space-xl py-space-md rounded-lg bg-primary hover:bg-primary-fixed-dim text-on-primary font-headline-sm text-headline-sm flex items-center justify-center gap-space-sm shadow-[0_0_24px_rgba(208,188,255,0.35)] transition-all"
                type="button"
              >
                <span>Assemble Workspace</span>
                <span className="material-symbols-outlined text-[20px]">bolt</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
