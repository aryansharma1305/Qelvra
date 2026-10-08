import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  WorkspaceListingSchema,
  WorkspaceFileResponseSchema,
  WORKSPACE_TEXT_LIMIT,
} from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
const apps: FastifyInstance[] = [];
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-files-api-"));
  dirs.push(dir);
  const app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" }),
    { logger: false },
  );
  apps.push(app);
  await app.ready();
  await app.runtime.create({ id: "nova", name: "Nova", role: "Frontend", providerId: "fake" });
  return { app, dir };
}
describe("agent-scoped Files API", () => {
  it("performs the REST lifecycle, validates contracts and publishes metadata-only activity", async () => {
    const { app, dir } = await setup();
    const base = "/api/agents/nova/files";
    expect(WorkspaceListingSchema.parse((await app.inject(base)).json()).entries).toEqual([]);
    expect(
      (await app.inject({ method: "POST", url: base + "/directory", payload: { path: "demo" } }))
        .statusCode,
    ).toBe(201);
    expect(
      (
        await app.inject({
          method: "POST",
          url: base + "/file",
          payload: { path: "demo/hello.txt" },
        })
      ).statusCode,
    ).toBe(201);
    const file = WorkspaceFileResponseSchema.parse(
      (await app.inject(base + "/content?path=demo/hello.txt")).json(),
    ).file;
    const saved = await app.inject({
      method: "PUT",
      url: base + "/content",
      payload: { path: file.path, revision: file.revision, content: "PRIVATE_FILE_CONTENT" },
    });
    expect(saved.statusCode).toBe(200);
    const conflict = await app.inject({
      method: "PUT",
      url: base + "/content",
      payload: { path: file.path, revision: file.revision, content: "lost" },
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("FILE_CHANGED_ON_DISK");
    expect(
      (
        await app.inject({
          method: "POST",
          url: base + "/move",
          payload: { from: file.path, to: "demo/renamed.txt" },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ method: "DELETE", url: base, payload: { path: "demo" } })).json().error
        .code,
    ).toBe("FILE_DIRECTORY_NOT_EMPTY");
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: base,
          payload: { path: "demo", recursive: true },
        })
      ).statusCode,
    ).toBe(204);
    await app.activity.flush();
    const events = app.activity.store
      .listEvents({ limit: 100 })
      .events.filter((e) => e.type.startsWith("file."));
    expect(events.map((e) => e.type).reverse()).toEqual([
      "file.created",
      "file.created",
      "file.updated",
      "file.renamed",
      "file.deleted",
    ]);
    expect(JSON.stringify(events)).not.toContain("PRIVATE_FILE_CONTENT");
    expect(JSON.stringify(events)).not.toContain(dir);
    expect(await readFile(join(dir, "events.jsonl"), "utf8")).not.toContain("PRIVATE_FILE_CONTENT");
  });
  it("rejects arbitrary roots, unknown fields, missing agents, encoded traversal and big/binary files", async () => {
    const { app } = await setup();
    const base = "/api/agents/nova/files";
    expect((await app.inject("/api/files?path=/etc/passwd")).statusCode).toBe(404);
    expect((await app.inject("/api/agents/absent/files")).json().error.code).toBe(
      "AGENT_NOT_FOUND",
    );
    for (const path of [
      "../secret",
      "%2e%2e/secret",
      "%252e%252e/secret",
      "/etc/passwd",
      "a\0b",
      "..\\atlas",
    ]) {
      const response = await app.inject(base + "/content?" + new URLSearchParams({ path }));
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("FILE_INVALID_PATH");
    }
    expect((await app.inject(base + "?path=&root=/etc")).statusCode).toBe(400);
    expect(
      (
        await app.inject({
          method: "POST",
          url: base + "/file",
          payload: { path: "safe.txt", cwd: "/etc" },
        })
      ).statusCode,
    ).toBe(400);
    const root = await app.workspaces.getWorkspacePath("nova");
    await writeFile(join(root, "large.txt"), Buffer.alloc(WORKSPACE_TEXT_LIMIT + 1));
    await writeFile(join(root, "binary.bin"), Buffer.from([0, 255, 0]));
    for (const [name, code] of [
      ["large.txt", "FILE_TOO_LARGE"],
      ["binary.bin", "FILE_BINARY"],
    ]) {
      const response = await app.inject(base + "/content?path=" + name);
      expect(response.json().error.code).toBe(code);
      expect(response.json()).not.toHaveProperty("file");
    }
  });
  it("reads an actual development Fake execution artifact from the same workspace", async () => {
    const { app } = await setup();
    const task = await app.tasks.create({ title: "Files execution check", assignee: "nova" });
    await app.execution.executeTask(task.id);
    const deadline = Date.now() + 15000;
    while (app.tasks.require(task.id).status !== "review") {
      if (Date.now() > deadline) throw new Error("Execution did not finish");
      await new Promise((r) => setTimeout(r, 50));
    }
    const response = await app.inject("/api/agents/nova/files/content?path=fake-result.txt");
    expect(response.statusCode).toBe(200);
    expect(response.json().file.content).toContain("Files execution check");
  });
});
