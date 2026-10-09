import type { NetworkResponse, NetworkWindow } from "@qelvra/shared";
import { baseControl, control, utc } from "./presentation";
export function NetworkHeader({
  window,
  onWindow,
  refresh,
  loading,
  data,
}: {
  window: NetworkWindow;
  onWindow: (value: NetworkWindow) => void;
  refresh: () => void;
  loading: boolean;
  data: NetworkResponse | null;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div>
        <h1 className="text-headline-lg font-semibold tracking-tight">Agent Network</h1>
        <p className="mt-2 text-body-md text-on-surface-variant max-w-[75ch]">
          Registered agents, recorded message activity and persisted orchestration participation.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-2 text-body-sm">
          Recent history window
          <select
            className={control}
            value={window}
            onChange={(e) => onWindow(e.target.value as NetworkWindow)}
          >
            <option value="1h">Last hour</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>
        </label>
        <button
          className={`${baseControl} bg-primary text-on-primary hover:bg-primary-container`}
          disabled={loading}
          onClick={refresh}
        >
          {loading ? "Refreshing…" : "Refresh"}
        </button>
        {data && (
          <p className="text-body-sm text-on-surface-variant py-2">
            Agents: {data.totals.displayedNodes} shown / {data.totals.eligibleNodes} registered ·
            Relationships: {data.totals.displayedEdges} shown / {data.totals.eligibleEdges} eligible
          </p>
        )}
      </div>
      {data && (
        <p className="text-body-sm text-on-surface-variant break-words" data-testid="network-range">
          Loaded {utc(data.range.from)} to {utc(data.range.to)} (end excluded). Current tasks and
          goals remain visible regardless of age; terminal history uses this interval.
        </p>
      )}
    </header>
  );
}
