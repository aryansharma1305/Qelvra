import { useState } from "react";
import { Link } from "react-router";
import type { NetworkWindow } from "@qelvra/shared";
import { useNetwork } from "../../features/network/useNetwork";
import { NetworkHeader } from "./NetworkHeader";
import { MeshGraph } from "./MeshGraph";
import { NodeTelemetryPanel } from "./NodeTelemetryPanel";
import { IpcTimeline } from "./IpcTimeline";
import { control, panel, utc, warningText } from "./presentation";
export function NetworkPage() {
  const [window, setWindow] = useState<NetworkWindow>("24h");
  const [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, connection, refresh } = useNetwork(window);
  const node = data?.nodes.find((n) => n.id === selected) ?? null;
  return (
    <main className="pt-12 min-h-screen bg-background text-on-surface selection:bg-primary selection:text-on-primary">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-6">
        <NetworkHeader
          window={window}
          onWindow={setWindow}
          refresh={refresh}
          loading={loading}
          data={data}
        />
        <p role="status" className="text-body-sm text-on-surface-variant">
          {loading ? "Loading Network snapshot… " : ""}
          {connection === "live" && !error
            ? "Activity notifications connected."
            : connection === "paused"
              ? "Refresh paused while page is hidden."
              : "Activity notifications disconnected or reconnecting; snapshots refresh periodically while visible."}{" "}
          This view shows retained observations, not live traffic.
        </p>
        {error && (
          <div role="alert" className={panel}>
            <p>
              {data
                ? "Refresh failed. Showing the last known snapshot. "
                : "Network could not be loaded. "}
              {error}
            </p>
            <button className={`${control} mt-3`} onClick={refresh} disabled={loading}>
              Retry
            </button>
          </div>
        )}
        {data && (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
              <MeshGraph data={data} selected={node?.id ?? null} select={setSelected} />
              <NodeTelemetryPanel node={node} />
            </div>
            {!data.nodes.length && (
              <Link to="/agents" className="text-primary hover:underline">
                Open Agents
              </Link>
            )}
            <section className={panel} aria-label="Coverage and recording health">
              <h2 className="text-title-md font-medium">Coverage &amp; recording health</h2>
              <p className="mt-3 text-body-sm">
                {!data.coverage.status.degraded && data.coverage.status.consecutiveFailures === 0
                  ? "Activity recording currently healthy."
                  : "Activity recording reported errors; relationships may be missing."}
              </p>
              <dl className="mt-4 grid sm:grid-cols-3 gap-4 text-body-sm">
                <div>
                  <dt className="text-on-surface-variant">Retained events</dt>
                  <dd className="mt-1 tabular-nums">
                    {data.coverage.retainedEvents} / 10,000 maximum
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Oldest retained (UTC)</dt>
                  <dd className="mt-1 break-words">
                    {data.coverage.oldestRetainedAt ? utc(data.coverage.oldestRetainedAt) : "None"}
                  </dd>
                </div>
                <div>
                  <dt className="text-on-surface-variant">Snapshot observed (UTC)</dt>
                  <dd className="mt-1 break-words">{utc(data.observedAt)}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-2 text-body-sm text-on-surface-variant">
                {data.coverage.warnings.map((w) => (
                  <li key={w}>{warningText[w]}</li>
                ))}
                {Object.entries(data.coverage.truncated)
                  .filter(([, value]) => value)
                  .map(([key]) => (
                    <li key={key}>
                      Display limit reached for {key}; shown records do not include all eligible
                      evidence.
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-body-sm text-on-surface-variant">
                Omitted participant references: {data.coverage.omittedEvidence.unregistered}{" "}
                unregistered, {data.coverage.omittedEvidence.reusedIdentity} predating current
                registration, {data.coverage.omittedEvidence.missingRecipient} without a recipient.
              </p>
              <p className="mt-3 text-body-sm text-on-surface-variant max-w-[75ch]">
                History may be incomplete even when recording is healthy. The journal is capped at
                32 MiB. This is a best-effort snapshot; no mailbox contents are inspected. Empty
                edges do not prove that agents never communicated.
              </p>
              {data.coverage.truncated.nodes && (
                <Link to="/agents" className="inline-block mt-3 text-primary hover:underline">
                  See all registered agents
                </Link>
              )}
            </section>
            <IpcTimeline data={data} />
          </>
        )}
      </div>
    </main>
  );
}
