import { execFileSync, spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { describe, expect, it } from "vitest";

// Runs the real server shutdown path in a child process and sends it SIGINT, as Ctrl-C
// would. Verifies the process exits cleanly and leaves no PTY processes behind.

// Run the fixture as a plain node process (tsx as a loader), so signals reach the server
// itself. The `tsx` CLI wrapper does not relay SIGHUP.
const NODE_ARGS = ["--import", "tsx", "tests/fixtures/server-with-ptys.ts"];

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function processesMatching(pattern: string): string[] {
  try {
    return execFileSync("pgrep", ["-f", pattern]).toString().trim().split("\n");
  } catch {
    return [];
  }
}

describe("server process shutdown", () => {
  it.each(["SIGINT", "SIGTERM", "SIGHUP"] as const)(
    "%s terminates every PTY session and exits 0",
    async (signal) => {
      const sleepSeconds = String(50_000 + Math.floor(Math.random() * 9_000));
      const child = spawn(process.execPath, NODE_ARGS, {
        env: { ...process.env, QELVRA_TEST_SLEEP: sleepSeconds },
        stdio: ["ignore", "pipe", "inherit"],
      });
      const exited = new Promise<number | null>((resolve) =>
        child.on("exit", (code) => resolve(code)),
      );

      try {
        const firstLine = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("fixture did not start")), 15_000);
          createInterface({ input: child.stdout }).once("line", (line) => {
            clearTimeout(timer);
            resolve(line);
          });
        });
        const { pids } = JSON.parse(firstLine) as { pids: number[] };
        expect(pids).toHaveLength(2);
        for (const pid of pids) expect(isAlive(pid)).toBe(true);

        child.kill(signal);
        expect(await exited).toBe(0);

        for (const pid of pids) expect(isAlive(pid)).toBe(false);
        expect(processesMatching(`^sleep ${sleepSeconds}$`)).toEqual([]);
      } finally {
        if (child.exitCode === null) child.kill("SIGKILL");
      }
    },
    30_000,
  );
});
