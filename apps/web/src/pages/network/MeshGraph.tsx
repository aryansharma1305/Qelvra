import { useId, useState } from "react";
import type { NetworkResponse, NetworkNode } from "@qelvra/shared";
import { control, edgeText, provider } from "./presentation";

export function MeshGraph({
  data,
  selected,
  select,
}: {
  data: NetworkResponse;
  selected: string | null;
  select: (id: string) => void;
}) {
  const [list, setList] = useState(false);
  const marker = useId().replace(/:/g, "");
  const names = new Map(data.nodes.map((n) => [n.id, n.name]));
  const positions = new Map(
    data.nodes.map((n, i) => [n.id, { x: 40 + (i % 3) * 300, y: 30 + Math.floor(i / 3) * 160 }]),
  );
  const position = (id: string) => {
    const value = positions.get(id);
    if (!value) throw new Error("Missing Network node position");
    return value;
  };
  const height = Math.max(360, Math.ceil(data.nodes.length / 3) * 160 + 40);
  const nodeButton = (n: NetworkNode, graph = false) => (
    <button
      key={n.id}
      aria-label={`Inspect ${n.name}`}
      aria-pressed={selected === n.id}
      onClick={() => select(n.id)}
      className={`text-left p-3 rounded-lg border focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 hover:bg-surface-container-high ${selected === n.id ? "border-primary bg-surface-container-high" : "border-outline-variant bg-surface-container"} ${graph ? "absolute min-h-[104px]" : "w-full"}`}
      style={
        graph
          ? {
              left: `${(position(n.id).x / 940) * 100}%`,
              top: position(n.id).y,
              width: `${(240 / 940) * 100}%`,
            }
          : undefined
      }
    >
      <span className="block font-semibold text-body-lg truncate">{n.name}</span>
      <span className="block text-body-sm text-on-surface-variant truncate">{n.role}</span>
      <span className="block text-body-sm mt-2">
        {n.status} · {n.runtime.present ? "PTY present" : "No PTY"}
      </span>
      <span className="block text-body-sm text-on-surface-variant truncate">{provider(n)}</span>
    </button>
  );
  return (
    <section
      aria-label="Agent relationships"
      className="min-w-0 bg-surface-container-lowest rounded-xl border border-outline-variant/40 overflow-hidden"
    >
      <div className="p-4 flex flex-wrap gap-3 items-center border-b border-outline-variant/40">
        <h2 className="text-title-md font-medium mr-auto">Agent relationships</h2>
        <div className="hidden md:flex gap-2" aria-label="Network view">
          <button className={control} aria-pressed={!list} onClick={() => setList(false)}>
            Graph
          </button>
          <button className={control} aria-pressed={list} onClick={() => setList(true)}>
            List
          </button>
        </div>
        <p className="w-full text-body-sm text-on-surface-variant">
          <span className="text-secondary">Solid arrow: recorded messages</span> ·{" "}
          <span className="text-primary">Dashed line: orchestration participation</span>
        </p>
      </div>
      {!data.nodes.length ? (
        <div className="p-6">
          <p>No registered agents yet.</p>
          <p className="mt-2 text-on-surface-variant">
            Create an agent from the Agents page to inspect its relationships.
          </p>
        </div>
      ) : (
        <>
          <div
            className={list ? "hidden" : "hidden md:block max-h-[520px] overflow-auto"}
            tabIndex={0}
            aria-label="Scrollable relationship graph"
          >
            <div className="relative min-w-[640px] w-full" style={{ height }}>
              <svg
                width="100%"
                viewBox={`0 0 940 ${height}`}
                preserveAspectRatio="none"
                height={height}
                className="absolute inset-0"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id={marker}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="5"
                    orient="auto"
                  >
                    <path d="M0 0 L10 5 L0 10 Z" fill="currentColor" className="text-secondary" />
                  </marker>
                </defs>
                {data.edges.map((e) => {
                  const a = position(e.from),
                    b = position(e.to);
                  // Connections join ports outside the node labels. Opposite directions curve apart.
                  const bend = e.kind === "message" ? 65 : -65;
                  const x1 = a.x + 120,
                    y1 = a.y + 110,
                    x2 = b.x + 120,
                    y2 = b.y - 6;
                  return (
                    <path
                      key={`${e.kind}:${e.from}:${e.to}`}
                      d={`M${x1},${y1} C${x1 + bend},${y1 + 35} ${x2 + bend},${y2 - 35} ${x2},${y2}`}
                      fill="none"
                      stroke="currentColor"
                      className={e.kind === "message" ? "text-secondary" : "text-primary"}
                      data-network-edge={e.kind}
                      strokeWidth="2"
                      strokeDasharray={e.kind === "orchestration" ? "6 5" : undefined}
                      markerEnd={e.kind === "message" ? `url(#${marker})` : undefined}
                    />
                  );
                })}
              </svg>
              {data.nodes.map((n) => nodeButton(n, true))}
            </div>
          </div>
          <div
            className={`${list ? "block" : "md:hidden"} p-4 grid sm:grid-cols-2 gap-3 max-h-[520px] overflow-auto`}
          >
            {data.nodes.map((n) => nodeButton(n))}
          </div>
          <div className="p-4 border-t border-outline-variant/40">
            <h3 className="font-medium text-body-md">Relationship evidence</h3>
            {!data.edges.length ? (
              <p className="mt-2 text-body-sm text-on-surface-variant">
                No eligible relationship evidence retained for this view. Isolated agents remain
                visible.
              </p>
            ) : (
              <ul
                className="mt-3 space-y-3 text-body-sm max-h-64 overflow-y-auto"
                aria-label="Relationship evidence list"
              >
                {data.edges.map((e) => (
                  <li key={`${e.kind}:${e.from}:${e.to}`}>
                    <p className={e.kind === "message" ? "text-secondary" : "text-primary"}>
                      {edgeText(e, names)}
                    </p>
                    {e.kind === "orchestration" && (
                      <p className="text-on-surface-variant mt-1 break-all">
                        Persisted membership, not traffic. {e.references.length} /{" "}
                        {e.referenceTotal} task references shown:{" "}
                        {e.references.map((r) => `${r.goalId} / ${r.taskId}`).join("; ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
