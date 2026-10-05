import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Execution } from "@qelvra/shared";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ExecutionStore } from "../../apps/server/src/execution/execution-store";
let directory: string, file: string;
const record: Execution = {
  id: `exec-${randomUUID()}`,
  taskId: `task-${randomUUID()}`,
  agentId: "nova",
  providerId: "fake",
  status: "running",
  requestMessageId: `msg-${randomUUID()}`,
  resultMessageId: null,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  errorCode: null,
  result: null,
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-execution-store-"));
  file = join(directory, "executions.json");
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it("persists independent records atomically and returns defensive copies", async () => {
  const store = await ExecutionStore.open(file);
  expect(store.latest(record.taskId)).toBeNull();
  const next = {
    ...record,
    id: `exec-${randomUUID()}`,
    startedAt: new Date(Date.now() + 1000).toISOString(),
  };
  await Promise.all([store.save(record), store.save(next)]);
  const latest = store.latest(record.taskId);
  if (!latest) throw new Error("Missing latest");
  latest.status = "failed";
  expect(store.latest(record.taskId)?.status).toBe("running");
  expect((await ExecutionStore.open(file)).latest(record.taskId)?.id).toBe(next.id);
});
it.each(["invalid-json", "invalid-record", "duplicate"])(
  "fails closed on %s without overwriting original data",
  async (mode) => {
    const source =
      mode === "invalid-json"
        ? "broken-json"
        : JSON.stringify({
            version: 1,
            executions: mode === "duplicate" ? [record, record] : [{ ...record, prompt: "secret" }],
          });
    await writeFile(file, source);
    await expect(ExecutionStore.open(file)).rejects.toMatchObject({
      code: "EXECUTION_PERSISTENCE_FAILED",
    });
    expect(await readFile(file, "utf8")).toBe(source);
  },
);
it("failed atomic writes do not advance the in-memory execution", async () => {
  const store = await ExecutionStore.open(file);
  await mkdir(file);
  await expect(store.save(record)).rejects.toMatchObject({ code: "EXECUTION_PERSISTENCE_FAILED" });
  expect(store.list()).toEqual([]);
});
