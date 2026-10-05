import { useEffect, useSyncExternalStore } from "react";
import type { CreateTaskRequest, Task } from "@qelvra/shared";
import {
  assignTask,
  completeTask,
  createTask,
  failTask,
  getTask,
  listTasks,
  reviewTask,
  startTask,
  type TaskAction,
} from "../../lib/api";
interface State {
  tasks: readonly Task[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  pending: Readonly<Record<string, boolean>>;
}
const INITIAL: State = { tasks: [], status: "idle", error: null, pending: {} };
let state: State = INITIAL;
let request: AbortController | null = null;
const listeners = new Set<() => void>();
const publish = (next: State) => {
  state = next;
  for (const listener of listeners) listener();
};
const message = (error: unknown) =>
  error instanceof Error ? error.message : "Could not update tasks";
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function upsert(task: Task) {
  request?.abort();
  publish({
    ...state,
    status: "ready",
    error: null,
    tasks: [...state.tasks.filter((item) => item.id !== task.id), task].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
    ),
  });
}
export async function refreshTasks() {
  request?.abort();
  const controller = new AbortController();
  request = controller;
  publish({ ...state, status: "loading", error: null });
  try {
    const tasks = await listTasks({ signal: controller.signal });
    if (!controller.signal.aborted) publish({ ...state, tasks, status: "ready", error: null });
  } catch (error) {
    if (!controller.signal.aborted) publish({ ...state, status: "error", error: message(error) });
  }
}
export async function createTaskInStore(input: CreateTaskRequest) {
  const task = await createTask(input);
  upsert(task);
  return task;
}
export async function reloadTask(id: string) {
  upsert(await getTask(id));
}
export async function updateTask(id: string, action: TaskAction | "assign", agentId?: string) {
  if (state.pending[id]) return;
  publish({ ...state, pending: { ...state.pending, [id]: true } });
  try {
    const task =
      action === "assign"
        ? await assignTask(id, agentId ?? "")
        : await { start: startTask, review: reviewTask, complete: completeTask, fail: failTask }[
            action
          ](id);
    upsert(task);
  } catch (error) {
    try {
      upsert(await getTask(id));
    } catch {
      /* Keep the current board when offline. */
    }
    throw error;
  } finally {
    publish({
      ...state,
      pending: Object.fromEntries(Object.entries(state.pending).filter(([key]) => key !== id)),
    });
  }
}
export function useTasks() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.status === "idle") void refreshTasks();
  }, []);
  return snapshot;
}
export function resetTasksStoreForTests() {
  request?.abort();
  request = null;
  state = INITIAL;
}
