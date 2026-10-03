import type { ActivityEventMock } from "../../mocks/activity";

export function ActivityItem({ event }: { event: ActivityEventMock }) {
  return (
    <div className="flex items-start gap-3.5 relative">
      <div
        className={`w-9 h-9 rounded-full border flex items-center justify-center z-10 shrink-0 ${event.tone.iconBox}`}
      >
        <span className="material-symbols-outlined text-[16px]">{event.icon}</span>
      </div>
      <div className="flex flex-col flex-1 p-3 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/10 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <span className={`font-body-md text-body-md font-medium ${event.tone.title}`}>
            {event.title}
          </span>
          <span className="font-code-sm text-code-sm text-outline shrink-0">{event.at}</span>
        </div>
        <p
          className={`font-code-sm text-code-sm text-on-surface-variant mt-1 ${event.tone.detail}`}
        >
          {event.detail}
        </p>
      </div>
    </div>
  );
}
