// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import { TOOLS } from "./agentDraft";
import { useAgentDraft } from "./agentDraftContext";
import { ToolChip } from "./ToolChip";

export function StepCapabilities({ active }: { active: boolean }) {
  const { draft, update } = useAgentDraft();
  return (
    <section
      className={`step-panel ${active ? "flex" : "hidden"} flex-col gap-6`}
      id="step-panel-3"
    >
      <div className="bg-surface-container-low p-6 rounded-xl flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              {"Capability Chips & Tool Matrix"}
            </h2>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Preview only — these selections do not change provider permissions or tools.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm text-outline">TOOL CONFIG:</span>
            <span className="font-label-sm text-label-sm px-2 py-0.5 rounded bg-tertiary-container/30 text-tertiary font-mono">
              COMING LATER
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {TOOLS.map((tool) => (
            <ToolChip
              key={tool.id}
              tool={tool}
              enabled={draft.tools.has(tool.id)}
              onToggle={() => {
                const tools = new Set(draft.tools);
                if (tools.has(tool.id)) tools.delete(tool.id);
                else tools.add(tool.id);
                update({ tools });
              }}
            />
          ))}
        </div>
        <div className="p-3 bg-surface-container rounded-lg flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-tertiary text-[18px]">lock</span>
            Provider-owned permissions; Qelvra does not enforce an OS sandbox.
          </span>
          <span className="font-label-sm text-label-sm text-outline font-mono">PREVIEW ONLY</span>
        </div>
      </div>
    </section>
  );
}
