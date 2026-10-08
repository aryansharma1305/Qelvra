import { useEffect, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router";
import { AGENT_MEMORY_LIMIT, type AgentMemory } from "@qelvra/shared";
import { refreshAgents, useAgents } from "../../features/agents/agents-store";
import { ApiError, getAgentMemory, updateAgentMemory } from "../../lib/api";
const base =
  "rounded-lg px-3 py-2 text-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
const button = `${base} text-on-surface-variant hover:bg-surface-container-high`;
const errorMessage = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message} (${error.code ?? error.kind})`
    : "Could not access memory. Reload and try again.";

export function MemoryPage() {
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const agentId = params.get("agent") ?? agents.agents[0]?.id ?? "";
  const agent = agents.agents.find((item) => item.id === agentId);
  const knownAgentId = agent?.id ?? "";
  const [memory, setMemory] = useState<AgentMemory | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = Boolean(memory && content !== memory.content);
  const bytes = new TextEncoder().encode(content).length;
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (
      currentLocation.pathname === nextLocation.pathname &&
      currentLocation.search === nextLocation.search
    )
      return false;
    if (busy) {
      window.alert("Wait for memory to finish saving before navigating.");
      return true;
    }
    return (
      dirty && !window.confirm("Discard unsaved memory changes? Your notes have not been saved.")
    );
  });
  useEffect(() => {
    if (blocker.state === "blocked") blocker.reset();
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setMemory(null);
      setContent("");
      setLoadError(null);
      setSaveError(null);
      setConflict(false);
      setSaved(false);
      if (!knownAgentId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const result = await getAgentMemory(knownAgentId, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setMemory(result);
          setContent(result.content);
        }
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    });
    return () => controller.abort();
  }, [knownAgentId, refresh]);
  const reload = () => {
    if (!dirty || window.confirm("Discard unsaved changes and reload agent memory?"))
      setRefresh((value) => value + 1);
  };
  const save = async () => {
    if (!memory || busy || !dirty || bytes > AGENT_MEMORY_LIMIT) return;
    setBusy(true);
    setSaveError(null);
    setConflict(false);
    setSaved(false);
    try {
      const result = await updateAgentMemory(agentId, content, memory.revision);
      setMemory(result);
      setSaved(true);
    } catch (error) {
      setSaveError(errorMessage(error));
      setConflict(error instanceof ApiError && error.code === "MEMORY_CHANGED_ON_DISK");
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  });
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full select-text">
      <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Memory</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Read and edit persistent Markdown notes for an agent.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-2 min-w-0 w-full sm:w-80 text-body-sm text-on-surface-variant">
            Agent memory
            <select
              aria-label="Agent memory"
              value={agentId}
              disabled={busy || !agents.agents.length}
              onChange={(event) => setParams({ agent: event.target.value })}
              className="bg-surface-container-high text-on-surface rounded-lg px-3 py-2 w-full focus-visible:outline-primary"
            >
              {!agent && (
                <option value={agentId}>{agentId ? "Agent unavailable" : "Select an agent"}</option>
              )}
              {agents.agents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} — {item.role}
                </option>
              ))}
            </select>
          </label>
          <span className="text-body-sm text-outline pb-2">
            Markdown · 256 KiB limit · Cmd/Ctrl+S to save
          </span>
        </div>
        {agents.error && (
          <p role="alert" className="mt-4 text-error">
            {agents.error}{" "}
            <button className={button} onClick={() => void refreshAgents()}>
              Retry agents
            </button>
          </p>
        )}
        {!agents.agents.length && (agents.status === "idle" || agents.status === "loading") && (
          <p role="status" className="mt-8 text-on-surface-variant">
            Loading agents…
          </p>
        )}
        {!agents.agents.length && agents.status === "ready" && (
          <div className="mt-8">
            <h2 className="font-headline-sm text-headline-sm">No agents yet</h2>
            <p className="mt-2 text-on-surface-variant">
              Create an agent to keep persistent notes.
            </p>
            <Link
              className="inline-block mt-4 text-primary underline underline-offset-4"
              to="/agents/new"
            >
              Create Agent
            </Link>
          </div>
        )}
        {agentId && !agent && agents.status === "ready" && (
          <p role="alert" className="mt-8 text-error">
            This agent is unavailable. Choose another agent.
          </p>
        )}
        {agent && (
          <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_280px] gap-6">
            <section
              aria-label="Agent memory editor"
              className="min-w-0 rounded-xl border border-outline-variant/30 bg-surface-container-low overflow-hidden"
            >
              <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-outline-variant/30">
                <h2 className="w-full xl:w-auto xl:flex-1 font-label-md text-label-md">
                  memory.md
                </h2>
                <span role="status" className="text-body-sm text-on-surface-variant">
                  {busy
                    ? "Saving…"
                    : dirty
                      ? "Unsaved changes"
                      : saved
                        ? "Saved."
                        : memory
                          ? "Up to date"
                          : ""}
                </span>
                <button className={button} disabled={busy || loading} onClick={reload}>
                  Reload memory
                </button>
                <button
                  className={`${base} bg-primary text-on-primary hover:bg-primary-container`}
                  disabled={busy || !memory || !dirty || bytes > AGENT_MEMORY_LIMIT}
                  onClick={() => void save()}
                >
                  Save
                </button>
              </div>
              {loading && (
                <p role="status" className="p-6 text-on-surface-variant">
                  Loading memory…
                </p>
              )}
              {loadError && (
                <p role="alert" className="p-6 text-error">
                  {loadError} Your existing memory has not been replaced.
                </p>
              )}
              {saveError && (
                <div role="alert" className="p-4 text-error">
                  <p>{saveError}</p>
                  {conflict && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className={button} onClick={reload}>
                        Reload changed memory
                      </button>
                      <button
                        className={button}
                        onClick={() => {
                          setConflict(false);
                          setSaveError(null);
                        }}
                      >
                        Keep editing
                      </button>
                    </div>
                  )}
                </div>
              )}
              {memory && (
                <>
                  <textarea
                    aria-label="Agent memory content"
                    spellCheck={false}
                    value={content}
                    onChange={(event) => {
                      setContent(event.target.value);
                      setSaved(false);
                    }}
                    className="min-h-[400px] xl:min-h-[55vh] w-full resize-y bg-surface-container-lowest p-4 font-code-sm text-body-sm leading-relaxed text-on-surface caret-primary selection:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  />
                  <p className="px-4 py-3 text-body-sm text-on-surface-variant tabular-nums">
                    {Array.from(content).length.toLocaleString()} characters ·{" "}
                    {bytes.toLocaleString()} / {AGENT_MEMORY_LIMIT.toLocaleString()} bytes
                  </p>
                  {bytes > AGENT_MEMORY_LIMIT && (
                    <p role="alert" className="px-4 pb-4 text-error">
                      Memory exceeds the 256 KiB limit. Shorten the notes before saving.
                    </p>
                  )}
                </>
              )}
            </section>
            <aside
              aria-label="Memory information"
              className="min-w-0 text-body-sm text-on-surface-variant"
            >
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Persistent notes
              </h2>
              <p className="mt-3 break-all font-label-md text-label-md">{`hive/agents/${agentId}/memory.md`}</p>
              {memory && (
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-outline">Modified</dt>
                    <dd>{new Date(memory.modifiedAt).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt className="text-outline">Saved size</dt>
                    <dd>{memory.size.toLocaleString()} bytes</dd>
                  </div>
                </dl>
              )}
              <p className="mt-6">
                Notes persist across restarts. Saving updates this agent’s Markdown file only.
              </p>
              <p className="mt-3">
                These notes are not automatically sent to an AI provider or added to task prompts.
              </p>
              <h3 className="mt-6 font-body-md text-on-surface">Future memory</h3>
              <p className="mt-2">Semantic/vector memory is planned for a future release.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
