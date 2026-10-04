// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import { CreateAgentRequestSchema } from "@qelvra/shared";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { createAgentInStore } from "../../features/agents/agents-store";
import { ApiError } from "../../lib/api";
import { DEFAULT_AGENT_DRAFT, TOTAL_STEPS, clampStep, type AgentDraft } from "./agentDraft";
import { AgentDraftContext } from "./agentDraftContext";
import { AgentLivePreview } from "./AgentLivePreview";
import { StepCapabilities } from "./StepCapabilities";
import { StepDirective } from "./StepDirective";
import { StepIdentity } from "./StepIdentity";
import { StepIntelligence } from "./StepIntelligence";
import { StepWorkspace } from "./StepWorkspace";
import { WizardHeader } from "./WizardHeader";

export function CreateAgentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const step = clampStep(searchParams.get("step"));
  const [draft, setDraft] = useState<AgentDraft>(DEFAULT_AGENT_DRAFT);
  const update = (patch: Partial<AgentDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // The step lives in the URL so it survives reloads and works with back/forward.
  const goToStep = (next: number) => setSearchParams({ step: String(clampStep(next)) });

  // Only identity and a known provider ID are submitted.
  const submit = async () => {
    if (submitting) return;
    const parsed = CreateAgentRequestSchema.safeParse({
      name: draft.name,
      role: draft.role,
      providerId: draft.provider,
    });
    if (!parsed.success) {
      setSubmitError(parsed.error.issues[0]?.message ?? "Name and role are required");
      goToStep(1);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await createAgentInStore(parsed.data);
      navigate("/agents");
    } catch (error) {
      setSubmitting(false);
      setSubmitError(
        error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")
          ? "The Qelvra server is not reachable. Start it and try again."
          : error instanceof Error
            ? error.message
            : "Could not create the agent",
      );
    }
  };

  // ⌘/Ctrl+Enter creates the agent, as the button's shortcut hint says.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void submitRef.current();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <AgentDraftContext.Provider value={{ draft, update }}>
      <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
        <div className="flex flex-col w-full">
          <div className="relative w-full overflow-hidden px-4 md:px-8 py-6 max-w-[1720px] mx-auto">
            <div className="absolute -top-32 left-1/4 w-96 h-96 bg-primary-container/10 rounded-full blur-[128px] pointer-events-none" />{" "}
            <div className="absolute top-1/2 right-10 w-96 h-96 bg-secondary-container/10 rounded-full blur-[140px] pointer-events-none" />{" "}
            <div className="absolute -bottom-24 left-1/3 w-80 h-80 bg-tertiary-container/10 rounded-full blur-[120px] pointer-events-none" />{" "}
            <div className="relative bg-surface-container-lowest/95 backdrop-blur-2xl rounded-2xl shadow-2xl overflow-hidden">
              <div className="bg-surface-container-low px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse shadow-sm" />
                  <div className="flex items-center gap-2">
                    <span className="font-code-md text-code-md text-primary font-medium tracking-tight">
                      OPERATIVE_PROVISIONING_PIPELINE
                    </span>
                    <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant uppercase">
                      Enclave-4
                    </span>
                  </div>
                  <span className="text-outline-variant/60 text-xs">•</span>
                  <span className="font-label-sm text-label-sm text-outline">
                    PROTOCOL: ISO-9042 SYNAPSE MATRIX
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface-variant">
                    <span className="text-tertiary font-medium">Node:</span>
                    <span>hyperion-mesh-01</span>
                  </div>
                  <button
                    className="w-7 h-7 rounded flex items-center justify-center text-outline hover:text-on-surface hover:bg-surface-container-high transition-colors"
                    title="Close Provisioning Session"
                    onClick={() => navigate("/agents")}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[820px]">
                <div className="lg:col-span-8 flex flex-col justify-between p-6 md:p-8 bg-surface-container-lowest">
                  <div className="flex flex-col gap-6">
                    <WizardHeader step={step} onStepSelect={goToStep} />
                    <div className="mt-2 min-h-[460px]">
                      {" "}
                      <StepIdentity active={step === 1} /> <StepIntelligence active={step === 2} />{" "}
                      <StepCapabilities active={step === 3} /> <StepWorkspace active={step === 4} />{" "}
                      <StepDirective active={step === 5} />
                    </div>
                    <div className="pt-4 bg-surface-container-lowest flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-all flex items-center gap-2"
                          type="button"

                          disabled
                          title="Drafts are not saved yet"
                        >
                          <span className="material-symbols-outlined text-[16px]">bookmark</span>
                          <span>Save Draft</span>
                        </button>
                        <button
                          className="px-4 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-body-md text-body-md transition-all flex items-center gap-1.5"
                          id="btn-prev-step"
                          type="button"
                          style={{ visibility: step === 1 ? "hidden" : "visible" }}
                          onClick={() => goToStep(step - 1)}
                        >
                          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                          <span>Previous</span>
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          className={`px-4 py-2 rounded-lg bg-surface-container-high hover:bg-surface-bright text-on-surface font-body-md text-body-md transition-all flex items-center gap-1.5${step === TOTAL_STEPS ? " opacity-40 pointer-events-none" : ""}`}
                          id="btn-next-step"
                          type="button"
                          disabled={step === TOTAL_STEPS}
                          onClick={() => goToStep(step + 1)}
                        >
                          <span>Next Step</span>
                          <span className="material-symbols-outlined text-[16px]">
                            arrow_forward
                          </span>
                        </button>
                        <button
                          className="relative group px-6 py-2.5 rounded-lg bg-primary hover:bg-primary-container text-on-primary font-headline-sm text-headline-sm font-semibold transition-all shadow-lg flex items-center gap-2 disabled:opacity-70"
                          type="button"
                          id="btn-create-agent"
                          onClick={() => void submit()}
                          disabled={submitting}
                        >
                          <span className="material-symbols-outlined text-[20px] transition-transform group-hover:rotate-12">
                            bolt
                          </span>
                          {/* Creating registers the agent; it is not started (no processes yet). */}
                          <span id="cta-label">{submitting ? "Creating…" : "Create Agent"}</span>
                          <kbd className="font-code-sm text-code-sm bg-on-primary/20 text-on-primary px-1.5 py-0.5 rounded ml-1">
                            ⌘↵
                          </kbd>
                        </button>
                      </div>
                      {submitError && (
                        <p role="alert" className="basis-full font-code-sm text-code-sm text-error">
                          {submitError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <AgentLivePreview />
              </div>
            </div>
          </div>
        </div>
      </main>
    </AgentDraftContext.Provider>
  );
}
