// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import { TOTAL_STEPS, WIZARD_STEPS, providerLabel, type AgentDraft } from "./agentDraft";
import { useAgentDraft } from "./agentDraftContext";

type PillState = "done" | "current" | "upcoming";

const PILL_CLASSES: Record<PillState, string> = {
  done: "step-nav-pill flex flex-col gap-1.5 p-2.5 rounded-lg text-left transition-all bg-surface-container-high text-on-surface",
  current:
    "step-nav-pill flex flex-col gap-1.5 p-2.5 rounded-lg text-left transition-all bg-primary/10 text-primary",
  upcoming:
    "step-nav-pill flex flex-col gap-1.5 p-2.5 rounded-lg text-left transition-all bg-surface-container-low text-outline hover:text-on-surface",
};

function stepSummary(step: number, draft: AgentDraft): string {
  switch (step) {
    case 1:
      return `${draft.name || "Unnamed"} (Architect)`;
    case 2:
      return draft.provider === "ollama" ? "Ollama Local" : providerLabel(draft.provider);
    case 3:
      return `${draft.tools.size} Tools Enabled`;
    case 4:
      return "Agent workspace";
    default:
      return "System Prompt";
  }
}

interface StepPillProps {
  number: number;
  title: string;
  summary: string;
  state: PillState;
  onSelect: () => void;
}

// The three pill treatments (done / current / upcoming) are taken from the design.
function StepPill({ number, title, summary, state, onSelect }: StepPillProps) {
  return (
    <button
      className={PILL_CLASSES[state]}
      id={`step-pill-${number}`}
      type="button"
      aria-current={state === "current" ? "step" : undefined}
      onClick={onSelect}
    >
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-label-sm font-semibold">
          {String(number).padStart(2, "0")}. {title}
        </span>
        {state === "done" && (
          <span className="step-check material-symbols-outlined text-[14px] text-tertiary">
            check_circle
          </span>
        )}
        {state === "current" && (
          <span className="step-check material-symbols-outlined text-[14px] text-primary animate-pulse">
            radio_button_checked
          </span>
        )}
        {state === "upcoming" && (
          <span className="step-check material-symbols-outlined text-[14px] text-outline-variant">
            circle
          </span>
        )}
      </div>
      {state === "current" ? (
        <span className="font-code-sm text-code-sm text-primary/80 truncate">{summary}</span>
      ) : state === "done" ? (
        <span className="font-code-sm text-code-sm text-on-surface-variant truncate">
          {summary}
        </span>
      ) : (
        <span className="font-code-sm text-code-sm text-outline truncate">{summary}</span>
      )}
      {state === "current" ? (
        <div className="w-full h-0.5 rounded-full bg-primary shadow-sm" />
      ) : state === "done" ? (
        <div className="w-full h-0.5 rounded-full bg-tertiary" />
      ) : (
        <div className="w-full h-0.5 rounded-full bg-surface-container-highest" />
      )}
    </button>
  );
}

interface WizardHeaderProps {
  step: number;
  onStepSelect: (step: number) => void;
}

export function WizardHeader({ step, onStepSelect }: WizardHeaderProps) {
  const { draft } = useAgentDraft();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-primary uppercase tracking-widest font-semibold">
              Hiring Digital Teammate
            </span>
            <span className="font-label-sm text-label-sm text-outline">/</span>
            <span
              className="font-label-sm text-label-sm text-secondary font-medium"
              id="step-telemetry-badge"
            >
              Step {step} of {TOTAL_STEPS} • {WIZARD_STEPS[step - 1]?.subtitle}
            </span>
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight mt-1">
            Autonomous Operative Onboarding
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1.5 rounded-lg">
          <span className="material-symbols-outlined text-tertiary text-[18px]">
            format_image_left
          </span>
          <span className="font-code-sm text-code-sm text-on-surface-variant">
            Workspace per agent
          </span>
        </div>
      </div>
      <nav aria-label="Wizard Steps" className="grid grid-cols-5 gap-2 pt-2">
        {WIZARD_STEPS.map((meta, index) => {
          const number = index + 1;
          const state = number < step ? "done" : number === step ? "current" : "upcoming";
          return (
            <StepPill
              key={meta.title}
              number={number}
              title={meta.title}
              summary={stepSummary(number, draft)}
              state={state}
              onSelect={() => onStepSelect(number)}
            />
          );
        })}
      </nav>
    </div>
  );
}
