import {
  useProviders,
  providerStatus,
  providerGuidance,
  canLaunchProvider,
} from "../../features/providers/useProviders";
import { useAgentDraft } from "./agentDraftContext";
export function StepIntelligence({ active }: { active: boolean }) {
  const { draft, update } = useAgentDraft();
  const { providers, error, loading, retry } = useProviders();
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-2"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">AI provider</h2>
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Choose a CLI installed on this machine. Each agent starts in its own workspace. Sign in
            using the provider’s CLI.
          </p>
        </div>
        {loading && (
          <p role="status" className="text-on-surface-variant">
            Checking installed providers…
          </p>
        )}
        {error && (
          <p role="alert" className="text-error">
            {error}
            <button type="button" onClick={retry} className="ml-2 underline">
              Retry providers
            </button>
          </p>
        )}
        <div
          role="radiogroup"
          aria-label="Agent provider"
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {providers.map((provider) => (
            <button
              key={provider.id}
              type="button"
              role="radio"
              aria-checked={draft.provider === provider.id}
              disabled={!canLaunchProvider(provider)}
              onClick={() => update({ provider: provider.id })}
              className={`provider-card p-4 rounded-xl flex flex-col gap-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed ${draft.provider === provider.id ? "bg-surface-container shadow-md" : "bg-surface-container-lowest enabled:hover:bg-surface-container"}`}
            >
              <span className="flex items-center gap-2 font-headline-sm text-headline-sm text-on-surface">
                <span
                  aria-hidden="true"
                  className={`w-2 h-2 rounded-full ${canLaunchProvider(provider) ? "bg-secondary" : "bg-outline"}`}
                />
                {provider.name}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {providerStatus(provider)}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant">
                {providerGuidance(provider)}
              </span>
              <span className="font-code-sm text-code-sm text-on-surface-variant">
                {provider.version
                  ? `v${provider.version}`
                  : provider.kind === "fake"
                    ? "Deterministic test CLI"
                    : provider.kind === "shell"
                      ? "Server-selected shell"
                      : "Interactive CLI"}
              </span>
            </button>
          ))}
        </div>
        <p className="font-body-sm text-body-sm text-on-surface-variant">
          Model, context, and permissions are managed by each provider. Creating an agent does not
          start it or execute a task.
        </p>
      </div>
    </section>
  );
}
