import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Orchestration } from "@qelvra/shared";
import { OrchestrationStore } from "../../apps/server/src/orchestration/orchestration-store.js";
let dir: string;
const record = (): Orchestration => ({
  id: `goal-${randomUUID()}`,
  title: "Build page",
  description: "User goal",
  status: "draft",
  orchestratorAgentId: "michael",
  plan: null,
  tasks: [],
  taskIds: [],
  controlTaskIds: [],
  decision: null,
  maxAttempts: 3,
  materialized: false,
  finalSummary: null,
  errorCode: null,
  createdAt: "2026-10-06T00:00:00.000Z",
  updatedAt: "2026-10-06T00:00:00.000Z",
  startedAt: null,
});
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-orchestration-store-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});
describe("durable goal snapshots", () => {
  it("serializes concurrent saves and returns defensive copies across reopen", async () => {
    const file = join(dir, "goals.json"),
      store = await OrchestrationStore.open(file),
      goals = [record(), record(), record()];
    await Promise.all(goals.map((g) => store.save(g)));
    const copy = store.list();
    copy[0]?.taskIds.push(`task-${randomUUID()}`);
    expect(store.list().every((g) => g.taskIds.length === 0)).toBe(true);
    expect((await OrchestrationStore.open(file)).list()).toHaveLength(3);
  });
  it("fails closed on corrupt snapshots and duplicate ownership without overwriting original data", async () => {
    const file = join(dir, "goals.json"),
      goal = record();
    for (const text of [
      "not-json",
      JSON.stringify({ version: 1, orchestrations: [goal, goal] }),
      JSON.stringify({
        version: 1,
        orchestrations: [{ ...goal, taskIds: [`task-${randomUUID()}`] }],
      }),
    ]) {
      await writeFile(file, text);
      await expect(OrchestrationStore.open(file)).rejects.toMatchObject({
        code: "ORCHESTRATION_PERSISTENCE_FAILED",
      });
      expect(await readFile(file, "utf8")).toBe(text);
    }
  });
  it("does not expose an unsaved record after an atomic write failure", async () => {
    const file = join(dir, "goals.json"),
      store = await OrchestrationStore.open(file),
      goal = record();
    await store.save(goal);
    const moved = `${dir}-saved`;
    await rename(dir, moved);
    await writeFile(dir, "blocked");
    try {
      await expect(store.save({ ...goal, status: "planning" })).rejects.toMatchObject({
        code: "ORCHESTRATION_PERSISTENCE_FAILED",
      });
      expect(store.get(goal.id)?.status).toBe("draft");
    } finally {
      await rm(dir);
      await rename(moved, dir);
    }
  });
});
