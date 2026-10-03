import type { Agent, Task } from "@qelvra/shared";
import { assigneeName, taskDate, taskLabelId, TASK_LABEL } from "./presentation";
export function TaskCard({
  task,
  agents,
  selected,
  onSelect,
}: {
  task: Task;
  agents: readonly Agent[];
  selected: boolean;
  onSelect: () => void;
}) {
  const working = task.status === "working";
  const completed = task.status === "completed";
  const assignee = assigneeName(task.assignee, agents);
  return (
    <button
      type="button"
      data-task={task.id}
      data-status={task.status}
      aria-label={`Inspect ${task.title}`}
      aria-pressed={selected}
      onClick={onSelect}
      className={`task-card w-full text-left p-3.5 rounded-lg transition-all relative ${selected ? "bg-surface-container-high border-2 border-secondary/80 shadow-[0_0_16px_rgba(76,215,246,0.18)]" : completed ? "bg-surface-container-low/60 border border-outline-variant/20 opacity-80 hover:opacity-100" : "bg-surface-container-low border border-outline-variant/30 hover:border-outline-variant/80 hover:bg-surface-container"}`}
    >
      {selected && (
        <span className="absolute -top-2.5 right-3 px-2 py-0.5 rounded bg-secondary text-on-secondary font-label-sm text-label-sm font-semibold uppercase tracking-wider shadow-sm">
          Inspecting
        </span>
      )}
      <span className="flex items-center justify-between mb-2 gap-2">
        <span
          className={`font-code-sm text-code-sm ${working ? "text-secondary" : "text-outline"}`}
          title={task.id}
        >
          {taskLabelId(task.id)}
        </span>
        <span
          className={`font-label-sm text-label-sm px-2 py-0.5 rounded uppercase font-medium ${task.status === "failed" ? "bg-error-container/30 text-error" : "bg-surface-container-highest text-outline"}`}
        >
          {TASK_LABEL[task.status]}
        </span>
      </span>
      <h4
        className={`font-body-md text-body-md font-medium text-on-surface leading-snug break-words ${completed ? "line-through decoration-outline" : ""}`}
      >
        {task.title}
      </h4>
      {task.description && (
        <p className="font-body-sm text-body-sm text-outline mt-1.5 line-clamp-2 break-words">
          {task.description}
        </p>
      )}
      {task.assignee && (
        <span className="mt-3 flex items-center justify-between p-2 rounded bg-surface-container-lowest/80 border border-outline-variant/20 gap-2">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center font-code-sm text-[10px] font-bold bg-primary/20 text-primary">
              {assignee.slice(0, 1).toUpperCase()}
            </span>
            <span className="font-body-sm text-body-sm text-on-surface truncate">{assignee}</span>
          </span>
          <span className="font-label-sm text-label-sm text-outline">
            {TASK_LABEL[task.status]}
          </span>
        </span>
      )}
      <span className="mt-3 pt-2.5 border-t border-outline-variant/20 flex items-center justify-between font-label-sm text-label-sm text-outline gap-2">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">schedule</span>
          <time dateTime={task.updatedAt}>Updated {taskDate(task.updatedAt)}</time>
        </span>
        {!task.assignee && (
          <span className="px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-mono">
            Unassigned
          </span>
        )}
      </span>
    </button>
  );
}
