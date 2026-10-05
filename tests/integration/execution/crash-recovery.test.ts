import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
let directory: string | undefined;
let server: ChildProcess | undefined;
let app: Awaited<ReturnType<typeof createApp>> | undefined;
const processes = new Set<number>();
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
afterEach(async () => {
  if (server?.pid && alive(server.pid)) {
    server.kill("SIGKILL");
    await new Promise<void>((r) => server?.once("exit", () => r()));
  }
  await app?.close();
  for (const pid of processes) await expect.poll(() => alive(pid), { timeout: 6000 }).toBe(false);
  if (directory) await rm(directory, { recursive: true, force: true });
});
it("hard server death closes IPC, stops provider descendants and recovers without a second launch", async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-execution-crash-"));
  server = spawn(
    process.execPath,
    ["--import", import.meta.resolve("tsx"), resolve("tests/fixtures/execution-server.ts")],
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
        LOG_LEVEL: "silent",
        DATA_DIR: directory,
        WORKSPACE_ROOT: directory,
        QELVRA_TEST_PORT: "0",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  server.stdout?.on("data", (data: Buffer) => {
    stdout += data.toString();
  });
  await expect
    .poll(() => /"fixturePort":(\d+)/.exec(stdout)?.[1], { timeout: 10000 })
    .toBeDefined();
  const port = /"fixturePort":(\d+)/.exec(stdout)?.[1];
  const base = `http://127.0.0.1:${port}/api`;
  async function post(path: string, body: unknown) {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  await post("/agents", {
    id: "crash-nova",
    name: "Crash Nova",
    role: "Disposable",
    providerId: "fake",
  });
  const { task } = (await post("/tasks", {
    title: "[fixture:timeout] Crash work",
    assignee: "crash-nova",
  })) as { task: { id: string } };
  await post(`/tasks/${task.id}/execute`, {});
  const file = join(directory, "hive/agents/crash-nova/workspace/fixture-process.json");
  await expect
    .poll(
      async () => {
        try {
          return JSON.parse(await readFile(file, "utf8"));
        } catch {
          return null;
        }
      },
      { timeout: 6000 },
    )
    .not.toBeNull();
  const info = JSON.parse(await readFile(file, "utf8")) as { pid: number; childPid: number };
  processes.add(info.pid);
  processes.add(info.childPid);
  const executionDirectory = /"fixtureDirectory":"([^"]+)"/.exec(stdout)?.[1];
  if (!executionDirectory) throw new Error("Missing supervised execution directory");
  await access(executionDirectory);
  const exited = new Promise<void>((r) => server?.once("exit", () => r()));
  server.kill("SIGKILL");
  await exited;
  for (const pid of processes) await expect.poll(() => alive(pid), { timeout: 6000 }).toBe(false);
  await expect
    .poll(
      async () => {
        try {
          await access(executionDirectory);
          return true;
        } catch {
          return false;
        }
      },
      { timeout: 6000 },
    )
    .toBe(false);
  app = await createApp(
    loadConfig({
      DATA_DIR: directory,
      WORKSPACE_ROOT: directory,
      NODE_ENV: "test",
      LOG_LEVEL: "silent",
    }),
    { logger: false },
  );
  await app.ready();
  expect(app.execution.get(task.id).execution).toMatchObject({
    status: "interrupted",
    errorCode: "EXECUTION_INTERRUPTED",
  });
  expect(app.tasks.require(task.id).status).toBe("assigned");
  expect(app.execution.size).toBe(0);
  expect(app.runtime.size).toBe(0);
  expect((await app.mailbox.listMessages("crash-nova", "inbox")).messages).toEqual([]);
}, 15000);
