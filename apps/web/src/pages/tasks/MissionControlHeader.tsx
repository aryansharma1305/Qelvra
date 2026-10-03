import type { Task, TaskStatus } from "@qelvra/shared";
import { TASK_LABEL } from "./presentation";
// Ported from the Stitch export (agent_hive_mission_control/code.html). Keep visually identical to the design.

export function MissionControlHeader({
  tasks,
  filter,
  onFilter,
  onCreate,
  onRefresh,
}: {
  tasks: readonly Task[];
  filter: "all" | TaskStatus;
  onFilter: (filter: "all" | TaskStatus) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  const count = (status: TaskStatus) => tasks.filter((task) => task.status === status).length;
  const completed = count("completed");
  const active = count("assigned") + count("working") + count("review");
  return (
    <div className="px-6 py-5 border-b border-outline-variant/20 bg-surface-container-lowest/80 backdrop-blur-md">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight font-semibold">
              Mission Control
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-label-sm text-label-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {tasks.length} Tasks
            </span>
            <span className="font-code-sm text-code-sm text-outline flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">alt_route</span>
              {count("failed")} Failed
            </span>
          </div>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Track tasks and assignments across your AI team.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center bg-surface-container-low p-1 rounded border border-outline-variant/30">
            <button
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-surface-container-high text-primary font-body-sm text-body-sm font-medium shadow-sm transition-all"
              id="btn-kanban"
            >
              <span className="material-symbols-outlined text-[16px]">view_kanban</span>
              <span>Kanban</span>
            </button>
            <button
              disabled
              title="This view is not available yet"
              className="flex items-center gap-1.5 px-3 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-body-sm text-body-sm"
            >
              <span className="material-symbols-outlined text-[16px]">view_stream</span>
              <span>List</span>
            </button>
            <button
              disabled
              title="This view is not available yet"
              className="flex items-center gap-1.5 px-3 py-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all font-body-sm text-body-sm"
            >
              <span className="material-symbols-outlined text-[16px]">account_tree</span>
              <span>DAG</span>
            </button>
          </div>
          <div className="h-6 w-px bg-outline-variant/30 hidden sm:block" />
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low border border-outline-variant/30 font-body-sm text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px]">filter_list</span>
            <select
              aria-label="Filter tasks"
              value={filter}
              onChange={(event) => onFilter(event.target.value as "all" | TaskStatus)}
              className="bg-transparent text-on-surface"
            >
              <option value="all">All tasks</option>
              {Object.entries(TASK_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onRefresh}
            aria-label="Refresh tasks"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-secondary border border-secondary/20 hover:border-secondary/40 font-code-sm text-code-sm transition-all"
          >
            <span className="material-symbols-outlined text-[16px] text-secondary">refresh</span>
            <span>Refresh</span>
          </button>
          <button
            onClick={onCreate}
            aria-label="Create Task"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded bg-primary-container text-on-primary font-body-sm text-body-sm font-semibold hover:bg-primary shadow-[0_0_16px_rgba(160,120,255,0.35)] transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            <span>Create Task</span>
            <kbd className="font-label-sm text-label-sm px-1.5 py-0.2 rounded bg-black/25 text-white/90">
              ⌘N
            </kbd>
          </button>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-3 lg:col-span-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <div className="flex items-center justify-between text-outline font-label-sm text-label-sm uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[15px] text-primary">
                donut_large
              </span>
              Task Completion
            </span>
            <span className="font-code-sm text-code-sm text-primary font-semibold">
              {completed} / {tasks.length} Completed
            </span>
          </div>
          <div className="mt-2.5">
            <div className="w-full h-2 rounded-full bg-surface-container-highest overflow-hidden flex">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary-container to-secondary transition-all duration-700"
                style={{ width: `${tasks.length ? (completed / tasks.length) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-between font-label-sm text-label-sm text-outline mt-1.5">
              <span>{count("inbox")} Inbox</span>
              <span>{count("review")} Review</span>
            </div>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Active Tasks</span>
            <span className="material-symbols-outlined text-[15px] text-secondary">
              pending_actions
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {active}
            </span>
            <span className="font-label-sm text-label-sm text-secondary">
              {count("working")} working
            </span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Review</span>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary" />
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-secondary font-semibold">
              {count("review")}
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">
              {count("assigned")} assigned
            </span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Completed</span>
            <span className="material-symbols-outlined text-[15px] text-tertiary">
              check_circle
            </span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-tertiary font-semibold">
              {completed}
            </span>
            <span className="font-label-sm text-label-sm text-tertiary-fixed">
              of {tasks.length} tasks
            </span>
          </div>
        </div>
        <div className="p-3 rounded-lg bg-surface-container-low border border-outline-variant/30 flex flex-col justify-between">
          <span className="text-outline font-label-sm text-label-sm uppercase tracking-wider flex items-center justify-between">
            <span>Failed</span>
            <span className="material-symbols-outlined text-[15px] text-primary">bolt</span>
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-headline-md text-headline-md text-on-surface font-semibold">
              {count("failed")}
            </span>
            <span className="font-label-sm text-label-sm text-outline">read-only</span>
          </div>
        </div>
      </div>
    </div>
  );
}
