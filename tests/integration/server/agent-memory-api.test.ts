import { mkdtemp, rm, readFile, writeFile, unlink, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { AgentMemoryResponseSchema, AGENT_MEMORY_LIMIT } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
const apps: FastifyInstance[] = [];
const dirs: string[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-memory-api-"));
  dirs.push(dir);
  const config = loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" });
  const app = await createApp(config, { logger: false });
  apps.push(app);
  await app.ready();
  for (const id of ["nova", "atlas"])
    await app.runtime.create({ id, name: id, role: "Test", providerId: "fake" });
  return { app, dir, config };
}
describe("fixed agent memory REST", () => {
  it("saves notes, emits metadata only, rejects stale clients and persists across actual app restart", async () => {
    const { app, dir, config } = await setup();
    const url = "/api/agents/nova/memory";
    const original = AgentMemoryResponseSchema.parse((await app.inject(url)).json()).memory;
    const secret = "PRIVATE_MEMORY_NOTE";
    const saved = await app.inject({
      method: "PUT",
      url,
      payload: { content: secret, expectedRevision: original.revision },
    });
    expect(saved.statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: "PUT",
          url,
          payload: { content: "lost", expectedRevision: original.revision },
        })
      ).json().error.code,
    ).toBe("MEMORY_CHANGED_ON_DISK");
    const memoryEvents = (await app.inject("/api/activity?limit=100"))
      .json()
      .events.filter((event: { type: string }) => event.type === "memory.updated");
    expect(memoryEvents).toHaveLength(1);
    expect(memoryEvents[0].metadata).toEqual({ agentId: "nova", size: secret.length });
    expect(JSON.stringify(memoryEvents)).not.toContain(secret);
    expect((await app.inject("/api/agents/atlas/memory")).json().memory.content).not.toContain(
      secret,
    );
    await app.close();
    const restarted = await createApp(config, { logger: false });
    apps.push(restarted);
    await restarted.ready();
    expect((await restarted.inject(url)).json().memory.content).toBe(secret);
    expect(await readFile(join(dir, "hive/agents/nova/memory.md"), "utf8")).toBe(secret);
  });
  it("rejects paths, malformed identities, unregistered agents and invalid/big memory", async () => {
    const { app, dir } = await setup();
    const url = "/api/agents/nova/memory";
    const m = (await app.inject(url)).json().memory;
    expect((await app.inject(url + "?path=../atlas/memory.md")).statusCode).toBe(400);
    expect((await app.inject("/api/agents/../memory")).statusCode).toBe(404);
    for (const id of ["%2e%2e%2fnova", "Bad-ID"])
      expect((await app.inject("/api/agents/" + id + "/memory")).statusCode).toBe(400);
    expect((await app.inject("/api/agents/missing/memory")).statusCode).toBe(404);
    for (const extra of [{ path: "memory.md" }, { filename: "memory.md" }, { agentId: "atlas" }])
      expect(
        (
          await app.inject({
            method: "PUT",
            url,
            payload: { content: "lost", expectedRevision: m.revision, ...extra },
          })
        ).statusCode,
      ).toBe(400);
    const large = await app.inject({
      method: "PUT",
      url,
      payload: { content: "é".repeat(AGENT_MEMORY_LIMIT), expectedRevision: m.revision },
    });
    expect(large.statusCode).toBe(413);
    expect(large.json().error.code).toBe("MEMORY_TOO_LARGE");
    await writeFile(join(dir, "hive/agents/nova/memory.md"), Buffer.from([0xff]));
    const corrupt = await app.inject(url);
    expect(corrupt.statusCode).toBe(415);
    expect(corrupt.json().error.code).toBe("MEMORY_INVALID_UTF8");
    expect(corrupt.body).not.toContain(dir);
  });
  it("repairs missing legacy memory without Activity updates, but refuses symlink replacement", async () => {
    const { app, dir } = await setup();
    const path = join(dir, "hive/agents/nova/memory.md");
    const url = "/api/agents/nova/memory";
    await unlink(path);
    expect((await app.inject(url)).json().memory.content).toContain("No persistent notes yet.");
    expect(
      (await app.inject("/api/activity"))
        .json()
        .events.filter((event: { type: string }) => event.type === "memory.updated"),
    ).toEqual([]);
    await unlink(path);
    const outside = join(dir, "secret.txt");
    await writeFile(outside, "PRIVATE_OUTSIDE");
    await symlink(outside, path);
    const res = await app.inject(url);
    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain("PRIVATE_OUTSIDE");
    expect(res.body).not.toContain(dir);
  });
});
