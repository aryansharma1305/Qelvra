import type { ActivityEvent } from "@qelvra/shared";
import { Link } from "react-router";
import { formatActivityEvent, relativeActivityTime } from "../../features/activity/format-activity";

export function ActivityItem({ event, now }: { event: ActivityEvent; now?: number }) {
  const display = formatActivityEvent(event);
  return (
    <div
      data-activity-type={event.type}
      data-activity-id={event.id}
      className="flex flex-col sm:flex-row items-start gap-3.5 relative"
    >
      <div
        className={`w-9 h-9 rounded-full border flex items-center justify-center z-10 shrink-0 ${display.tone.iconBox}`}
      >
        <span className="material-symbols-outlined text-[16px]">{display.icon}</span>
      </div>
      <div className="flex flex-col flex-1 min-w-0 w-full p-3 rounded-xl bg-surface-container/60 hover:bg-surface-container border border-outline-variant/10 transition-colors">
        <div className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-2">
          <Link
            to={display.href}
            className={`font-body-md text-body-md font-medium break-words hover:underline ${display.tone.title}`}
          >
            {display.title}
          </Link>
          <time
            dateTime={event.timestamp}
            title={event.timestamp}
            className="font-code-sm text-code-sm text-outline shrink-0"
          >
            {relativeActivityTime(event.timestamp, now)}
          </time>
        </div>
        <p
          className={`font-code-sm text-code-sm text-on-surface-variant mt-1 ${display.tone.detail}`}
        >
          {display.detail}
        </p>
      </div>
    </div>
  );
}
