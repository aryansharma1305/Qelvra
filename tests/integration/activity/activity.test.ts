import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityListResponseSchema, ActivityStreamMessageSchema } from "@qelvra/shared";
import WebSocket from "ws";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { ActivityError } from "../../../apps/server/src/activity";
let dir: string;
let app: Awaited<ReturnType<typeof createApp>>;
const sockets = new Set<WebSocket>();
const events = async () => {
  await app.activity.flush();
  return app.activity.store.listEvents({ limit: 100 }).events.reverse();
};
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-activity-flow-"));
  app = await createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" }), {
    logger: false,
  });
  await app.ready();
});
afterEach(async () => {
  for (const socket of sockets) socket.terminate();
  sockets.clear();
  await app.close();
  expect(app.pty.size).toBe(0);
  await rm(dir, { recursive: true, force: true });
});
describe("real activity ownership and transport", () => {
  it("records unexpected runtime failure once with a safe error code", async () => {
    await app.runtime.create({ name: "Nova", role: "Demo", providerId: "fake" });
    await app.runtime.start("nova");
    const pid = app.runtime.get("nova")?.pid;
    if (!pid) throw new Error("Missing demo process");
    process.kill(pid, "SIGKILL");
    await expect.poll(() => app.agents.get("nova")?.status).toBe("error");
    const errors = (await events()).filter((event) => event.type === "agent.error");
    expect(errors).toHaveLength(1);
    expect(errors[0]?.metadata).toMatchObject({ errorCode: "AGENT_RUNTIME_ERROR" });
  });
  it("returns supported dashboard counts from current domains and retained event history", async () => {
    await app.runtime.create({ name: "Nova", role: "Frontend" });
    await app.runtime.start("nova");
    const completed = await app.tasks.create({ title: "Finished", assignee: "nova" });
    await app.tasks.start(completed.id);
    await app.tasks.review(completed.id);
    await app.tasks.complete(completed.id);
    const working = await app.tasks.create({ title: "Working", assignee: "nova" });
    await app.tasks.start(working.id);
    expect((await app.inject("/api/activity/summary")).json()).toEqual({
      activeAgents: 1,
      completedToday: 1,
      workingTasks: 1,
      recordedDeliveriesToday: 0,
    });
  });
  it("records committed agent lifecycle exactly once, including idempotent stops and restart", async () => {
    await app.runtime.create({ name: "Nova", role: "Frontend" });
    await app.runtime.start("nova");
    await app.runtime.stop("nova");
    await app.runtime.stop("nova");
    await app.runtime.restart("nova");
    await app.runtime.delete("nova");
    expect((await events()).filter((e) => e.type.startsWith("agent.")).map((e) => e.type)).toEqual([
      "agent.created",
      "agent.started",
      "agent.stopped",
      "agent.started",
      "agent.restarted",
      "agent.stopped",
      "agent.deleted",
    ]);
  });
  it("records the ordered task flow and returns active work to inbox on agent deletion", async () => {
    await app.runtime.create({ name: "Nova", role: "Frontend" });
    const task = await app.tasks.create({
      title: "Build login form",
      description: "PRIVATE_DESCRIPTION",
    });
    await app.tasks.assign(task.id, "nova");
    await app.tasks.start(task.id);
    await app.tasks.review(task.id);
    await app.tasks.complete(task.id);
    expect((await events()).filter((e) => e.entity?.id === task.id).map((e) => e.type)).toEqual([
      "task.created",
      "task.assigned",
      "task.started",
      "task.review_requested",
      "task.completed",
    ]);
    await expect(app.tasks.complete(task.id)).rejects.toThrow();
    const orphan = await app.tasks.create({ title: "Return this", assignee: "nova" });
    await app.runtime.delete("nova");
    expect((await events()).filter((e) => e.entity?.id === orphan.id).map((e) => e.type)).toEqual([
      "task.created",
      "task.assigned",
      "task.returned_to_inbox",
    ]);
    expect(await readFile(join(dir, "events.jsonl"), "utf8")).not.toContain("PRIVATE_DESCRIPTION");
  });
  it("routes queued/delivered once despite duplicate filesystem callbacks; quarantines safely", async () => {
    for (const name of ["Nova", "Atlas"]) await app.runtime.create({ name, role: "Test" });
    const message = await app.mailbox.writeOutboxMessage("nova", {
      to: "atlas",
      type: "message",
      body: "PRIVATE_BODY_APIKEY",
    });
    await Promise.all(
      Array.from({ length: 20 }, () => app.router.processEntry("nova", `${message.id}.json`)),
    );
    await app.router.rescan();
    expect((await events()).filter((e) => e.entity?.id === message.id).map((e) => e.type)).toEqual([
      "message.queued",
      "message.delivered",
    ]);
    const id = "msg-00000000-0000-4000-8000-000000000001";
    await writeFile(
      join(await app.workspaces.getMailboxPath("nova", "outbox"), `${id}.json`),
      "PRIVATE_MALFORMED_BODY",
    );
    await app.router.processEntry("nova", `${id}.json`);
    expect((await events()).filter((e) => e.entity?.id === id).map((e) => e.type)).toEqual([
      "message.delivery_failed",
      "message.quarantined",
    ]);
    const text = await readFile(join(dir, "events.jsonl"), "utf8");
    expect(text).not.toContain("PRIVATE_BODY_APIKEY");
    expect(text).not.toContain("PRIVATE_MALFORMED_BODY");
  });
  it("keeps successful domain mutations when logging fails and exposes degraded status", async () => {
    vi.spyOn(app.activity.store, "append").mockRejectedValue(
      new ActivityError("ACTIVITY_WRITE_FAILED"),
    );
    await app.runtime.create({ name: "Nova", role: "Test" });
    const task = await app.tasks.create({ title: "Successful task" });
    await app.tasks.assign(task.id, "nova");
    await app.tasks.start(task.id);
    const response = await app.inject("/api/activity");
    expect(response.statusCode).toBe(200);
    expect(ActivityListResponseSchema.parse(response.json()).status).toMatchObject({
      degraded: true,
      consecutiveFailures: 4,
    });
    expect(app.tasks.get(task.id)?.status).toBe("working");
    await app.runtime.create({ name: "Atlas", role: "Backend" });
    const message = await app.mailbox.writeOutboxMessage("nova", {
      to: "atlas",
      type: "message",
      body: "PRIVATE_DURING_ACTIVITY_FAILURE",
    });
    await app.router.processEntry("nova", `${message.id}.json`);
    expect((await app.mailbox.listMessages("atlas", "inbox")).messages).toEqual([message]);
    expect((await app.mailbox.listMessages("nova", "outbox")).messages).toEqual([]);
  });
  it("validates REST filters/cursors, denies browser event creation and retains restart history", async () => {
    await app.runtime.create({ name: "Nova", role: "Test" });
    const task = await app.tasks.create({ title: "Persisted", assignee: "nova" });
    const first = ActivityListResponseSchema.parse(
      (await app.inject("/api/activity?limit=2")).json(),
    );
    expect(first.events).toHaveLength(2);
    expect(first.nextCursor).not.toBeNull();
    const page = ActivityListResponseSchema.parse(
      (await app.inject(`/api/activity?cursor=${first.nextCursor}&limit=2`)).json(),
    );
    expect(page.events.every((e) => !first.events.some((a) => a.id === e.id))).toBe(true);
    expect(
      ActivityListResponseSchema.parse((await app.inject(`/api/activity?taskId=${task.id}`)).json())
        .events,
    ).toHaveLength(2);
    for (const query of [
      "limit=0",
      "limit=101",
      "limit=1.5",
      "type=terminal.output",
      "cursor=no",
      "agentId=../root",
      "taskId=no",
      "body=secret",
      "limit=2&limit=3",
    ])
      expect((await app.inject(`/api/activity?${query}`)).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/activity",
          payload: { type: "agent.created" },
        })
      ).statusCode,
    ).toBe(404);
    await app.close();
    app = await createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir }), { logger: false });
    expect(app.activity.store.listEvents({ taskId: task.id }).events).toHaveLength(2);
  });
  it("streams validated events, rejects unknown origins/client messages and closes at shutdown", async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    if (!address || typeof address === "string") throw new Error("Missing port");
    const url = `ws://127.0.0.1:${address.port}/ws/activity`;
    for (const origin of [undefined, "http://evil.example"]) {
      const rejected = new WebSocket(url, origin ? { origin } : {});
      sockets.add(rejected);
      await new Promise<void>((resolve, reject) => {
        rejected.once("unexpected-response", (_req, res) => {
          expect(res.statusCode).toBe(403);
          res.resume();
          rejected.terminate();
          resolve();
        });
        rejected.once("open", () => reject(new Error("Origin admitted")));
        rejected.on("error", () => undefined);
      });
    }
    const socket = new WebSocket(url, { origin: "http://127.0.0.1:5173" });
    sockets.add(socket);
    const received: unknown[] = [];
    socket.on("message", (data) =>
      received.push(ActivityStreamMessageSchema.parse(JSON.parse(data.toString()))),
    );
    await new Promise<void>((resolve) => socket.once("open", resolve));
    await app.runtime.create({ name: "Nova", role: "Test" });
    await expect
      .poll(() => received.some((frame) => (frame as { type: string }).type === "activity.event"))
      .toBe(true);
    const closed = new Promise<number>((resolve) => socket.once("close", resolve));
    socket.send("PRIVATE_TERMINAL_INPUT");
    expect(await closed).toBe(1008);
    const remaining = new WebSocket(url, { origin: "http://127.0.0.1:5173" });
    sockets.add(remaining);
    await new Promise<void>((resolve) => remaining.once("open", resolve));
    const shutdown = new Promise<number>((resolve) => remaining.once("close", resolve));
    await app.close();
    await shutdown;
    expect(remaining.readyState).toBe(WebSocket.CLOSED);
  });
  it(
    "records real fake-agent PTY round trips but never terminal lines or message content",
    { timeout: 15000 },
    async () => {
      for (const name of ["Nova", "Atlas"]) {
        await app.runtime.create({ name, role: "Demo", providerId: "fake" });
        await app.runtime.start(name.toLowerCase());
      }
      let output = "";
      const terminal = app.runtime.attach("nova", {
        onData: (data) => {
          output += data;
        },
        onExit: () => undefined,
        onReplaced: () => undefined,
      });
      terminal.write("STATUS\r");
      await expect.poll(() => output.includes("READY nova"), { timeout: 10000 }).toBe(true);
      terminal.write("SEND atlas PRIVATE_FAKE_MESSAGE\r");
      await expect.poll(() => app.router.status().delivered, { timeout: 10000 }).toBe(2);
      const snapshot = await events();
      expect(snapshot.filter((e) => e.type === "agent.started")).toHaveLength(2);
      expect(snapshot.filter((e) => e.type === "message.queued")).toHaveLength(2);
      expect(snapshot.filter((e) => e.type === "message.delivered")).toHaveLength(2);
      terminal.write("ECHO PRIVATE_TERMINAL_LINE\r");
      await expect.poll(() => output.includes("PRIVATE_TERMINAL_LINE")).toBe(true);
      terminal.detach();
      expect((await events()).length).toBe(snapshot.length);
      const text = await readFile(join(dir, "events.jsonl"), "utf8");
      expect(text).not.toContain("PRIVATE_FAKE_MESSAGE");
      expect(text).not.toContain("PRIVATE_TERMINAL_LINE");
    },
  );
});
