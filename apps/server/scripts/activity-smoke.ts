import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket from "ws";
import {
  ActivityEventSchema,
  ActivityListResponseSchema,
  ActivityStreamMessageSchema,
  type ActivityEvent,
} from "@qelvra/shared";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
const dir = await mkdtemp(join(tmpdir(), "qelvra-activity-smoke-"));
const config = loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" });
let app = await createApp(config, { logger: false });
let socket: WebSocket | null = null;
const seen: ActivityEvent[] = [];
const pids: number[] = [];
async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, "Timed out waiting for activity demo");
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
try {
  await app.listen({ port: 0, host: "127.0.0.1" });
  const address = app.server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  socket = new WebSocket(`${base.replace("http:", "ws:")}/ws/activity`, {
    origin: config.webOrigins[0],
  });
  socket.on("message", (raw) => {
    const frame = ActivityStreamMessageSchema.parse(JSON.parse(raw.toString()));
    if (frame.type === "activity.event") seen.push(frame.event);
  });
  await new Promise<void>((resolve, reject) => {
    socket?.once("open", resolve);
    socket?.once("error", reject);
  });
  for (const name of ["Nova", "Atlas"]) {
    await app.runtime.create({ name, role: "Demo", providerId: "fake" });
    await app.runtime.start(name.toLowerCase());
    const pid = app.runtime.get(name.toLowerCase())?.pid;
    if (pid) pids.push(pid);
  }
  const task = await app.tasks.create({
    title: "Build login form",
    description: "PRIVATE_DEMO_DESCRIPTION",
  });
  await app.tasks.assign(task.id, "nova");
  let output = "";
  const terminal = app.runtime.attach("nova", {
    onData: (data) => {
      output += data;
    },
    onExit: () => undefined,
    onReplaced: () => undefined,
  });
  terminal.write("STATUS\r");
  await until(() => output.includes("READY nova"));
  terminal.write("SEND atlas PRIVATE_DEMO_BODY\r");
  await until(() => app.router.status().delivered === 2);
  await app.tasks.start(task.id);
  await app.tasks.review(task.id);
  await app.tasks.complete(task.id);
  await app.activity.flush();
  await until(() => seen.some((event) => event.type === "task.completed"));
  const snapshot = ActivityListResponseSchema.parse(
    await (await fetch(`${base}/api/activity?limit=100`)).json(),
  );
  assert.ok(
    snapshot.events.some(
      (event) => event.entity?.id === task.id && event.type === "task.completed",
    ),
  );
  assert.equal(snapshot.events.filter((event) => event.type === "message.delivered").length, 2);
  assert.deepEqual(await (await fetch(`${base}/api/activity/summary`)).json(), {
    activeAgents: 2,
    completedToday: 1,
    workingTasks: 0,
    recordedDeliveriesToday: 2,
  });
  terminal.detach();
  socket.terminate();
  socket = null;
  await app.close();
  const before = (await readFile(join(dir, "events.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => ActivityEventSchema.parse(JSON.parse(line)));
  assert.equal(new Set(before.map((event) => event.id)).size, before.length);
  assert.ok(!JSON.stringify(before).includes("PRIVATE_DEMO"));
  app = await createApp(config, { logger: false });
  await app.ready();
  const after = app.activity.store.listEvents({ limit: 100 }).events;
  for (const event of before) assert.ok(after.some((item) => item.id === event.id));
  assert.equal(app.pty.size, 0);
  const check = async (root: string): Promise<void> => {
    for (const entry of await readdir(root, { withFileTypes: true })) {
      assert.ok(!entry.name.startsWith(".tmp-") && !entry.name.endsWith(".tmp"));
      if (entry.isDirectory()) await check(join(root, entry.name));
    }
  };
  await check(dir);
  console.log(
    `PASS: ${before.length} persisted events; ${seen.length} live events; Nova/Atlas real PTY round trip; task lifecycle; live summary; restart preserved history; no bodies, duplicate IDs or temporary publications`,
  );
} finally {
  socket?.terminate();
  await app.close();
  for (const pid of pids) {
    let alive = false;
    try {
      process.kill(pid, 0);
      alive = true;
    } catch {
      /* Expected terminated process. */
    }
    assert.equal(alive, false, `Demo process ${pid} leaked`);
  }
  await rm(dir, { recursive: true, force: true });
}
