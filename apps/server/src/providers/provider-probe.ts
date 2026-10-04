import { spawn } from "node:child_process";
import { isAbsolute, join } from "node:path";
export interface ProbeResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}
export type ProviderProbe = (
  file: string,
  args: readonly string[],
  env: NodeJS.ProcessEnv,
) => Promise<ProbeResult>;
/** Own a process group so timeout/output-limit cleanup also closes descendant-held pipes. */
export const probeExecutable: ProviderProbe = (file, args, env) =>
  new Promise((resolve) => {
    const child = spawn(file, [...args], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
      windowsHide: true,
    });
    const stdout: Buffer[] = [],
      stderr: Buffer[] = [];
    let bytes = 0,
      finished = false;
    const killTree = () => {
      if (!child.pid) return;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else {
          // Direct server-owned system executable; no cmd.exe interpolation.
          const root = env.SystemRoot ?? env.WINDIR;
          if (root && isAbsolute(root)) {
            const killer = spawn(
              join(root, "System32", "taskkill.exe"),
              ["/PID", String(child.pid), "/T", "/F"],
              { env, stdio: "ignore", windowsHide: true },
            );
            const timer = setTimeout(() => killer.kill(), 1000);
            killer.once("error", () => clearTimeout(timer));
            killer.once("close", () => clearTimeout(timer));
          }
          child.kill("SIGKILL");
        }
      } catch {
        /* Already exited. */
      }
    };
    const finish = (exitCode: number | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
      resolve({
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode,
      });
    };
    const stop = () => {
      killTree();
      finish(null);
    };
    const timer = setTimeout(stop, 3000);
    const collect = (destination: Buffer[], chunk: Buffer) => {
      if (finished) return;
      bytes += chunk.length;
      if (bytes > 65536) stop();
      else destination.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => finish(null));
    child.once("exit", killTree);
    child.once("close", (code) => finish(code));
  });
