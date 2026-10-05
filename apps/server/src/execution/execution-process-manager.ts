import { spawn, fork } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { freezeProcessTree, sendSignal, waitUntilGone, isAlive } from "../pty/process-tree.js";
import type { ExecutionCommand } from "../providers/provider-execution.js";
import { ExecutionError, type ExecutionErrorCode } from "./execution-errors.js";
import { ProviderError } from "../providers/provider-errors.js";

/** One-shot pipe processes, entirely separate from interactive PTYs. */
export class ExecutionChildProcess {
  private readonly pids = new Set<number>();
  constructor(private readonly maxBytes = 1024 * 1024) {}
  get size() {
    return this.pids.size;
  }
  run(command: ExecutionCommand, signal: AbortSignal): Promise<string> {
    if (signal.aborted)
      return Promise.reject(new ExecutionError(signal.reason as ExecutionErrorCode));
    return new Promise((resolve, reject) => {
      const child = spawn(command.file, [...command.args], {
        cwd: command.cwd,
        env: command.env,
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"],
        windowsHide: true,
      });
      if (child.pid) this.pids.add(child.pid);
      const stdout: Buffer[] = [],
        stderr: Buffer[] = [];
      let bytes = 0,
        failure: Error | undefined,
        cleanup: Promise<void> | undefined,
        settled = false;
      const terminate = () =>
        (cleanup ??= (async () => {
          if (!child.pid) return;
          if (process.platform === "win32") {
            child.kill("SIGKILL");
            return;
          }
          // Reuse the PTY descendant freeze, then kill the dedicated process group.
          const descendants = await freezeProcessTree(child.pid);
          sendSignal(child.pid, "SIGSTOP");
          const late = await freezeProcessTree(child.pid);
          const tree = [...new Set([child.pid, ...descendants, ...late])];
          for (const pid of tree) sendSignal(pid, "SIGKILL");
          sendSignal(-child.pid, "SIGKILL");
          await waitUntilGone(tree, Date.now() + 2000);
          if (tree.some(isAlive)) throw new ExecutionError("EXECUTION_START_FAILED");
        })());
      const finish = async (code: number | null) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", abort);
        try {
          await terminate();
          if (failure) throw failure;
          if (code !== 0) {
            const diagnostics = Buffer.concat(stderr).toString("utf8");
            if (
              /not logged in|authentication required|please (?:log|sign) in|401 unauthorized|refresh token/i.test(
                diagnostics,
              )
            )
              throw new ProviderError(
                "PROVIDER_AUTH_REQUIRED",
                "Codex authentication is required. Sign in using its CLI, then retry.",
              );
            throw new ExecutionError("EXECUTION_START_FAILED");
          }
          resolve(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(stdout)));
        } catch (error) {
          reject(
            error instanceof ExecutionError || error instanceof ProviderError
              ? error
              : new ExecutionError("EXECUTION_INVALID_RESULT"),
          );
        } finally {
          child.stdin.destroy();
          child.stdout.destroy();
          child.stderr.destroy();
          if (child.pid) this.pids.delete(child.pid);
        }
      };
      const abort = () => {
        failure ??= new ExecutionError(signal.reason as ExecutionErrorCode);
        void finish(null);
      };
      signal.addEventListener("abort", abort, { once: true });
      const collect = (target: Buffer[], chunk: Buffer) => {
        if (settled) return;
        bytes += chunk.length;
        if (bytes > this.maxBytes) {
          failure = new ExecutionError("EXECUTION_OUTPUT_LIMIT");
          void finish(null);
        } else target.push(chunk);
      };
      child.stdout.on("data", (data: Buffer) => collect(stdout, data));
      child.stderr.on("data", (data: Buffer) => collect(stderr, data));
      child.once("error", () => {
        failure = new ExecutionError("EXECUTION_START_FAILED");
        void finish(null);
      });
      child.once("exit", () => {
        void terminate().catch(() => {
          failure ??= new ExecutionError("EXECUTION_START_FAILED");
        });
      });
      child.once("close", (code) => {
        void finish(code);
      });
      child.stdin.on("error", () => {
        /* Exit handler owns failures, including early pipe closure. */
      });
      child.stdin.end(command.stdin);
      if (signal.aborted) abort();
    });
  }
}

/** Fixed IPC watchdog survives just long enough to clean up after a hard server crash. */
export class ExecutionProcessManager {
  private readonly pids = new Set<number>();
  constructor(private readonly maxBytes = 1024 * 1024) {}
  get size() {
    return this.pids.size;
  }
  run(command: ExecutionCommand, signal: AbortSignal): Promise<string> {
    if (signal.aborted)
      return Promise.reject(new ExecutionError(signal.reason as ExecutionErrorCode));
    return new Promise((resolve, reject) => {
      const bundle = new URL("./execution-worker.js", import.meta.url);
      const bundled = existsSync(bundle);
      const worker = fork(
        fileURLToPath(bundled ? bundle : new URL("./execution-worker.ts", import.meta.url)),
        [],
        {
          cwd: command.cwd,
          env: command.env,
          execArgv: bundled ? [] : ["--import", import.meta.resolve("tsx")],
          stdio: ["ignore", "ignore", "ignore", "ipc"],
        },
      );
      if (worker.pid) this.pids.add(worker.pid);
      let response: { output?: string; code?: string } | undefined;
      const abort = () => {
        if (worker.connected)
          worker.send({ type: "cancel", code: String(signal.reason) }, () => undefined);
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.on("message", (message) => {
        response = message as typeof response;
      });
      worker.on("error", () => {
        response = { code: "EXECUTION_START_FAILED" };
      });
      worker.once("close", () => {
        signal.removeEventListener("abort", abort);
        if (worker.pid) this.pids.delete(worker.pid);
        if (signal.aborted) reject(new ExecutionError(signal.reason as ExecutionErrorCode));
        else if (response?.code === "PROVIDER_AUTH_REQUIRED")
          reject(
            new ProviderError(
              "PROVIDER_AUTH_REQUIRED",
              "Codex authentication is required. Sign in using its CLI, then retry.",
            ),
          );
        else if (response?.code) reject(new ExecutionError(response.code as ExecutionErrorCode));
        else if (typeof response?.output === "string") resolve(response.output);
        else reject(new ExecutionError("EXECUTION_START_FAILED"));
      });
      worker.send({ type: "run", command, maxBytes: this.maxBytes }, () => undefined);
      if (signal.aborted) abort();
    });
  }
}
