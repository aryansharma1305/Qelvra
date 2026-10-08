import { mkdtemp, rm, writeFile, readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { AnalyticsResponseSchema } from "@qelvra/shared";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import { analyticsHistory, ANALYTICS_RANGE } from "../../fixtures/analytics-history";
const dirs: string[] = [],
  apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup(corrupt = false) {
  const dir = await mkdtemp(join(tmpdir(), "qelvra-analytics-api-"));
  dirs.push(dir);
  await writeFile(
    join(dir, "events.jsonl"),
    analyticsHistory()
      .map((event) => JSON.stringify(event))
      .join("\n") +
      "\n" +
      (corrupt ? "PRIVATE_CORRUPTION\n" : ""),
  );
  const config = loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test" });
  const app = await createApp(config, { logger: false });
  apps.push(app);
  await app.ready();
  for (const name of ["Nova", "Atlas"])
    await app.runtime.create({ name, role: "Engineer", providerId: "fake" });
  await app.activity.flush();
  return { dir, app, config };
}
const query = "/api/analytics?" + new URLSearchParams(ANALYTICS_RANGE).toString();
async function files(dir: string): Promise<Record<string, { bytes: string; mtime: number }>> {
  const result: Record<string, { bytes: string; mtime: number }> = {};
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(result, await files(path));
    else if (entry.isFile())
      result[path] = {
        bytes: (await readFile(path)).toString("base64"),
        mtime: (await stat(path)).mtimeMs,
      };
  }
  return result;
}
describe("read-only Analytics REST", () => {
  it("aggregates persisted history and does not write any domain, workspace, memory or event files", async () => {
    const { app, dir, config } = await setup();
    await app.tasks.create({
      title: "PRIVATE_TASK",
      description: "PRIVATE_DESCRIPTION",
      assignee: "nova",
    });
    await writeFile(join(dir, "hive/agents/nova/memory.md"), "PRIVATE_MEMORY_CONTENT");
    await writeFile(join(dir, "hive/agents/nova/workspace/secret.txt"), "PRIVATE_FILE_CONTENT");
    await app.activity.flush();
    const before = await files(dir);
    for (let n = 0; n < 3; n++) {
      const response = await app.inject(query);
      expect(response.statusCode).toBe(200);
      const result = AnalyticsResponseSchema.parse(response.json());
      expect(result.summary.recordedEvents).toBe(7);
      expect(response.body).not.toMatch(
        /PRIVATE|taskTitle|relativePath|prompt|terminal|environment|messageBody|description|content/,
      );
    }
    expect(await files(dir)).toEqual(before);
    await app.close();
    const restarted = await createApp(config, { logger: false });
    apps.push(restarted);
    await restarted.ready();
    expect(
      AnalyticsResponseSchema.parse((await restarted.inject(query)).json()).summary.recordedEvents,
    ).toBe(7);
    expect(await readFile(join(dir, "hive/agents/nova/memory.md"), "utf8")).toBe(
      "PRIVATE_MEMORY_CONTENT",
    );
  });
  it("validates narrow UTC queries, rejects writes and returns a controlled missing-agent error", async () => {
    const { app } = await setup();
    for (const suffix of [
      "from=bad",
      "from=2026-02-30&to=2026-03-01",
      "from=2026-10-05&to=2026-10-01",
      "from=2026-01-01&to=2026-10-01",
      "from=2026-10-01&to=2026-10-01",
      "agentId=..%2Fnova",
      "from=2026-10-01&from=2026-10-02",
      "path=secret",
      "agentId=",
    ])
      expect((await app.inject("/api/analytics?" + suffix)).statusCode).toBe(400);
    expect((await app.inject("/api/analytics?agentId=unknown")).statusCode).toBe(404);
    for (const method of ["POST", "PUT", "DELETE"] as const)
      expect((await app.inject({ method, url: "/api/analytics" })).statusCode).toBe(404);
    expect((await app.inject(query + "&agentId=nova")).json().summary.recordedEvents).toBe(5);
    expect((await app.inject(query + "&agentId=atlas")).json().summary.recordedEvents).toBe(1);
  });
  it("reports corrupt source coverage without exposing or repairing journal contents", async () => {
    const { app, dir } = await setup(true);
    const before = await readFile(join(dir, "events.jsonl"));
    const response = await app.inject(query);
    expect(response.json().coverage).toMatchObject({
      recordingHealthy: false,
      historyMayBeTruncated: true,
    });
    expect(response.json().coverage.warnings).toContain("INTEGRITY_WARNINGS");
    expect(response.body).not.toContain("PRIVATE_CORRUPTION");
    expect(await readFile(join(dir, "events.jsonl"))).toEqual(before);
  });
});
