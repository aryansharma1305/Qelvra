import type { Agent, Task, TaskStatus } from "@qelvra/shared";
import { TaskCard } from "./TaskCards";
import { TASK_LABEL } from "./presentation";
const COLUMNS: readonly TaskStatus[] = ["inbox", "assigned", "working", "review", "completed"];
const DOT: Record<TaskStatus, string> = {
  inbox: "bg-outline",
  assigned: "bg-primary/70",
  working: "bg-secondary",
  review: "bg-amber-400",
  completed: "bg-tertiary",
  failed: "bg-error",
};
export function KanbanBoard({
  tasks,
  agents,
  selectedId,
  filter,
  onSelect,
  onCreate,
}: {
  tasks: readonly Task[];
  agents: readonly Agent[];
  selectedId: string | null;
  filter: "all" | TaskStatus;
  onSelect: (task: Task) => void;
  onCreate: () => void;
}) {
  const columns: readonly TaskStatus[] =
    filter === "all"
      ? tasks.some((task) => task.status === "failed")
        ? [...COLUMNS, "failed"]
        : COLUMNS
      : [filter];
  return (
    <div
      className="flex-1 min-w-0 overflow-x-auto p-6 transition-all duration-300"
      id="kanban-canvas"
    >
      <div className="flex items-start gap-4 min-w-[1240px]">
        {columns.map((status) => {
          const items = tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              data-task-column={status}
              aria-label={`${TASK_LABEL[status]} tasks`}
              className={`w-80 flex-shrink-0 flex flex-col rounded-xl border max-h-[calc(100vh-16rem)] ${status === "working" ? "bg-surface-container-lowest/70 border-secondary/30 shadow-[0_0_24px_rgba(76,215,246,0.06)]" : "bg-surface-container-lowest/60 border-outline-variant/20"}`}
            >
              <div
                className={`p-3 border-b border-outline-variant/20 flex items-center justify-between rounded-t-xl ${status === "working" ? "bg-surface-container-low/80" : "bg-surface-container-low/50"}`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${DOT[status]}`} />
                  <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
                    {TASK_LABEL[status]}
                  </span>
                  <span
                    className={`font-label-sm text-label-sm px-2 py-0.5 rounded-full border ${status === "working" ? "bg-secondary/15 text-secondary border-secondary/30 font-semibold" : status === "review" ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : status === "completed" ? "bg-tertiary/15 text-tertiary border-tertiary/30" : "bg-surface-container-high text-on-surface-variant border-outline-variant/30"}`}
                  >
                    {items.length}
                  </span>
                </div>
                {status === "inbox" || status === "assigned" ? (
                  <button
                    type="button"
                    aria-label={`Create task in ${TASK_LABEL[status]}`}
                    title="Quick Add"
                    onClick={onCreate}
                    className="p-1 hover:bg-surface-container-high rounded text-outline hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>
                ) : status === "completed" ? (
                  <span className="material-symbols-outlined text-[16px] text-tertiary">
                    done_all
                  </span>
                ) : (
                  <span
                    className={`font-label-sm text-label-sm uppercase tracking-wider font-mono ${status === "working" ? "text-secondary" : "text-outline"}`}
                  >
                    {status === "working"
                      ? "Task state"
                      : status === "review"
                        ? "Sign-off"
                        : "Read-only"}
                  </span>
                )}
              </div>
              <div className="p-3 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    agents={agents}
                    selected={task.id === selectedId}
                    onSelect={() => onSelect(task)}
                  />
                ))}
                {items.length === 0 && (
                  <p className="font-body-sm text-body-sm text-outline py-3">
                    No {status === "inbox" ? "unassigned" : status} tasks
                  </p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
