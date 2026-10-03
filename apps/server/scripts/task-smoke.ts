import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";
import { TaskResponseSchema } from "@qelvra/shared";
// The manual demo owns its entire temporary DATA_DIR; it never uses the developer registry.
const dataDir = await mkdtemp(join(tmpdir(), "qelvra-task-smoke-"));
const config = loadConfig({ DATA_DIR: dataDir });
let app = await createApp(config, { logger: false });
const call = async (url: string, body?: object) => {
  const res = await app.inject({ method: "POST", url, ...(body ? { payload: body } : {}) });
  assert.ok(res.statusCode === 200 || res.statusCode === 201, res.body);
  return TaskResponseSchema.parse(res.json()).task;
};
try {
  await app.runtime.create({ name: "Nova", role: "Frontend" });
  await app.runtime.create({ name: "Atlas", role: "Backend" });
  const a = await call("/api/tasks", {
    title: "Build login form",
    description: "Frontend login and validation",
  });
  await call(`/api/tasks/${a.id}/assign`, { agentId: "nova" });
  await call(`/api/tasks/${a.id}/start`);
  await call(`/api/tasks/${a.id}/review`);
  await call(`/api/tasks/${a.id}/start`);
  await call(`/api/tasks/${a.id}/review`);
  await call(`/api/tasks/${a.id}/complete`);
  const b = await call("/api/tasks", {
    title: "Create API",
    description: "Keep API content",
    assignee: "atlas",
  });
  await call(`/api/tasks/${b.id}/start`);
  await call(`/api/tasks/${b.id}/review`);
  const snapshot = app.tasks.list();
  await app.close();
  app = await createApp(config, { logger: false });
  assert.deepEqual(app.tasks.list(), snapshot);
  const deletion = await app.inject({ method: "DELETE", url: "/api/agents/atlas" });
  assert.equal(deletion.statusCode, 204);
  assert.equal(app.tasks.require(b.id).status, "inbox");
  assert.equal(app.tasks.require(b.id).assignee, null);
  assert.equal(app.tasks.require(b.id).description, b.description);
  assert.equal(app.tasks.require(a.id).status, "completed");
  await call(`/api/tasks/${b.id}/assign`, { agentId: "nova" });
  await call(`/api/tasks/${b.id}/fail`);
  await app.close();
  app = await createApp(config, { logger: false });
  assert.equal(app.tasks.require(b.id).status, "failed");
  assert.equal(app.tasks.require(a.id).status, "completed");
  assert.equal(app.pty.list().length, 0);
  const check = async (dir: string): Promise<void> => {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      assert.ok(!file.name.startsWith(".tmp-") && !file.name.endsWith(".tmp"));
      if (file.isDirectory()) await check(join(dir, file.name));
    }
  };
  await check(dataDir);
  console.log(
    "PASS: two tasks, full lifecycle/return/reload, active-assignee deletion, failure/reload; zero PTYs or temporary publications",
  );
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
