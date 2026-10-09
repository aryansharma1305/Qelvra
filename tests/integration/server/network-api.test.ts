import { mkdtemp, rm, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { NetworkResponseSchema } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { ProviderRegistry } from "../../../apps/server/src/providers/provider-registry";
import { goal, observation, uuid } from "../../fixtures/network";
const apps: FastifyInstance[] = [],
  dirs: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  for (const a of apps.splice(0)) await a.close();
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-network-"));
  dirs.push(dir);
  const config = loadConfig({
    DATA_DIR: dir,
    WORKSPACE_ROOT: dir,
    NODE_ENV: "test",
    WEB_ORIGIN: "http://127.0.0.1:5174",
  });
  const providers = new ProviderRegistry({ allowFake: true, env: { PATH: "", SHELL: "/bin/sh" } });
  const app = await createApp(config, { logger: false, providerRegistry: providers });
  apps.push(app);
  await app.ready();
  await app.router.stop();
  await app.activity.flush();
  return { app, dir, config, providers };
}
async function files(dir: string): Promise<Record<string, { bytes: string; mtime: number }>> {
  const result: Record<string, { bytes: string; mtime: number }> = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) Object.assign(result, await files(p));
    else if (e.isFile())
      result[p] = { bytes: (await readFile(p)).toString("base64"), mtime: (await stat(p)).mtimeMs };
  }
  return result;
}
describe("read-only Network API", () => {
  it.each([
    "window=2h",
    "window=",
    "limit=100",
    "window=1h&window=7d",
    "window[]=1h",
    "from=2026-10-01",
  ])("rejects %s", async (query) => {
    const { app } = await setup();
    const r = await app.inject(`/api/network?${query}`);
    expect(r.statusCode).toBe(400);
    expect(r.json().error.code).toBe("VALIDATION_ERROR");
  });
  it("returns empty real data with no-store and no mutation routes", async () => {
    const { app } = await setup();
    const r = await app.inject("/api/network");
    expect(r.statusCode).toBe(200);
    expect(r.headers["cache-control"]).toBe("no-store");
    expect(NetworkResponseSchema.parse(r.json()).nodes).toEqual([]);
    expect(
      (await app.inject({ method: "POST", url: "/api/network", payload: {} })).statusCode,
    ).toBe(404);
  });
  it("preserves source bytes/mtime and calls no mailbox/provider/runtime/domain mutators", async () => {
    const { app, dir } = await setup();
    for (const id of ["lead", "worker", "isolated"])
      await app.runtime.create({ id, name: id, role: "Engineer", providerId: "fake" });
    await app.tasks.create({
      title: "Safe task title",
      description: "PRIVATE_TASK_DESCRIPTION",
      assignee: "worker",
    });
    // Registry timestamps must precede the persisted goal's membership evidence.
    await app.orchestration.store.save(
      goal(1, ["worker"], {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    const event = observation(
      1,
      "lead",
      "worker",
      "message.delivered",
      new Date(Date.now() + 10).toISOString(),
    );
    await app.activity.store.append(event);
    await app.activity.flush();
    await writeFile(join(dir, "hive/agents/worker/memory.md"), "PRIVATE_MEMORY");
    await writeFile(join(dir, "hive/agents/worker/workspace/private.txt"), "PRIVATE_WORKSPACE");
    await app.mailbox.writeOutboxMessage("worker", {
      to: "lead",
      type: "message",
      body: "PRIVATE_MESSAGE_BODY",
    });
    await app.activity.flush();
    const spies = [
      vi.spyOn(app.mailbox, "listMessages"),
      vi.spyOn(app.mailbox, "readMessage"),
      vi.spyOn(app.mailbox, "writeOutboxMessage"),
      vi.spyOn(app.mailbox, "deliverInboxMessage"),
      vi.spyOn(app.mailbox, "acknowledgeMessage"),
      vi.spyOn(app.providers, "list"),
      vi.spyOn(app.providers, "refresh"),
      vi.spyOn(app.activity, "publish"),
      vi.spyOn(app.runtime, "start"),
      vi.spyOn(app.runtime, "stop"),
      vi.spyOn(app.tasks, "assign"),
      vi.spyOn(app.orchestration, "run"),
    ];
    const before = await files(dir);
    for (let i = 0; i < 3; i++) {
      const r = await app.inject("/api/network?window=7d");
      expect(r.statusCode).toBe(200);
      const p = NetworkResponseSchema.parse(r.json());
      expect(p.nodes).toHaveLength(3);
      expect(p.nodes.find((n) => n.id === "worker")?.taskTotal).toBe(1);
      expect(p.edges.some((e) => e.kind === "orchestration")).toBe(true);
      expect(r.body).not.toMatch(
        /PRIVATE|memory\.md|private\.txt|pid|sessionId|description|body|finalSummary/,
      );
    }
    expect(await files(dir)).toEqual(before);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
  it("restores registered nodes, persisted task/goal participation and recorded messages after restart", async () => {
    const { app, config } = await setup();
    for (const id of ["lead", "worker"])
      await app.runtime.create({ id, name: id, role: "Engineer", providerId: "fake" });
    await app.tasks.create({ title: "Persisted assignment", assignee: "worker" });
    const time = new Date(Date.now() + 5).toISOString();
    await app.orchestration.store.save(goal(2, ["worker"], { createdAt: time, updatedAt: time }));
    await app.activity.store.append(observation(1, "lead", "worker", "message.delivered", time));
    await app.activity.flush();
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const restarted = await createApp(config, { logger: false });
    apps.push(restarted);
    await restarted.ready();
    await restarted.router.stop();
    await restarted.activity.flush();
    const p = NetworkResponseSchema.parse((await restarted.inject("/api/network")).json());
    expect(p.nodes.map((n) => n.id)).toEqual(["lead", "worker"]);
    expect(p.nodes.every((n) => !n.runtime.present)).toBe(true);
    expect(p.nodes.find((n) => n.id === "worker")?.taskTotal).toBe(1);
    expect(p.edges.find((e) => e.kind === "message")).toMatchObject({
      from: "lead",
      to: "worker",
      counts: { delivered: 1 },
    });
    expect(p.edges.find((e) => e.kind === "orchestration")).toMatchObject({ goalTotal: 1 });
    expect(p.timeline[0]?.messageId).toBe(`msg-${uuid(1)}`);
  });
  it("discloses a corrupted retained journal and capped recording without repairing bytes", async () => {
    const { app, dir, config } = await setup();
    await app.close();
    apps.splice(apps.indexOf(app), 1);
    const path = join(dir, "events.jsonl");
    await writeFile(path, "CORRUPT_PRIVATE_BYTES\n");
    const restarted = await createApp(config, { logger: false });
    apps.push(restarted);
    await restarted.ready();
    await restarted.router.stop();
    await restarted.activity.flush();
    const before = await readFile(path);
    const p = NetworkResponseSchema.parse((await restarted.inject("/api/network")).json());
    expect(p.coverage.warnings).toContain("INTEGRITY_WARNINGS");
    expect(await readFile(path)).toEqual(before);
    expect(JSON.stringify(p)).not.toContain("CORRUPT_PRIVATE_BYTES");
  });
});
