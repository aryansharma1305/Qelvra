import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it } from "vitest";
import { ExecutionProcessManager } from "../../apps/server/src/execution/execution-process-manager";
let directory: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "qelvra-execution-launch-"));
});
afterEach(async () => {
  await rm(directory, { recursive: true, force: true });
});
it.skipIf(process.platform === "win32")(
  "cleanup ignores a workspace executable shadowing ps in PATH",
  async () => {
    await writeFile(join(directory, "ps"), "#!/bin/sh\ntouch shadow-executed.txt\n", {
      mode: 0o700,
    });
    const manager = new ExecutionProcessManager(),
      controller = new AbortController();
    const running = manager.run(
      {
        file: process.execPath,
        args: [
          "-e",
          "require('node:fs').writeFileSync('ready.txt',String(process.pid));setInterval(()=>{},1000)",
        ],
        cwd: directory,
        env: { PATH: `${directory}:${process.env.PATH ?? ""}` },
        inheritEnv: false,
        stdin: "",
        output: "json",
        resultFile: join(directory, "result.json"),
      },
      controller.signal,
    );
    const stopped = expect(running).rejects.toMatchObject({ code: "EXECUTION_CANCELLED" });
    await expect
      .poll(
        async () => {
          try {
            await access(join(directory, "ready.txt"));
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 5000 },
      )
      .toBe(true);
    controller.abort("EXECUTION_CANCELLED");
    await stopped;
    expect(manager.size).toBe(0);
    await expect(access(join(directory, "shadow-executed.txt"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  },
);
it.each(["missing-executable", "missing-cwd"])(
  "%s returns a controlled launch failure and releases the worker",
  async (mode) => {
    const manager = new ExecutionProcessManager();
    await expect(
      manager.run(
        {
          file: mode === "missing-executable" ? join(directory, "missing") : process.execPath,
          args: [],
          cwd: mode === "missing-cwd" ? join(directory, "missing") : directory,
          env: {},
          inheritEnv: false,
          stdin: "",
          output: "json",
          resultFile: join(directory, "result.json"),
        },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "EXECUTION_START_FAILED" });
    expect(manager.size).toBe(0);
  },
);
it("an already-cancelled signal never starts a worker", async () => {
  const manager = new ExecutionProcessManager();
  const controller = new AbortController();
  controller.abort("EXECUTION_CANCELLED");
  await expect(
    manager.run(
      {
        file: process.execPath,
        args: [],
        cwd: directory,
        env: {},
        inheritEnv: false,
        stdin: "",
        output: "json",
        resultFile: join(directory, "result.json"),
      },
      controller.signal,
    ),
  ).rejects.toMatchObject({ code: "EXECUTION_CANCELLED" });
  expect(manager.size).toBe(0);
});
