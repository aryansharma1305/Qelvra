import type { NetworkResponse } from "@qelvra/shared";
import { panel, utc } from "./presentation";
export function IpcTimeline({ data }: { data: NetworkResponse }) {
  const names = new Map(data.nodes.map((n) => [n.id, n.name]));
  return (
    <section className={panel} aria-label="Recorded message timeline">
      <h2 className="text-title-md font-medium">Recorded message timeline</h2>
      <p className="mt-2 text-body-sm text-on-surface-variant">
        {data.totals.displayedObservations} / {data.totals.eligibleObservations} eligible
        observations shown, newest first. Lifecycle observations are not distinct-message totals.
        Message bodies are never shown.
      </p>
      {!data.timeline.length ? (
        <p className="mt-4 text-on-surface-variant">
          No eligible message observations retained in this interval.
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-outline-variant/40 text-body-sm">
          {data.timeline.map((e) => (
            <li key={e.id} className="py-3 grid sm:grid-cols-[180px_1fr] gap-2">
              <time dateTime={e.timestamp} className="text-on-surface-variant tabular-nums">
                {utc(e.timestamp)}
              </time>
              <div>
                <p className="font-medium break-words">
                  {names.get(e.from)} → {names.get(e.to)}
                </p>
                <p className="mt-1 text-secondary">
                  {e.type} · {e.messageType ?? "Type not recorded"}
                </p>
                {e.errorCode && <p className="mt-1 text-error">{e.errorCode}</p>}
                <p className="mt-1 text-on-surface-variant break-all font-code-sm text-code-sm">
                  {e.messageId ?? "Message ID not recorded"}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
