import { Link } from "react-router";
import type { NetworkNode } from "@qelvra/shared";
import { messageCounts, panel, provider, utc } from "./presentation";
export function NodeTelemetryPanel({ node }: { node: NetworkNode | null }) {
  return (
    <section className={panel} aria-label="Selected agent details">
      <h2 className="text-title-md font-medium">{node ? node.name : "Agent details"}</h2>
      {!node ? (
        <p className="text-on-surface-variant mt-3">
          Select an agent to inspect its current state and assignments.
        </p>
      ) : (
        <>
          <p className="mt-2 text-on-surface-variant break-words">{node.role}</p>
          <p className="mt-2 font-code-sm text-code-sm break-all">{node.id}</p>
          <Link
            className="inline-block py-3 text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            to={`/agents/${node.id}`}
          >
            Open agent
          </Link>
          <dl className="text-body-sm space-y-3 border-y border-outline-variant/40 py-4">
            <div>
              <dt className="text-on-surface-variant">Registry status</dt>
              <dd className="mt-1">{node.status}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Configured provider</dt>
              <dd className="mt-1 break-words">{provider(node)}</dd>
            </div>
            <div>
              <dt className="text-on-surface-variant">Terminal runtime</dt>
              <dd className="mt-1">
                {node.runtime.present
                  ? `PTY present · ${node.runtime.attached ? "viewer attached" : "no viewer"}`
                  : "No PTY"}
              </dd>
              {node.runtime.startedAt && (
                <dd className="mt-1 break-words">Started {utc(node.runtime.startedAt)}</dd>
              )}
            </div>
          </dl>
          <p className="text-body-sm text-on-surface-variant mt-3">
            A PTY is a shell, not proof of AI execution or provider authentication.
          </p>
          <h3 className="mt-6 font-medium">
            Tasks · {node.tasks.length} / {node.taskTotal} shown
          </h3>
          {!node.tasks.length ? (
            <p className="text-body-sm text-on-surface-variant mt-2">
              No eligible task assignments.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-body-sm">
              {node.tasks.map((t) => (
                <li key={t.id}>
                  <Link to="/tasks" className="text-primary hover:underline break-words">
                    {t.title}
                  </Link>
                  <p className="text-on-surface-variant mt-1">
                    {t.status} · {utc(t.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 font-medium">
            Goals · {node.goals.length} / {node.goalTotal} shown
          </h3>
          {!node.goals.length ? (
            <p className="text-body-sm text-on-surface-variant mt-2">
              No eligible orchestration participation.
            </p>
          ) : (
            <ul className="mt-3 space-y-3 text-body-sm">
              {node.goals.map((g) => (
                <li key={g.id}>
                  <Link to="/tasks?view=goals" className="text-primary hover:underline break-words">
                    {g.title}
                  </Link>
                  <p className="text-on-surface-variant mt-1">
                    {g.participation} · {g.status} · {utc(g.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-6 font-medium">Recorded self-message observations</h3>
          <p className="mt-2 text-body-sm text-on-surface-variant">
            {messageCounts(node.selfMessages)}
          </p>
        </>
      )}
    </section>
  );
}
