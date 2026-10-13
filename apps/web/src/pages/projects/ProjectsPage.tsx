import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { RegisterProjectSchema, type Project } from "@qelvra/shared";
import {
  ApiError,
  listProjects,
  registerProject,
  refreshProject,
  unregisterProject,
} from "../../lib/api";

const button =
  "rounded-lg px-4 py-2 text-body-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-container-high";
const primary = `${button} bg-primary text-on-primary hover:bg-primary-container`;
const input =
  "mt-2 w-full rounded-lg bg-surface-container-high px-3 py-3 text-on-surface caret-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50";
const errorText = (e: unknown) =>
  e instanceof ApiError
    ? `${e.message}${e.code ? ` (${e.code})` : ""}. Check the repository and retry.`
    : "Could not reach project storage. Reload the list and retry.";

export function ProjectsPage() {
  const [params, setParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const requested = params.get("project");
  const selected = projects.find((p) => p.id === (requested ?? projects[0]?.id));
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setLoading(true);
      setError(null);
      try {
        const result = await listProjects({ signal: controller.signal });
        if (!controller.signal.aborted) setProjects(result.projects);
      } catch (e) {
        if (!controller.signal.aborted) setError(errorText(e));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [revision]);
  const act = async (action: "register" | "refresh" | "unregister") => {
    if (busy || loading) return;
    if (action === "register" && !RegisterProjectSchema.safeParse({ name, path }).success) {
      setError(
        "Supply a display name and an absolute local repository path. Remote URLs and control characters are not supported.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "register") {
        const { project } = await registerProject({ name, path });
        setProjects((p) => [...p, project]);
        setParams({ project: project.id });
        setName("");
        setPath("");
        setNotice("Repository registered. Agents still use their isolated workspaces.");
      } else if (selected && action === "refresh") {
        const { project } = await refreshProject(selected.id);
        setProjects((p) => p.map((v) => (v.id === project.id ? project : v)));
        setNotice(
          project.inspection.state === "available"
            ? "Repository inspection refreshed."
            : "Repository is unavailable. Check its location and supported Git configuration, then refresh.",
        );
      } else if (selected) {
        await unregisterProject(selected.id);
        setProjects((p) => p.filter((v) => v.id !== selected.id));
        setParams({});
        setNotice("Project unregistered. Repository files were preserved.");
      }
      setConfirm(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const inspection = selected?.inspection;
  return (
    <main className="pt-24 pb-12 px-4 md:px-8 max-w-[1600px] mx-auto w-full min-w-0 selection:bg-primary selection:text-on-primary">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-headline-lg font-headline-lg text-on-surface">Projects</h1>
          <p className="mt-2 text-body-md text-on-surface-variant max-w-prose">
            Register local Git repositories and inspect their recorded status. Agents continue to
            work in isolated workspaces.
          </p>
        </div>
        <Link to="/files" className={`${button} text-primary underline underline-offset-4`}>
          Agent files
        </Link>
      </header>
      <section
        aria-label="Register repository"
        className="mt-8 rounded-xl bg-surface-container-low p-5 md:p-6"
      >
        <h2 className="text-headline-sm font-headline-sm">Register repository</h2>
        <p id="project-scope" className="mt-2 text-body-sm text-on-surface-variant max-w-prose">
          Use an existing repository on this server, outside DATA_DIR. Registration and inspection
          do not edit its files. Ordinary .git directories on macOS and Linux are supported; linked
          worktrees and submodule repositories are deferred.
        </p>
        <form
          className="mt-5 grid gap-4 md:grid-cols-[1fr_2fr_auto] items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void act("register");
          }}
        >
          <label className="text-body-sm min-w-0">
            Display name
            <input
              className={input}
              required
              maxLength={120}
              value={name}
              disabled={busy || loading}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-body-sm min-w-0">
            Absolute repository path
            <input
              className={`${input} font-code-md text-code-md`}
              required
              maxLength={4096}
              value={path}
              placeholder="/Users/you/projects/app"
              aria-describedby="project-scope"
              disabled={busy || loading}
              onChange={(e) => setPath(e.target.value)}
            />
          </label>
          <button className={primary} disabled={busy || loading || projects.length >= 100}>
            {busy ? "Working…" : "Register project"}
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="mt-5 text-error break-words">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-5 text-on-surface-variant">
          {notice}
        </p>
      )}
      <div className="mt-8 flex flex-wrap justify-between gap-3 items-center">
        <h2 className="text-headline-sm font-headline-sm">
          Registered projects{" "}
          <span className="text-body-md text-on-surface-variant tabular-nums">
            {projects.length} / 100
          </span>
        </h2>
        <button
          className={`${button} text-primary`}
          disabled={busy || loading}
          onClick={() => setRevision((v) => v + 1)}
        >
          Reload list
        </button>
      </div>
      {loading && (
        <p role="status" className="mt-5">
          Loading projects…
        </p>
      )}
      {!loading && !error && projects.length === 0 && (
        <p className="mt-5 text-on-surface-variant">
          No registered projects. Add an existing local repository above.
        </p>
      )}
      <div className="mt-5 grid lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)] gap-6">
        <nav aria-label="Registered projects" className="min-w-0">
          <ul className="divide-y divide-outline-variant/30">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  disabled={busy || loading}
                  aria-current={selected?.id === p.id ? "true" : undefined}
                  className={`${button} text-left w-full py-4 ${selected?.id === p.id ? "bg-surface-container-high text-primary" : "text-on-surface"}`}
                  onClick={() => {
                    setParams({ project: p.id });
                    setConfirm(false);
                  }}
                >
                  <span className="block font-medium break-words">{p.name}</span>
                  <span className="block mt-1 text-body-sm text-on-surface-variant">
                    {p.inspection.state === "available" ? "Inspection available" : "Unavailable"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {requested && !selected && !loading && (
          <p role="alert" className="text-error">
            The selected project is no longer registered. Select another project.
          </p>
        )}
        {selected && (
          <section
            aria-label="Repository details"
            className="min-w-0 rounded-xl bg-surface-container-low p-5 md:p-6"
          >
            <h3 className="text-headline-md font-headline-md break-words">{selected.name}</h3>
            <p className="mt-3 font-code-md text-code-md text-on-surface-variant break-all">
              {selected.path}
            </p>
            <p className="mt-3 text-body-sm text-on-surface-variant">
              Last inspected:{" "}
              <time dateTime={selected.inspectedAt}>
                {new Date(selected.inspectedAt).toLocaleString()}
              </time>
              . Stored snapshot; refresh to inspect current state.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                className={`${button} text-primary`}
                disabled={busy || loading}
                onClick={() => void act("refresh")}
              >
                Refresh inspection
              </button>
              <button
                className={`${button} text-on-surface-variant`}
                disabled={busy || loading}
                onClick={() => setConfirm(true)}
              >
                Unregister project
              </button>
            </div>
            {confirm && (
              <div className="mt-4 text-body-md">
                <p>Remove this registration? Repository files will stay on disk.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className={`${button} text-error`}
                    disabled={busy}
                    onClick={() => void act("unregister")}
                  >
                    Confirm unregister
                  </button>
                  <button className={button} disabled={busy} onClick={() => setConfirm(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {inspection?.state === "unavailable" && (
              <p role="alert" className="mt-6 text-error break-words">
                Inspection unavailable ({inspection.code}). Check the repository location and Git
                configuration. If it moved or was replaced, unregister and register its new
                location.
              </p>
            )}
            {inspection?.state === "available" && (
              <>
                <dl className="mt-6 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-body-md">
                  <dt className="text-on-surface-variant">HEAD</dt>
                  <dd className="break-all font-code-md text-code-md">
                    {inspection.head.kind === "detached" ? "Detached HEAD" : inspection.head.branch}
                    {inspection.head.kind === "unborn" && " (unborn)"}
                  </dd>
                  <dt className="text-on-surface-variant">Commit</dt>
                  <dd className="break-all font-code-md text-code-md">
                    {inspection.head.commit ?? "No commit yet"}
                  </dd>
                  <dt className="text-on-surface-variant">Tracked changes</dt>
                  <dd className="tabular-nums">
                    {inspection.staged} staged · {inspection.unstaged} unstaged
                  </dd>
                </dl>
                <p className="mt-4 text-body-sm text-on-surface-variant max-w-prose">
                  Untracked files and submodule worktrees are excluded. No commits, checkout, shared
                  agent execution or integration controls are available in this foundation.
                </p>
                <h4 className="mt-7 text-body-md font-medium">Local branches</h4>
                {inspection.branches.length ? (
                  <ul className="mt-3 space-y-2 font-code-md text-code-md text-on-surface-variant">
                    {inspection.branches.map((branch) => (
                      <li className="break-all" key={branch}>
                        {branch}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-on-surface-variant">No local branch commits yet.</p>
                )}
                {inspection.branchesTruncated && (
                  <p className="mt-3 text-on-surface-variant">
                    Showing the first 200 local branches.
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
