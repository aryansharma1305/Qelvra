import { describe, expect, it, vi } from "vitest";
import {
  listTasks,
  getTask,
  createTask,
  assignTask,
  startTask,
  reviewTask,
  completeTask,
  failTask,
  DEFAULT_API_URL,
} from "../../apps/web/src/lib/api";
const task = {
  id: "task-00000000-0000-4000-8000-000000000001",
  title: "Login",
  description: "",
  status: "inbox",
  assignee: null,
  createdBy: "user",
  createdAt: "2026-10-04T00:00:00.000Z",
  updatedAt: "2026-10-04T00:00:00.000Z",
};
const respond = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }));
describe("Task API client", () => {
  it("validates list and individual envelopes", async () => {
    await expect(listTasks({ fetchImpl: respond({ tasks: [task] }) })).resolves.toEqual([task]);
    await expect(getTask(task.id, { fetchImpl: respond({ task }) })).resolves.toEqual(task);
    for (const invalid of [
      { tasks: [{ ...task, status: "hacking" }] },
      { tasks: [{ ...task, id: "../path" }] },
      { tasks: [{ ...task, status: "working", assignee: null }] },
      [task],
    ])
      await expect(listTasks({ fetchImpl: respond(invalid) })).rejects.toMatchObject({
        kind: "invalid_response",
      });
  });
  it("whitelists creation fields", async () => {
    const fetchImpl = respond({ task }, 201);
    await createTask({ ...task, title: "Login", assignee: null }, { fetchImpl });
    expect(fetchImpl.mock.calls[0]).toBeDefined();
    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_API_URL}/api/tasks`,
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Login", description: "", assignee: null }),
      }),
    );
  });
  it.each([
    ["start", startTask],
    ["review", reviewTask],
    ["complete", completeTask],
    ["fail", failTask],
  ] as const)("%s sends an explicit action with no fields", async (action, call) => {
    const fetchImpl = respond({ task: { ...task, status: "assigned", assignee: "nova" } });
    await call(task.id, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_API_URL}/api/tasks/${task.id}/${action}`,
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("assigns using a real agent ID and preserves controlled server errors", async () => {
    const fetchImpl = respond({ task: { ...task, status: "assigned", assignee: "nova" } });
    await assignTask(task.id, "nova", { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith(
      `${DEFAULT_API_URL}/api/tasks/${task.id}/assign`,
      expect.objectContaining({ body: JSON.stringify({ agentId: "nova" }) }),
    );
    await expect(
      startTask(task.id, {
        fetchImpl: respond(
          { error: { code: "TASK_INVALID_TRANSITION", message: "Cannot start" } },
          409,
        ),
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: "TASK_INVALID_TRANSITION",
      message: "Cannot start",
    });
    await expect(
      getTask(task.id, { fetchImpl: respond({ task: { ...task, createdBy: "hacker" } }) }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });
});
