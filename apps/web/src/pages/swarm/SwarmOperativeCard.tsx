import { useLinkBehavior } from "../../hooks/useLinkBehavior";
import type { SwarmOperativeMock } from "../../mocks/agents";

// Operative card from the Stitch swarm design; opens the agent's profile.
export function SwarmOperativeCard({ operative }: { operative: SwarmOperativeMock }) {
  const link = useLinkBehavior("/agents");
  return (
    <div
      {...link}
      className={`group rounded-xl bg-surface-container-low p-4 flex flex-col justify-between border transition-all ${operative.tone.card}`}
    >
      <div className="flex items-start justify-between pb-3 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div
            className={`relative w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center border ${operative.tone.avatar}`}
          >
            <span className="material-symbols-outlined text-[20px]">{operative.icon}</span>
            <span
              className={`absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border-2 border-surface-container-lowest ${operative.tone.presenceDot}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                {operative.name}
              </span>
              <span
                className={`font-label-sm text-label-sm px-1 rounded ${operative.tone.modelBadge}`}
              >
                {operative.model}
              </span>
            </div>
            <span className="font-code-sm text-code-sm text-on-surface-variant">
              {operative.role}
            </span>
          </div>
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full border font-label-sm text-label-sm ${operative.tone.statusPill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${operative.tone.statusDot}`} />
          {operative.statusLabel}
        </div>
      </div>
      <div className="py-3 flex flex-col gap-1.5">
        <div className="flex items-center justify-between font-label-sm text-label-sm text-outline">
          <span>OBJECTIVE</span>
          <span className={`font-code-sm ${operative.tone.objectiveMeta}`}>
            {operative.objectiveMeta}
          </span>
        </div>
        <p className={`font-body-md text-body-md line-clamp-2 ${operative.tone.objective}`}>
          {operative.objective}
        </p>
        <div className="flex items-center gap-1.5 text-outline font-code-sm text-code-sm">
          <span className={`material-symbols-outlined text-[13px] ${operative.tone.contextIcon}`}>
            {operative.contextIcon}
          </span>
          {operative.context}
        </div>
      </div>
      <div className="bg-surface-container-lowest rounded p-2 border border-outline-variant/30 font-code-sm text-code-sm flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-outline text-[10px]">
          <span>{operative.streamLabel}</span>
          <span className={operative.tone.streamStatus}>{operative.streamStatus}</span>
        </div>
        {operative.streamLine}
      </div>
      {operative.progress ? (
        <div className="pt-3 mt-1 flex flex-col gap-1.5 border-t border-outline-variant/20">
          <div className="flex items-center justify-between font-code-sm text-code-sm">
            <span className="text-outline">{operative.progress.label}</span>
            <span className={`font-medium ${operative.progress.tone.detail}`}>
              {operative.progress.detail}
            </span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className={`h-full ${operative.progress.tone.bar}`} />
          </div>
        </div>
      ) : (
        <div className="pt-3 mt-1 flex items-center justify-between border-t border-outline-variant/20">
          <button
            disabled
            title="Coming later — this control is not available in the beta"
            aria-label="add — coming later"
            className="w-full py-1.5 rounded bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-code-sm text-code-sm flex items-center justify-center gap-1.5 border border-outline-variant/30 transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span>Assign Objective</span>
          </button>
        </div>
      )}
    </div>
  );
}
