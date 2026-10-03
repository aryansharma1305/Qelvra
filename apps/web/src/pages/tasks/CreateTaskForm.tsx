import { useEffect, useRef, useState } from "react";
import { CreateTaskRequestSchema, type Agent } from "@qelvra/shared";
import { createTaskInStore } from "../../features/tasks/tasks-store";
export function CreateTaskForm({
  agents,
  agentsError,
  onClose,
  onRetryAgents,
}: {
  agents: readonly Agent[];
  agentsError: string | null;
  onClose: () => void;
  onRetryAgents: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const submitting = useRef(false);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    setError(null);
    const parsed = CreateTaskRequestSchema.safeParse({
      title,
      description,
      assignee: assignee || null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check task fields");
      return;
    }
    submitting.current = true;
    setBusy(true);
    try {
      await createTaskInStore(parsed.data);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not create task");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      role="dialog"
      aria-labelledby="create-task-title"
      className="w-[480px] max-w-full lg:max-w-[calc(100vw-14rem)] flex-shrink-0 border-l border-outline-variant/30 bg-surface-container-lowest p-5 fixed right-0 top-12 bottom-0 z-50 lg:z-30 lg:static overflow-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 id="create-task-title" className="font-headline-md text-headline-md text-on-surface">
          Create Task
        </h2>
        <button
          type="button"
          aria-label="Close task form"
          onClick={onClose}
          className="p-1 text-outline"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="flex flex-col gap-4"
        aria-busy={busy}
      >
        <label className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface">
          Title
          <input
            ref={input}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            disabled={busy}
            className="p-2 rounded bg-surface-container-low border border-outline-variant/30"
          />
        </label>
        <label className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface">
          Description
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            maxLength={16384}
            rows={6}
            disabled={busy}
            className="p-2 rounded bg-surface-container-low border border-outline-variant/30 resize-y"
          />
        </label>
        <label className="flex flex-col gap-2 font-body-sm text-body-sm text-on-surface">
          Assignee (optional)
          <select
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
            disabled={busy}
            className="p-2 rounded bg-surface-container-low border border-outline-variant/30"
          >
            <option value="">Unassigned</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
        {agentsError && (
          <div role="alert" className="text-error font-body-sm text-body-sm">
            {agentsError}
            <button type="button" onClick={onRetryAgents} className="ml-2 underline">
              Retry agents
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-error font-body-sm text-body-sm">
            {error}
          </p>
        )}
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-2 rounded border border-outline-variant/30 text-on-surface"
          >
            Cancel
          </button>
          <button
            disabled={busy}
            type="submit"
            className="px-4 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm font-semibold disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </section>
  );
}
