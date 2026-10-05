import { useEffect, useRef, useState } from "react";
import type { Task, TaskStatus } from "@qelvra/shared";
import { useSearchParams } from "react-router";
import { refreshAgents, useAgents } from "../../features/agents/agents-store";
import { refreshTasks, useTasks } from "../../features/tasks/tasks-store";
import { KanbanBoard } from "./KanbanBoard";
import { MissionControlHeader } from "./MissionControlHeader";
import { TaskInspector } from "./TaskInspector";
import { GoalPanel } from "./GoalPanel";
import { CreateTaskForm } from "./CreateTaskForm";
export function TasksPage() {
  const { tasks, status, error, pending } = useTasks();
  const agents = useAgents();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("task");
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const trigger = useRef<HTMLElement | null>(null);
  const selected = tasks.find((task) => task.id === selectedId);
  const close = () => {
    setCreating(false);
    setParams({}, { replace: true });
    trigger.current?.focus();
  };
  const create = () => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setParams({}, { replace: true });
    setCreating(true);
  };
  const select = (task: Task) => {
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setCreating(false);
    setParams(task.id === selectedId ? {} : { task: task.id }, { replace: true });
  };
  useEffect(() => {
    void refreshTasks();
    void refreshAgents();
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCreating(false);
        setParams({}, { replace: true });
        trigger.current?.focus();
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        trigger.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        setCreating(true);
        setParams({}, { replace: true });
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [setParams]);
  return (
    <main className="relative pt-12 min-h-screen bg-background w-full overflow-x-hidden">
      <div className="flex flex-col w-full">
        <MissionControlHeader
          tasks={tasks}
          goalsActive={params.get("view") === "goals"}
          onKanban={() => setParams({})}
          onGoals={() => {
            setCreating(false);
            setParams({ view: "goals" });
          }}
          filter={filter}
          onFilter={setFilter}
          onCreate={create}
          onRefresh={() => {
            void refreshTasks();
            void refreshAgents();
          }}
        />
        {(status === "idle" || status === "loading") && (
          <p role="status" className="px-6 py-3 font-body-sm text-body-sm text-outline">
            Loading tasks…
          </p>
        )}
        {error && (
          <div role="alert" className="px-6 py-3 font-body-sm text-body-sm text-error">
            {error}
            <button
              onClick={() => {
                void refreshTasks();
              }}
              className="ml-3 underline"
            >
              Retry
            </button>
          </div>
        )}
        {status === "ready" && tasks.length === 0 && (
          <div className="px-6 pt-6 text-on-surface">
            <h2 className="font-headline-md text-headline-md">No tasks yet</h2>
            <p className="font-body-sm text-body-sm text-outline mt-2">
              Create a task, then assign it to an agent when ready.
            </p>
            <button
              onClick={create}
              className="mt-3 px-3 py-2 rounded bg-primary text-on-primary font-body-sm text-body-sm"
            >
              Create your first task
            </button>
          </div>
        )}
        {params.get("view") === "goals" ? (
          <GoalPanel
            agents={agents.agents}
            tasks={tasks}
            selectedId={params.get("goal")}
            onSelect={(id) => setParams({ view: "goals", goal: id }, { replace: true })}
            onClose={() => setParams({})}
          />
        ) : (
          <div className="flex flex-1 min-h-[calc(100vh-14rem)] overflow-hidden">
            <KanbanBoard
              tasks={tasks}
              agents={agents.agents}
              selectedId={selectedId}
              filter={filter}
              onSelect={select}
              onCreate={create}
            />
            {creating ? (
              <CreateTaskForm
                agents={agents.agents}
                agentsError={agents.error}
                onRetryAgents={() => {
                  void refreshAgents();
                }}
                onClose={close}
              />
            ) : (
              selected && (
                <TaskInspector
                  key={selected.id}
                  task={selected}
                  agents={agents.agents}
                  agentsError={agents.error}
                  onRetryAgents={() => {
                    void refreshAgents();
                  }}
                  busy={Boolean(pending[selected.id])}
                  onClose={close}
                />
              )
            )}
          </div>
        )}
      </div>
    </main>
  );
}
