// Ported from the Stitch export (agent_hive_create_agent_wizard/code.html). Keep visually identical to the design.
import { ACCENT_CLASSES, TOOLS, providerLabel } from "./agentDraft";
import { useAgentDraft } from "./agentDraftContext";
import { AvatarGlyph } from "./AvatarGlyph";

export function AgentLivePreview() {
  const { draft } = useAgentDraft();
  const armedTools = TOOLS.filter((tool) => draft.tools.has(tool.id));
  return (
    <div className="lg:col-span-4 bg-surface-container-low p-6 md:p-8 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="flex flex-col gap-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">
              LIVE OPERATIVE SYNTHESIS
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
          </div>
          <span className="font-code-sm text-code-sm text-tertiary px-2 py-0.5 rounded bg-tertiary/10 font-mono">
            READY
          </span>
        </div>
        <div className="bg-surface-container-lowest p-6 rounded-2xl flex flex-col items-center text-center gap-4 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-secondary to-tertiary" />
          <div className="relative mt-2">
            <div className="w-24 h-24 rounded-2xl bg-surface-container-high flex items-center justify-center relative overflow-hidden shadow-inner">
              <svg
                className="w-14 h-14 text-primary transition-all duration-300"
                fill="none"
                id="live-preview-svg"
                stroke="currentColor"
                strokeWidth="1.5"
                viewBox="0 0 24 24"
              >
                <AvatarGlyph index={draft.avatar} />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-transparent pointer-events-none" />
            </div>
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-label-sm font-mono flex items-center gap-1 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>ONLINE</span>
            </div>
          </div>
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center justify-center gap-2">
              <h3
                className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold"
                id="live-agent-name"
              >
                {draft.name.trim() || "Kite"}
              </h3>
              <span className="font-code-sm text-code-sm text-outline font-mono">OP-07</span>
            </div>
            <div
              className="font-body-md text-body-md text-secondary font-medium"
              id="live-agent-role"
            >
              {draft.role.trim() || "Systems Architect"}
            </div>
          </div>
          <div className="w-full p-2.5 rounded-xl bg-surface-container flex items-center justify-between text-left">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-secondary text-[20px]">
                psychology
              </span>
              <div className="flex flex-col">
                <span
                  className="font-code-sm text-code-sm text-on-surface font-medium truncate"
                  id="live-agent-provider"
                >
                  {providerLabel(draft.provider)}
                </span>
                <span className="font-label-sm text-label-sm text-outline truncate">
                  DeepSeek-R1 • 128k ctx • temp {(draft.temperature / 100).toFixed(2)}
                </span>
              </div>
            </div>
            <span className="material-symbols-outlined text-outline text-[16px]">tune</span>
          </div>
          <div className="w-full flex flex-col gap-2 text-left">
            <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
              <span>ARMED CAPABILITIES</span>
              <span className="text-primary font-mono" id="live-tool-count">
                {armedTools.length} ACTIVE
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5" id="live-tool-icons">
              {armedTools.map((tool) => (
                <span
                  key={tool.id}
                  className="px-2 py-1 rounded bg-surface-container font-code-sm text-code-sm text-on-surface flex items-center gap-1.5 shadow-sm"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${ACCENT_CLASSES[tool.accent].dot}`} />
                  {tool.shortLabel}
                </span>
              ))}
            </div>
          </div>
          <div className="w-full flex flex-col gap-2 pt-2">
            <div className="flex items-center justify-between font-code-sm text-code-sm">
              <span className="text-on-surface-variant">Cognitive Readiness</span>
              <span className="text-tertiary font-semibold font-mono">94% Nominal</span>
            </div>
            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div className="h-full bg-tertiary w-[94%] rounded-full shadow-sm" />
            </div>
            <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
              <span>Footprint: 5.2 GB VRAM</span>
              <span>Est. Cost: $0.00/hr</span>
            </div>
          </div>
          <div className="w-full p-3 rounded-xl bg-surface-container text-left flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
              <span>INITIAL SYNTHESIZED GREETING</span>
              <span className="material-symbols-outlined text-[14px] text-tertiary">sms</span>
            </div>
            <p className="font-code-sm text-code-sm text-on-surface leading-snug font-mono">
              “Ready to initialize. Swarm mesh connected. Awaiting initial task delegation.”
            </p>
          </div>
        </div>
        <div className="p-3 bg-surface-container-lowest rounded-xl flex items-center justify-between text-on-surface-variant font-code-sm text-code-sm">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-[18px]">verified</span>
            Sandbox Enclave Tier 3 Active
          </span>
          <span className="font-mono text-tertiary">AIRGAPPED</span>
        </div>
      </div>
      <div className="pt-4 flex items-center justify-between text-outline font-label-sm text-label-sm">
        <span>SYNAPSE VER 2.4-PRO</span>
        <span>HYPERION CLUSTER SYNC</span>
      </div>
    </div>
  );
}
