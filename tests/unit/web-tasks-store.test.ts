import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  refreshTasks,
  createTaskInStore,
  updateTask,
  resetTasksStoreForTests,
} from "../../apps/web/src/features/tasks/tasks-store";
import * as api from "../../apps/web/src/lib/api";
vi.mock("../../apps/web/src/lib/api", () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  assignTask: vi.fn(),
  startTask: vi.fn(),
  reviewTask: vi.fn(),
  completeTask: vi.fn(),
  failTask: vi.fn(),
  getTask: vi.fn(),
}));
const task = {
  id: "task-00000000-0000-4000-8000-000000000001",
  title: "Login",
  description: "",
  status: "inbox" as const,
  assignee: null,
  createdBy: "user" as const,
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};
beforeEach(() => {
  resetTasksStoreForTests();
  vi.resetAllMocks();
});
describe("Task store request coordination", () => {
  it("deduplicates in-flight lifecycle requests", async () => {
    let release!: (value: typeof task) => void;
    vi.mocked(api.startTask).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = updateTask(task.id, "start");
    await updateTask(task.id, "start");
    expect(api.startTask).toHaveBeenCalledTimes(1);
    release(task);
    await first;
    vi.mocked(api.startTask).mockResolvedValue(task);
    await updateTask(task.id, "start");
    expect(api.startTask).toHaveBeenCalledTimes(2);
  });
  it("aborts stale list responses after a successful mutation", async () => {
    let signal: AbortSignal | undefined;
    let resolve!: (value: (typeof task)[]) => void;
    vi.mocked(api.listTasks).mockImplementation((options) => {
      signal = options?.signal;
      return new Promise((r) => {
        resolve = r;
      });
    });
    const refresh = refreshTasks();
    vi.mocked(api.createTask).mockResolvedValue(task);
    expect(await createTaskInStore({ title: "Login" })).toEqual(task);
    expect(signal?.aborted).toBe(true);
    resolve([]);
    await refresh;
  });
  it("refreshes stale task data after a rejected transition and releases pending controls", async () => {
    const error = new Error("Conflict");
    vi.mocked(api.startTask).mockRejectedValueOnce(error);
    vi.mocked(api.getTask).mockResolvedValue(task);
    await expect(updateTask(task.id, "start")).rejects.toBe(error);
    expect(api.getTask).toHaveBeenCalledWith(task.id);
    vi.mocked(api.startTask).mockResolvedValue(task);
    await updateTask(task.id, "start");
    expect(api.startTask).toHaveBeenCalledTimes(2);
  });
});
