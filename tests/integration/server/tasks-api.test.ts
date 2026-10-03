import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { TaskListResponseSchema, TaskResponseSchema, ApiErrorResponseSchema } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
let app: FastifyInstance;
let dir: string;
beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), "qelvra-task-api-"));
  app = await createApp(loadConfig({ DATA_DIR: dir }), { logger: false });
  await app.runtime.create({ name: "Nova", role: "Frontend" });
  await app.runtime.create({ name: "Atlas", role: "Backend" });
});
afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});
const post = (url: string, payload?: unknown) =>
  app.inject({
    method: "POST",
    url,
    ...(payload === undefined
      ? {}
      : { headers: { "content-type": "application/json" }, payload: JSON.stringify(payload) }),
  });
const error = (res: { json(): unknown }) => ApiErrorResponseSchema.parse(res.json()).error;
const task = (res: { json(): unknown }) => TaskResponseSchema.parse(res.json()).task;
const missing = "task-00000000-0000-4000-8000-000000000001";
describe("Tasks REST API", () => {
  it("creates, lists, gets and completes with server-owned state and no agent process", async () => {
    expect(TaskListResponseSchema.parse((await app.inject("/api/tasks")).json()).tasks).toEqual([]);
    const res = await post("/api/tasks", {
      title: "Build login form",
      description: "Validate fields",
      id: missing,
      status: "completed",
      createdBy: "atlas",
    });
    expect(res.statusCode).toBe(201);
    const t = task(res);
    expect(t).toMatchObject({ status: "inbox", assignee: null, createdBy: "user" });
    expect(t.id).not.toBe(missing);
    expect(task(await app.inject(`/api/tasks/${t.id}`))).toEqual(t);
    expect(TaskListResponseSchema.parse((await app.inject("/api/tasks")).json()).tasks).toEqual([
      t,
    ]);
    expect(task(await post(`/api/tasks/${t.id}/assign`, { agentId: "nova" })).status).toBe(
      "assigned",
    );
    for (const [action, status] of [
      ["start", "working"],
      ["review", "review"],
      ["start", "working"],
      ["review", "review"],
      ["complete", "completed"],
    ]) {
      const result = await post(`/api/tasks/${t.id}/${action}`);
      expect(result.statusCode).toBe(200);
      expect(task(result).status).toBe(status);
    }
    expect(app.agents.get("nova")?.status).toBe("stopped");
    expect(app.pty.list()).toHaveLength(0);
    const completed = app.tasks.get(t.id);
    const again = await post(`/api/tasks/${t.id}/complete`);
    expect(again.statusCode).toBe(409);
    expect(error(again).code).toBe("TASK_INVALID_TRANSITION");
    expect(app.tasks.get(t.id)).toEqual(completed);
  });
  it("supports direct assignment and failure without mailbox side effects", async () => {
    const t = task(await post("/api/tasks", { title: "API", assignee: "atlas" }));
    expect(t.status).toBe("assigned");
    expect(task(await post(`/api/tasks/${t.id}/fail`)).status).toBe("failed");
    const mailbox = await app.mailbox.listMessages("atlas", "inbox");
    expect(mailbox).toEqual({ messages: [], invalid: [] });
  });
  it.each([
    [{}, "TASK_INVALID_TITLE"],
    [{ title: " " }, "TASK_INVALID_TITLE"],
    [{ title: 7 }, "TASK_INVALID_TITLE"],
    [{ title: "x".repeat(161) }, "TASK_INVALID_TITLE"],
    [{ title: "bad\0" }, "TASK_INVALID_TITLE"],
    [{ title: "x", description: "\0" }, "TASK_INVALID_DESCRIPTION"],
    [{ title: "x", description: "é".repeat(8193) }, "TASK_INVALID_DESCRIPTION"],
    [{ title: "x", assignee: "../etc" }, "VALIDATION_ERROR"],
    [{ title: "x", assignee: "ghost" }, "TASK_AGENT_NOT_FOUND"],
  ])("rejects invalid create %o", async (body, code) => {
    const res = await post("/api/tasks", body);
    expect(res.statusCode).toBe(400);
    expect(error(res).code).toBe(code);
    expect(app.tasks.list()).toEqual([]);
  });
  it("rejects malformed JSON, unknown IDs and arbitrary mutation endpoints/fields", async () => {
    const bad = await app.inject({
      method: "POST",
      url: "/api/tasks",
      headers: { "content-type": "application/json" },
      payload: "{",
    });
    expect(bad.statusCode).toBe(400);
    expect(error(bad).code).toBe("BAD_REQUEST");
    expect(error(await app.inject("/api/tasks/unsafe")).code).toBe("TASK_INVALID_ID");
    for (const action of ["assign", "start", "review", "complete", "fail"]) {
      const res = await post(
        `/api/tasks/${missing}/${action}`,
        action === "assign" ? { agentId: "nova" } : undefined,
      );
      expect(res.statusCode).toBe(404);
      expect(error(res).code).toBe("TASK_NOT_FOUND");
    }
    expect((await app.inject(`/api/tasks/${missing}`)).statusCode).toBe(404);
    const t = task(await post("/api/tasks", { title: "x" }));
    for (const action of ["assign", "start", "review", "complete", "fail"]) {
      const res = await post(`/api/tasks/${t.id}/${action}`, {
        agentId: "nova",
        status: "completed",
      });
      expect(res.statusCode).toBe(400);
    }
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: `/api/tasks/${t.id}`,
          payload: { status: "completed" },
        })
      ).statusCode,
    ).toBe(404);
    expect((await post(`/api/tasks/${t.id}/assign`, { agentId: "ghost" })).statusCode).toBe(400);
    expect(error(await post(`/api/tasks/${t.id}/start`)).code).toBe("TASK_INVALID_TRANSITION");
    await post(`/api/tasks/${t.id}/assign`, { agentId: "nova" });
    expect(error(await post(`/api/tasks/${t.id}/assign`, { agentId: "atlas" })).code).toBe(
      "TASK_ALREADY_ASSIGNED",
    );
  });
  it("serializes concurrent starts and deletion; reloads all real task content", async () => {
    const t = task(
      await post("/api/tasks", {
        title: "Create API",
        description: "Keep contents",
        assignee: "atlas",
      }),
    );
    const responses = await Promise.all([
      post(`/api/tasks/${t.id}/start`),
      post(`/api/tasks/${t.id}/start`),
    ]);
    expect(responses.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    expect((await app.inject({ method: "DELETE", url: "/api/agents/atlas" })).statusCode).toBe(204);
    expect(app.tasks.get(t.id)).toMatchObject({
      title: t.title,
      description: t.description,
      createdAt: t.createdAt,
      status: "inbox",
      assignee: null,
    });
    const snapshot = app.tasks.list();
    await app.close();
    app = await createApp(loadConfig({ DATA_DIR: dir }), { logger: false });
    expect(app.tasks.list()).toEqual(snapshot);
  });
  it("returns controlled persistence errors without exposing internal paths", async () => {
    vi.spyOn(app.tasks, "create").mockRejectedValueOnce(
      new (await import("../../../apps/server/src/tasks")).TaskError(
        "TASK_PERSISTENCE_FAILED",
        "secret /root/path",
      ),
    );
    const res = await post("/api/tasks", { title: "x" });
    expect(res.statusCode).toBe(500);
    expect(error(res).code).toBe("TASK_PERSISTENCE_FAILED");
    expect(res.body).not.toContain("/root/path");
  });
  it("refuses startup with corrupt tasks and does not overwrite the snapshot", async () => {
    await app.close();
    const file = join(dir, "tasks.json");
    writeFileSync(file, "corrupt");
    await expect(createApp(loadConfig({ DATA_DIR: dir }), { logger: false })).rejects.toThrow(
      "corrupt",
    );
    expect(readFileSync(file, "utf8")).toBe("corrupt");
  });
});
