// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import { DIRECTIVE_PRESETS, type DirectivePreset } from "./agentDraft";
import { useAgentDraft } from "./agentDraftContext";

const PRESET_BUTTONS: readonly { preset: DirectivePreset; label: string }[] = [
  { preset: "security", label: "Paranoid Security" },
  { preset: "velocity", label: "High-Velocity" },
  { preset: "architect", label: "Reflective Architect" },
];
const PRESET_ON =
  "px-2.5 py-1 rounded bg-primary/20 text-primary font-code-sm text-code-sm font-medium";
const PRESET_OFF =
  "px-2.5 py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant hover:text-on-surface transition-colors";

export function StepDirective({ active }: { active: boolean }) {
  const { draft, update } = useAgentDraft();
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-5"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {"System Directive & Operational Constitution"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Define core deterministic guidelines, code style rules, and safety boundaries.
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {PRESET_BUTTONS.map(({ preset, label }) => (
              <button
                key={preset}
                className={draft.preset === preset ? PRESET_ON : PRESET_OFF}
                type="button"
                aria-pressed={draft.preset === preset}
                onClick={() => update({ preset, directive: DIRECTIVE_PRESETS[preset] })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative bg-surface-container-lowest rounded-xl overflow-hidden shadow-inner">
          <div className="bg-surface-container px-4 py-2 flex items-center justify-between font-code-sm text-code-sm text-outline">
            <span className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[14px] text-tertiary">code</span>
              system_directive.xml
            </span>
            <span>UTF-8 • STRICT REASONING FORMAT</span>
          </div>
          <textarea
            className="w-full p-4 bg-transparent text-primary font-code-sm text-code-sm outline-none resize-none leading-relaxed"
            id="system-directive-editor"
            rows={7}
            spellCheck="false"
            value={draft.directive}
            onChange={(event) => update({ directive: event.target.value, preset: null })}
          />
        </div>
        <div className="flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-tertiary" />
            Constitutional prompt token consumption: 84 tokens
          </span>
          <span className="text-outline">Max Context Overhead: 0.06%</span>
        </div>
      </div>
    </section>
  );
}
