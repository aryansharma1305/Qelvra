// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import type { KeyboardEvent } from "react";
import { PROVIDERS, temperatureLabel, type ProviderId } from "./agentDraft";
import { useAgentDraft } from "./agentDraftContext";

// Selection moves the card container treatment; inner accents stay as designed.
const PROVIDER_ON =
  "provider-card cursor-pointer p-4 rounded-xl bg-surface-container flex flex-col gap-3 relative overflow-hidden transition-all shadow-md";
const PROVIDER_OFF =
  "provider-card cursor-pointer p-4 rounded-xl bg-surface-container-lowest flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-surface-container";

export function StepIntelligence({ active }: { active: boolean }) {
  const { draft, update } = useAgentDraft();
  const providerProps = (provider: ProviderId) => ({
    role: "radio",
    tabIndex: 0,
    "aria-checked": draft.provider === provider,
    "aria-label": PROVIDERS.find((p) => p.id === provider)?.label,
    onClick: () => update({ provider }),
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        update({ provider });
      }
    },
  });
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-2"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {"Intelligence & Reasoning Substrate"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Select the underlying inference engine, context pipeline, and cognitive temperature.
            </p>
          </div>
          <span className="font-label-sm text-label-sm px-2.5 py-1 rounded bg-tertiary-container/30 text-tertiary font-mono">
            RTX 4090 ACTIVE
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div
            className={draft.provider === "ollama" ? PROVIDER_ON : PROVIDER_OFF}
            {...providerProps("ollama")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-[22px]">memory</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Ollama Local
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-secondary" />
            </div>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              DeepSeek R1 Distill 32B on dedicated GPU enclave. Zero cloud telemetry egress.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-label-sm text-label-sm text-secondary font-mono">
                0.00ms latency
              </span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface">
                Local Enclave
              </span>
            </div>
          </div>
          <div
            className={draft.provider === "gemini" ? PROVIDER_ON : PROVIDER_OFF}
            {...providerProps("gemini")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[22px]">blur_on</span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Gemini Pro
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-outline">v2.5</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Google DeepMind multimodal reasoning engine with 1M native context depth.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-label-sm text-label-sm text-outline font-mono">
                Fast Cloud API
              </span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-outline">
                DeepMind
              </span>
            </div>
          </div>
          <div
            className={draft.provider === "claude" ? PROVIDER_ON : PROVIDER_OFF}
            {...providerProps("claude")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-outline text-[22px]">
                  smart_toy
                </span>
                <span className="font-headline-sm text-headline-sm text-on-surface">
                  Claude Sonnet
                </span>
              </div>
              <span className="font-label-sm text-label-sm text-outline">v3.5</span>
            </div>
            <p className="font-body-sm text-body-sm text-outline">
              Anthropic state-of-the-art coding benchmark intelligence with fine artifact control.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="font-label-sm text-label-sm text-outline font-mono">180 t/s</span>
              <span className="font-label-sm text-label-sm px-1.5 py-0.5 rounded bg-surface-container-high text-outline">
                Anthropic
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface">
                Reasoning Effort Spectrum
              </label>
              <span className="font-code-sm text-code-sm text-primary font-mono">
                Deep Analytical
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container rounded-lg">
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                Low
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                Balanced
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm bg-primary text-on-primary font-medium rounded shadow-sm"
                type="button"
              >
                Deep
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                Exhaustive
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface">
                Context Buffer Window
              </label>
              <span className="font-code-sm text-code-sm text-secondary font-mono">
                128,000 tokens
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 p-1 bg-surface-container rounded-lg">
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                32k
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                64k
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm bg-secondary text-on-secondary font-medium rounded shadow-sm"
                type="button"
              >
                128k
              </button>
              <button
                className="py-1.5 text-center font-code-sm text-code-sm text-outline hover:text-on-surface rounded"
                type="button"
              >
                1M
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md text-on-surface">
                Cognitive Temperature (Determinism vs Synthesis)
              </label>
              <span className="font-code-sm text-code-sm text-tertiary font-mono" id="temp-display">
                {temperatureLabel(draft.temperature)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-code-sm text-code-sm text-outline">0.0</span>
              <input
                className="w-full accent-primary bg-surface-container h-1.5 rounded-lg cursor-pointer"
                max="100"
                min="0"
                type="range"
                aria-label="Cognitive temperature"
                value={draft.temperature}
                onChange={(event) => update({ temperature: Number(event.target.value) })}
              />
              <span className="font-code-sm text-code-sm text-outline">1.0</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
