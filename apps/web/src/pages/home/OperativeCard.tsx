import { useLinkBehavior } from "../../hooks/useLinkBehavior";
import type { HomeOperativeMock } from "../../mocks/agents";

// Worker card from the Stitch home design; opens the agent's profile.
export function OperativeCard({ operative }: { operative: HomeOperativeMock }) {
  const link = useLinkBehavior("/agents");
  return (
    <div
      {...link}
      className="rounded-2xl bg-surface-container-low p-5 border border-outline-variant/20 hover:border-outline-variant/40 transition-all flex flex-col justify-between shadow-sm"
    >
      <div>
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-outline-variant/15">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center border ${operative.tone.iconBox}`}
            >
              <span className="material-symbols-outlined text-[20px]">{operative.icon}</span>
            </div>
            <div>
              <h4 className="font-headline-sm text-headline-sm text-on-surface font-semibold">
                {operative.name}
              </h4>
              <p className="font-code-sm text-code-sm text-outline">{operative.subtitle}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-code-sm text-code-sm border ${operative.tone.statusPill}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${operative.tone.statusDot}`} />
            <span>{operative.statusLabel}</span>
          </span>
        </div>
        <div className="mt-3.5 flex flex-col gap-1">
          <span className="font-label-sm text-label-sm text-outline uppercase">Sample task</span>
          <p className="font-body-md text-body-md text-on-surface">{operative.task}</p>
        </div>
        {operative.alert && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded bg-error-container/30 border border-error/20 text-error font-code-sm text-code-sm">
            <span className="material-symbols-outlined text-[14px]">warning</span>
            <span>{operative.alert}</span>
          </div>
        )}
        <div className={`flex flex-col gap-1.5 ${operative.tone.progressBlock}`}>
          <div className="flex justify-between font-code-sm text-code-sm">
            <span className={operative.tone.progressLabel}>{operative.progressLabel}</span>
            <span className={`font-medium ${operative.tone.progressValue}`}>
              {operative.progress}
            </span>
          </div>
          <div className="w-full h-1 bg-surface-container-highest rounded-full overflow-hidden">
            <div className={`h-full ${operative.tone.progressBar}`} />
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-outline-variant/15 flex items-center justify-between text-outline font-code-sm text-code-sm">
        <span className="truncate">{operative.lastEvent}</span>
        <span className="shrink-0 text-on-surface-variant/70">{operative.lastEventAt}</span>
      </div>
    </div>
  );
}
