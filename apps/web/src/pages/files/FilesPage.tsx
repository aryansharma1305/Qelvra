import { useEffect, useRef, useState } from "react";
import { Link, useBlocker, useSearchParams } from "react-router";
import {
  WORKSPACE_TEXT_LIMIT,
  isWorkspacePath,
  type WorkspaceEntry,
  type WorkspaceFile,
  type WorkspaceListing,
} from "@qelvra/shared";
import { refreshAgents, useAgents } from "../../features/agents/agents-store";
import {
  ApiError,
  listWorkspaceFiles,
  statWorkspaceEntry,
  readWorkspaceFile,
  writeWorkspaceFile,
  createWorkspaceFile,
  createWorkspaceDirectory,
  moveWorkspaceEntry,
  deleteWorkspaceEntry,
} from "../../lib/api";
const buttonBase =
  "rounded-lg px-3 py-2 text-body-sm font-body-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50 disabled:cursor-not-allowed";
const button = `${buttonBase} text-on-surface-variant hover:bg-surface-container-high`;
const primaryButton = `${buttonBase} bg-primary text-on-primary hover:bg-primary-container`;
const size = (bytes: number) =>
  bytes < 1024
    ? `${bytes} B`
    : bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(1)} KiB`
      : `${(bytes / 1024 / 1024).toFixed(1)} MiB`;
const message = (error: unknown) =>
  error instanceof ApiError
    ? `${error.message}${error.code ? ` (${error.code})` : ""}`
    : "Could not complete this operation. Refresh and try again.";
const parent = (path: string) => (path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "");
export function FilesPage() {
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const agentId = params.get("agent") ?? agents.agents[0]?.id ?? "";
  const agent = agents.agents.find((a) => a.id === agentId);
  const knownAgentId = agent?.id ?? "";
  const bypassNavigation = useRef(false);
  const path = params.get("path") ?? "";
  const selectedPath = params.get("file") ?? "";
  const [listing, setListing] = useState<WorkspaceListing | null>(null);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [entry, setEntry] = useState<WorkspaceEntry | null>(null);
  const [file, setFile] = useState<WorkspaceFile | null>(null);
  const [content, setContent] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const [directoryRefresh, setDirectoryRefresh] = useState(0);
  const [fileRefresh, setFileRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    action: "file" | "directory" | "rename";
    entry?: WorkspaceEntry;
  } | null>(null);
  const [name, setName] = useState("");
  const dirty = Boolean(file && content !== file.content);
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (bypassNavigation.current) {
      bypassNavigation.current = false;
      return false;
    }
    if (
      busy &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
    ) {
      window.alert("Wait for the file operation to finish before navigating.");
      return true;
    }
    return (
      dirty &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search) &&
      !window.confirm("Discard unsaved changes? Your edits have not been saved.")
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
    if (!knownAgentId) return;
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setDirectoryLoading(true);
      setListing(null);
      setDirectoryError(null);
      setForm(null);
      try {
        const result = await listWorkspaceFiles(knownAgentId, path, { signal: controller.signal });
        if (!controller.signal.aborted) setListing(result);
      } catch (error) {
        if (!controller.signal.aborted) setDirectoryError(message(error));
      } finally {
        if (!controller.signal.aborted) setDirectoryLoading(false);
      }
    });
    return () => controller.abort();
  }, [knownAgentId, path, directoryRefresh]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setEntry(null);
      setFile(null);
      setContent("");
      setFileError(null);
      setNotice(null);
      setOperationError(null);
      if (!knownAgentId || !selectedPath) {
        setFileLoading(false);
        return;
      }
      setFileLoading(true);
      try {
        const metadata = await statWorkspaceEntry(knownAgentId, selectedPath, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setEntry(metadata);
        if (metadata.type !== "file") {
          setFileError(
            "This entry cannot be opened. Symlinks, hard links and special files are not supported.",
          );
          return;
        }
        if (metadata.size > WORKSPACE_TEXT_LIMIT) {
          setFileError("File is too large to open in the editor. The limit is 1 MiB.");
          return;
        }
        const result = await readWorkspaceFile(knownAgentId, selectedPath, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setFile(result);
          setContent(result.content);
        }
      } catch (error) {
        if (!controller.signal.aborted) setFileError(message(error));
      } finally {
        if (!controller.signal.aborted) setFileLoading(false);
      }
    });
    return () => controller.abort();
  }, [knownAgentId, selectedPath, fileRefresh]);
  const navigate = (nextPath: string, nextFile?: string, nextAgent = agentId) => {
    setParams({
      agent: nextAgent,
      ...(nextPath ? { path: nextPath } : {}),
      ...(nextFile ? { file: nextFile } : {}),
    });
  };
  const save = async () => {
    if (!file || busy || !dirty) return;
    const edits = content;
    setBusy(true);
    setOperationError(null);
    setNotice(null);
    try {
      const saved = await writeWorkspaceFile(agentId, {
        path: file.path,
        content: edits,
        revision: file.revision,
      });
      setFile(saved);
      setEntry({
        name: saved.path.split("/").at(-1) ?? "",
        path: saved.path,
        type: "file",
        size: saved.size,
        modifiedAt: saved.modifiedAt,
      });
      setNotice("Saved.");
      setDirectoryRefresh((value) => value + 1);
    } catch (error) {
      setOperationError(message(error));
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
  const submit = async () => {
    if (!form || busy) return;
    const destination = path ? `${path}/${name}` : name;
    if (!isWorkspacePath(destination) || (form.action === "rename" && name.includes("/"))) {
      setOperationError(
        "Use a relative name without dot segments, encoded separators or backslashes.",
      );
      return;
    }
    if (dirty && !window.confirm("Discard unsaved changes before changing workspace entries?"))
      return;
    setBusy(true);
    setOperationError(null);
    setNotice(null);
    try {
      const created =
        form.action === "rename" && form.entry
          ? await moveWorkspaceEntry(agentId, form.entry.path, destination)
          : form.action === "directory"
            ? await createWorkspaceDirectory(agentId, destination)
            : await createWorkspaceFile(agentId, destination);
      setFile(null);
      setForm(null);
      setName("");
      setDirectoryRefresh((value) => value + 1);
      bypassNavigation.current = true;
      navigate(path, created.type === "file" ? created.path : undefined);
    } catch (error) {
      setOperationError(message(error));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (target: WorkspaceEntry) => {
    if (busy || (dirty && !window.confirm("Discard unsaved changes before deleting?"))) return;
    if (
      !window.confirm(
        target.type === "directory"
          ? `Delete folder "${target.name}" and its contents? This cannot be undone.`
          : `Delete file "${target.name}"? This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setOperationError(null);
    setNotice(null);
    try {
      await deleteWorkspaceEntry(agentId, target.path, target.type === "directory");
      if (selectedPath === target.path || selectedPath.startsWith(target.path + "/")) {
        setFile(null);
        bypassNavigation.current = true;
        navigate(path);
      }
      setDirectoryRefresh((value) => value + 1);
      setNotice("Deleted.");
    } catch (error) {
      setOperationError(message(error));
    } finally {
      setBusy(false);
    }
  };
  const startForm = (action: "file" | "directory" | "rename", target?: WorkspaceEntry) => {
    setForm({ action, ...(target ? { entry: target } : {}) });
    setName(target?.name ?? "");
    setOperationError(null);
  };
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full select-text">
      <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Files</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">
          Browse and edit files in an agent’s isolated workspace.
        </p>
        <div className="mt-6 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-2 min-w-0 w-full sm:w-80 text-body-sm text-on-surface-variant">
            Agent workspace
            <select
              className="bg-surface-container-high text-on-surface rounded-lg px-3 py-2 w-full focus-visible:outline-primary"
              value={agentId}
              disabled={busy || !agents.agents.length}
              onChange={(event) => navigate("", undefined, event.target.value)}
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
          <button
            className={button}
            disabled={busy || directoryLoading || !agent}
            onClick={() => {
              setDirectoryRefresh((v) => v + 1);
              void refreshAgents();
            }}
          >
            Refresh
          </button>
          <span className="text-body-sm text-outline pb-2">UTF-8 editor · 1 MiB limit</span>
        </div>
        {agents.error && (
          <div role="alert" className="mt-4 text-error">
            {agents.error}{" "}
            <button className={button} onClick={() => void refreshAgents()}>
              Retry agents
            </button>
          </div>
        )}
        {(agents.status === "idle" || agents.status === "loading") && !agents.agents.length && (
          <p role="status" className="mt-6">
            Loading agents…
          </p>
        )}
        {agents.status === "ready" && !agents.agents.length && (
          <div className="py-12">
            <h2 className="text-headline-sm font-headline-sm">No agents yet</h2>
            <p className="mt-2 text-on-surface-variant">
              Create an agent to get an isolated workspace.
            </p>
            <Link className="inline-block mt-4 text-primary underline" to="/agents/new">
              Create Agent
            </Link>
          </div>
        )}
        {agents.status === "ready" && agents.agents.length > 0 && !agent && (
          <p role="alert" className="mt-4 text-error">
            The selected agent no longer exists. Choose another workspace.
          </p>
        )}
        {agent && (
          <>
            <nav
              aria-label="Workspace breadcrumbs"
              className="mt-6 flex flex-wrap items-center gap-1 min-w-0 text-body-sm"
            >
              <button className={button} disabled={busy} onClick={() => navigate("")}>
                workspace
              </button>
              {path
                .split("/")
                .filter(Boolean)
                .map((part, index, parts) => (
                  <span key={index} className="flex min-w-0 items-center">
                    <span className="text-outline" aria-hidden="true">
                      /
                    </span>
                    <button
                      className={`${button} break-all`}
                      disabled={busy}
                      onClick={() => navigate(parts.slice(0, index + 1).join("/"))}
                    >
                      {part}
                    </button>
                  </span>
                ))}
            </nav>
            {operationError && (
              <p role="alert" className="mt-3 text-body-sm text-error break-words">
                {operationError}
              </p>
            )}
            {notice && (
              <p role="status" className="mt-3 text-body-sm text-tertiary">
                {notice}
              </p>
            )}
            <div className="mt-4 grid min-w-0 grid-cols-1 xl:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] rounded-xl border border-outline-variant/30 bg-surface-container-low overflow-hidden">
              <section
                aria-label="Workspace directory"
                className="min-w-0 border-b xl:border-b-0 xl:border-r border-outline-variant/30"
              >
                <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/30 px-3 py-2">
                  <button
                    className={button}
                    disabled={busy || directoryLoading || Boolean(directoryError)}
                    onClick={() => startForm("file")}
                  >
                    New File
                  </button>
                  <button
                    className={button}
                    disabled={busy || directoryLoading || Boolean(directoryError)}
                    onClick={() => startForm("directory")}
                  >
                    New Folder
                  </button>
                  {listing?.parentPath !== null && path && (
                    <button
                      className={`${button} ml-auto`}
                      disabled={busy}
                      onClick={() => navigate(parent(path))}
                    >
                      Up
                    </button>
                  )}
                </div>
                {form && (
                  <form
                    aria-label={
                      form.action === "rename"
                        ? "Rename entry"
                        : form.action === "directory"
                          ? "New folder"
                          : "New file"
                    }
                    className="p-4 border-b border-outline-variant/30"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                  >
                    <label className="block text-body-sm">
                      {form.action === "rename" ? "New name" : "Name"}
                      <input
                        autoFocus
                        className="mt-2 block w-full rounded-lg bg-surface-container-high p-2 text-on-surface focus-visible:outline-primary"
                        value={name}
                        disabled={busy}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </label>
                    <p className="mt-2 text-body-sm text-on-surface-variant">
                      Relative to this folder. Parent folders must exist.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button className={primaryButton} disabled={busy || !name}>
                        {form.action === "rename" ? "Rename" : "Create"}
                      </button>
                      <button
                        type="button"
                        className={button}
                        disabled={busy}
                        onClick={() => setForm(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {directoryLoading && (
                  <p role="status" className="p-4 text-on-surface-variant">
                    Loading directory…
                  </p>
                )}
                {directoryError && (
                  <p role="alert" className="p-4 text-error break-words">
                    {directoryError}
                  </p>
                )}
                {listing && (
                  <>
                    <p className="px-4 py-3 text-body-sm text-outline">
                      {listing.entries.length} entries
                      {listing.hiddenEntries
                        ? ` · ${listing.hiddenEntries} unsafe or temporary names hidden`
                        : ""}
                    </p>
                    {!listing.entries.length && (
                      <p className="px-4 pb-8 text-on-surface-variant">
                        This folder is empty. Create a file or folder to begin.
                      </p>
                    )}
                    <ul className="max-h-[55vh] xl:max-h-[65vh] overflow-y-auto">
                      {listing.entries.map((item) => (
                        <li
                          key={item.path}
                          className={`group flex items-center gap-1 pl-2 pr-1 py-1 ${selectedPath === item.path ? "bg-primary/10" : "hover:bg-surface-container"}`}
                        >
                          <button
                            className={`${button} flex min-w-0 flex-1 items-center gap-2 text-left`}
                            disabled={busy}
                            aria-label={`Open ${item.name}`}
                            onClick={() =>
                              item.type === "directory"
                                ? navigate(item.path)
                                : navigate(path, item.path)
                            }
                          >
                            <span
                              className="material-symbols-outlined shrink-0 text-[20px] text-secondary"
                              aria-hidden="true"
                            >
                              {item.type === "directory"
                                ? "folder"
                                : item.type === "unsupported"
                                  ? "block"
                                  : "description"}
                            </span>
                            <span className="truncate">{item.name}</span>
                            <span className="sr-only">{item.type}</span>
                          </button>
                          {item.type !== "unsupported" && (
                            <>
                              <button
                                className={`${button} px-2`}
                                aria-label={`Rename ${item.name}`}
                                disabled={busy}
                                onClick={() => startForm("rename", item)}
                              >
                                <span
                                  className="material-symbols-outlined text-[18px]"
                                  aria-hidden="true"
                                >
                                  edit
                                </span>
                              </button>
                              <button
                                className={`${buttonBase} px-2 text-error hover:bg-error/10`}
                                aria-label={`Delete ${item.name}`}
                                disabled={busy}
                                onClick={() => void remove(item)}
                              >
                                <span
                                  className="material-symbols-outlined text-[18px]"
                                  aria-hidden="true"
                                >
                                  delete
                                </span>
                              </button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </section>
              <section aria-label="File editor" className="min-w-0 flex flex-col min-h-[400px]">
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-outline-variant/30">
                  <h2 className="min-w-0 w-full xl:w-auto xl:flex-1 break-all font-label-md text-label-md">
                    {selectedPath || "Select a file"}
                  </h2>
                  {dirty && (
                    <span className="text-body-sm text-primary" role="status">
                      Unsaved changes
                    </span>
                  )}
                  {selectedPath && (
                    <button
                      className={button}
                      disabled={busy || fileLoading}
                      onClick={() => {
                        if (
                          !dirty ||
                          window.confirm("Discard unsaved changes and reload this file?")
                        )
                          setFileRefresh((value) => value + 1);
                      }}
                    >
                      Reload file
                    </button>
                  )}
                  <button
                    className={primaryButton}
                    disabled={busy || !file || !dirty}
                    onClick={() => void save()}
                  >
                    {busy ? "Please wait…" : "Save"}
                  </button>
                </div>
                {entry && (
                  <p className="px-4 py-3 text-body-sm text-on-surface-variant tabular-nums">
                    {entry.type} · {size(entry.size)} · Modified{" "}
                    {new Date(entry.modifiedAt).toLocaleString()}
                  </p>
                )}
                {fileLoading && (
                  <p role="status" className="p-6 text-on-surface-variant">
                    Opening file…
                  </p>
                )}
                {fileError && (
                  <p role="alert" className="p-6 text-on-surface-variant break-words">
                    {fileError}
                  </p>
                )}
                {file && (
                  <textarea
                    aria-label="File content"
                    spellCheck={false}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    className="min-h-[400px] xl:min-h-[55vh] flex-1 w-full resize-y rounded-none bg-surface-container-lowest p-4 font-code-sm text-body-sm leading-relaxed text-on-surface caret-primary selection:bg-primary/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  />
                )}
                {!selectedPath && (
                  <div className="m-auto p-8 max-w-md text-center">
                    <span
                      className="material-symbols-outlined text-secondary text-[32px]"
                      aria-hidden="true"
                    >
                      description
                    </span>
                    <h3 className="mt-4 font-headline-sm text-headline-sm">
                      Your agent’s workspace
                    </h3>
                    <p className="mt-2 text-on-surface-variant">
                      Choose a file to read or edit. Agent-generated files appear here after
                      Refresh.
                    </p>
                    <p className="mt-3 text-body-sm text-outline">
                      Changes save directly to this agent’s files.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
