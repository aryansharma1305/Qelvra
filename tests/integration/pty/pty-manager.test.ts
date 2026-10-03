import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createInterface } from "node:readline";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PtyError, PtyManager, type PtyErrorCode } from "../../../apps/server/src/pty/index";
import {
  OutputBuffer,
  cleanupManagers,
  createTestManager,
  isAlive,
  leakedPids,
  requirePid,
  TEST_SHELL,
  testShell,
  uniqueMarker,
  waitForExit,
} from "./helpers";

// Real shells under a pseudo-terminal. No fixed sleeps: every wait is event-driven with an
// explicit timeout, and afterEach terminates whatever a failing test left behind.

afterEach(cleanupManagers);
afterAll(() => {
  expect(leakedPids(), "PTY processes left running by this suite").toEqual([]);
});

function processesMatching(command: string): string[] {
  try {
    return execFileSync("pgrep", ["-f", `^${command}$`])
      .toString()
      .trim()
      .split("\n");
  } catch {
    return []; // pgrep exits 1 when nothing matches
  }
}

function codeOf(fn: () => unknown): PtyErrorCode | "no error" {
  try {
    fn();
  } catch (error) {
    if (error instanceof PtyError) return error.code;
    throw error;
  }
  return "no error";
}

describe("createSession", () => {
  it("starts an allowlisted shell with safe defaults", () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "basic" });

    expect(info).toMatchObject({
      id: "basic",
      shell: TEST_SHELL,
      cwd: manager.workspaceRoot,
      cols: 120,
      rows: 32,
      status: "running",
      exit: null,
    });
    expect(info.pid).toBeGreaterThan(0);
    expect(Date.parse(info.createdAt)).not.toBeNaN();
    expect(manager.get("basic")?.status).toBe("running");
    expect(manager.list().map((s) => s.id)).toEqual(["basic"]);
  });

  it("rejects duplicate ids and leaves the original session untouched", () => {
    const manager = createTestManager();
    const first = manager.createSession({ id: "dup" });
    expect(codeOf(() => manager.createSession({ id: "dup" }))).toBe("PTY_SESSION_EXISTS");
    expect(manager.size).toBe(1);
    expect(manager.get("dup")?.pid).toBe(first.pid);
  });

  it.each(["", "../etc", "a/b", "has space", "-leading", "x".repeat(65), "nul\0"])(
    "rejects invalid id %j",
    (id) => {
      expect(codeOf(() => createTestManager().createSession({ id }))).toBe("PTY_INVALID_ID");
    },
  );

  it("rejects invalid initial sizes", () => {
    const manager = createTestManager();
    expect(codeOf(() => manager.createSession({ id: "s", cols: 0 }))).toBe("PTY_INVALID_SIZE");
    expect(codeOf(() => manager.createSession({ id: "s", rows: 501 }))).toBe("PTY_INVALID_SIZE");
    expect(manager.size).toBe(0);
  });

  it("reports spawn failures without leaking native details or state", () => {
    const manager = createTestManager({
      spawn: () => {
        throw new Error("posix_spawnp failed: secret native detail");
      },
    });
    let caught: unknown;
    try {
      manager.createSession({ id: "broken" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(PtyError);
    expect((caught as PtyError).code).toBe("PTY_SPAWN_FAILED");
    expect((caught as PtyError).message).not.toContain("secret");
    expect(((caught as PtyError).cause as Error).message).toContain("posix_spawnp");
    expect(manager.size).toBe(0);
  });
});

describe("working directory", () => {
  const root = mkdtempSync(join(tmpdir(), "qelvra-pty-root-"));
  const outside = mkdtempSync(join(tmpdir(), "qelvra-pty-outside-"));
  mkdirSync(join(root, "project", "src"), { recursive: true });
  writeFileSync(join(root, "file.txt"), "x");
  symlinkSync(outside, join(root, "escape-link"));
  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it("allows directories inside the workspace root", async () => {
    const manager = createTestManager({ workspaceRoot: root });
    const info = manager.createSession({ id: "inside", cwd: "project/src" });
    expect(info.cwd).toBe(join(manager.workspaceRoot, "project", "src"));

    const output = new OutputBuffer(manager, "inside");
    manager.write("inside", "pwd\r");
    await output.waitForLine(info.cwd);
  });

  it.each([
    ["parent traversal", "../"],
    ["nested traversal", "project/../../"],
    ["absolute path outside", "/"],
    ["symlink escaping the root", "escape-link"],
    ["missing directory", "nope"],
    ["a file", "file.txt"],
  ])("rejects %s", (_label, cwd) => {
    const manager = createTestManager({ workspaceRoot: root });
    expect(codeOf(() => manager.createSession({ id: "cwd", cwd }))).toBe("PTY_INVALID_CWD");
    expect(manager.size).toBe(0);
  });

  it("requires the workspace root to exist", () => {
    expect(
      codeOf(
        () => new PtyManager({ workspaceRoot: join(root, "missing"), shellProvider: testShell }),
      ),
    ).toBe("PTY_INVALID_CWD");
  });
});

describe("input and output", () => {
  it("round-trips a command and cleans up on terminate", async () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "echo" });
    const output = new OutputBuffer(manager, "echo");

    manager.write("echo", "echo QELVRA_PTY_TEST\r");
    // The typed command is echoed back as "$ echo QELVRA_PTY_TEST"; only a line that is
    // exactly the marker is the command's output.
    await output.waitForLine("QELVRA_PTY_TEST");

    const exit = await manager.terminate("echo");
    expect(exit).not.toBeNull();
    expect(manager.size).toBe(0);
    expect(manager.has("echo")).toBe(false);
    expect(isAlive(requirePid(info))).toBe(false);
  });

  it("keeps sessions isolated from each other", async () => {
    const manager = createTestManager();
    manager.createSession({ id: "a" });
    manager.createSession({ id: "b" });
    const outA = new OutputBuffer(manager, "a");
    const outB = new OutputBuffer(manager, "b");
    const markerA = uniqueMarker("A");
    const markerB = uniqueMarker("B");

    manager.write("a", `echo ${markerA}\r`);
    manager.write("b", `echo ${markerB}\r`);
    await Promise.all([outA.waitForLine(markerA), outB.waitForLine(markerB)]);

    expect(outA.raw).not.toContain(markerB);
    expect(outB.raw).not.toContain(markerA);
  });

  it("passes input through unchanged, including control characters", async () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "ctrl" });
    const output = new OutputBuffer(manager, "ctrl");
    const marker = uniqueMarker("AFTER_CTRL_C");

    manager.write("ctrl", "sleep 30\r");
    // Typing a command does not mean the shell has started its foreground job yet.
    // Wait for this shell's sleep, with its process group owning the terminal, before
    // sending Ctrl-C; otherwise startup timing can cancel the command or miss sleep.
    let sleepPid = 0;
    await vi.waitFor(() => {
      const rows = execFileSync("ps", ["-A", "-o", "pid=,ppid=,pgid=,tpgid=,args="])
        .toString()
        .split("\n");
      const sleep = rows
        .map((row) => row.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(.+)$/))
        .find(
          (row) =>
            row &&
            Number(row[2]) === requirePid(info) &&
            row[3] === row[4] &&
            /(?:^|[ /])sleep 30$/.test(row[5] ?? ""),
        );
      expect(sleep, "sleep must be this shell's foreground process").toBeDefined();
      sleepPid = Number(sleep?.[1]);
    });
    manager.write("ctrl", "\x03"); // Ctrl-C interrupts the foreground sleep
    manager.write("ctrl", `echo ${marker}\r`);
    await output.waitForLine(marker);
    expect(isAlive(sleepPid), "Ctrl-C must end the foreground sleep").toBe(false);
    expect(manager.get("ctrl")?.status).toBe("running");
  });

  it("stops delivering output to disposed listeners only", async () => {
    const manager = createTestManager();
    manager.createSession({ id: "subs" });
    const kept = new OutputBuffer(manager, "subs");
    const dropped = new OutputBuffer(manager, "subs");
    const first = uniqueMarker("FIRST");
    const second = uniqueMarker("SECOND");

    manager.write("subs", `echo ${first}\r`);
    await Promise.all([kept.waitForLine(first), dropped.waitForLine(first)]);
    dropped.subscription.dispose();
    dropped.subscription.dispose(); // idempotent

    manager.write("subs", `echo ${second}\r`);
    await kept.waitForLine(second);
    expect(dropped.raw).not.toContain(second);
  });

  it("isolates a throwing listener from the others", async () => {
    const manager = createTestManager();
    manager.createSession({ id: "throw" });
    manager.onData("throw", () => {
      throw new Error("listener bug");
    });
    const output = new OutputBuffer(manager, "throw");
    const marker = uniqueMarker("STILL_FLOWING");
    manager.write("throw", `echo ${marker}\r`);
    await output.waitForLine(marker);
  });

  it("rejects writes to unknown sessions and non-string input", () => {
    const manager = createTestManager();
    expect(codeOf(() => manager.write("ghost", "ls\r"))).toBe("PTY_SESSION_NOT_FOUND");
    manager.createSession({ id: "typed" });
    expect(codeOf(() => manager.write("typed", 42 as unknown as string))).toBe("PTY_INVALID_INPUT");
    expect(codeOf(() => manager.onData("ghost", () => {}))).toBe("PTY_SESSION_NOT_FOUND");
  });
});

describe("resize", () => {
  it("changes the terminal size seen by programs", async () => {
    const manager = createTestManager();
    manager.createSession({ id: "size" });
    const output = new OutputBuffer(manager, "size");

    manager.resize("size", 100, 40);
    expect(manager.get("size")).toMatchObject({ cols: 100, rows: 40 });
    manager.write("size", "stty size\r");
    await output.waitForLine("40 100");
  });

  it.each([
    [0, 24],
    [80, 0],
    [-1, 24],
    [80.5, 24],
    [1001, 24],
    [80, 501],
    [Number.NaN, 24],
  ])("rejects %s x %s and keeps the current size", (cols, rows) => {
    const manager = createTestManager();
    manager.createSession({ id: "bad-size", cols: 80, rows: 24 });
    expect(codeOf(() => manager.resize("bad-size", cols, rows))).toBe("PTY_INVALID_SIZE");
    expect(manager.get("bad-size")).toMatchObject({ cols: 80, rows: 24 });
  });

  it("returns controlled errors for unknown and exited sessions", async () => {
    const manager = createTestManager();
    expect(codeOf(() => manager.resize("ghost", 80, 24))).toBe("PTY_SESSION_NOT_FOUND");
    manager.createSession({ id: "gone" });
    const exited = waitForExit(manager, "gone");
    manager.write("gone", "exit\r");
    await exited;
    expect(codeOf(() => manager.resize("gone", 80, 24))).toBe("PTY_SESSION_NOT_FOUND");
  });

  it("rejects input and resize while a session is shutting down", async () => {
    const manager = createTestManager();
    manager.createSession({ id: "closing" });
    const terminating = manager.terminate("closing");
    expect(codeOf(() => manager.write("closing", "ls\r"))).toBe("PTY_SESSION_NOT_RUNNING");
    expect(codeOf(() => manager.resize("closing", 80, 24))).toBe("PTY_SESSION_NOT_RUNNING");
    await terminating;
  });
});

describe("process exit", () => {
  it("cleans up after the shell exits on its own", async () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "natural" });
    const exits: unknown[] = [];
    manager.onExit("natural", (exit) => exits.push(exit));
    const exited = waitForExit(manager, "natural");

    manager.write("natural", "exit 3\r");
    expect(await exited).toEqual({ exitCode: 3, signal: null });

    expect(exits).toHaveLength(1);
    expect(manager.size).toBe(0);
    expect(isAlive(requirePid(info))).toBe(false);
    expect(codeOf(() => manager.write("natural", "ls\r"))).toBe("PTY_SESSION_NOT_FOUND");
    await expect(manager.terminate("natural")).resolves.toBeNull();
    expect(exits).toHaveLength(1); // no double cleanup
  });

  it("terminate notifies exit listeners once and is safe to repeat", async () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "term" });
    let notified = 0;
    manager.onExit("term", () => notified++);

    const [first, second] = await Promise.all([
      manager.terminate("term"),
      manager.terminate("term"),
    ]);
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(notified).toBe(1);
    expect(manager.size).toBe(0);
    expect(isAlive(requirePid(info))).toBe(false);
    await expect(manager.terminate("term")).resolves.toBeNull();
  });

  it("kills the shell's child processes too", async () => {
    const manager = createTestManager();
    const info = manager.createSession({ id: "children" });
    const output = new OutputBuffer(manager, "children");

    manager.write("children", "set +H 2>/dev/null\r"); // bash's sh mode treats "!" as history
    manager.write("children", "sleep 300 & echo BG=$!; sh -c 'echo FG=$$; exec sleep 301'\r");
    await output.waitUntil(
      () =>
        output.lines().some((l) => /^BG=\d+$/.test(l)) &&
        output.lines().some((l) => /^FG=\d+$/.test(l)),
      "child pids",
    );
    const pidOf = (prefix: string) => {
      const line = output.lines().find((l) => new RegExp(`^${prefix}=\\d+$`).test(l));
      if (!line) throw new Error(`no ${prefix} line`);
      return Number(line.split("=")[1]);
    };
    const background = pidOf("BG");
    const foreground = pidOf("FG");
    expect(isAlive(background) && isAlive(foreground)).toBe(true);

    await manager.terminate("children");
    expect(isAlive(requirePid(info))).toBe(false);
    expect(isAlive(foreground)).toBe(false);
    expect(isAlive(background)).toBe(false);
  });

  it("kills children that ignore hangup (nohup-style)", async () => {
    const manager = createTestManager({ terminateGraceMs: 300 });
    manager.createSession({ id: "nohup" });
    const output = new OutputBuffer(manager, "nohup");
    manager.write("nohup", "set +H 2>/dev/null\r");
    manager.write("nohup", `sh -c "trap '' HUP; echo STUBBORN=\\$\\$; exec sleep 302" &\r`);
    await output.waitUntil(() => /STUBBORN=\d+/.test(output.lines().join("\n")), "stubborn pid");
    // A background job prints after the next prompt ("$ STUBBORN=123"), so no line anchor.
    // The echoed command contains "STUBBORN=\\$\\$", never digits, so this is unambiguous.
    const stubborn = Number(/STUBBORN=(\d+)/.exec(output.lines().join("\n"))?.[1]);
    expect(isAlive(stubborn)).toBe(true);

    await manager.terminate("nohup");
    expect(isAlive(stubborn)).toBe(false);
  });

  it("leaves nothing behind when terminated while a command is starting", async () => {
    const manager = createTestManager();
    // A distinctive duration identifies this test's processes system-wide.
    const duration = 40_000 + Math.floor(Math.random() * 9_000);
    for (let round = 0; round < 5; round++) {
      const id = `race-${round}`;
      manager.createSession({ id });
      manager.write(id, `sleep ${duration}\r`);
      await manager.terminate(id);
    }
    expect(manager.size).toBe(0);
    expect(processesMatching(`sleep ${duration}`)).toEqual([]);
  });

  it("escalates to SIGKILL when the shell ignores hangup", async () => {
    const manager = createTestManager({ terminateGraceMs: 300 });
    const info = manager.createSession({ id: "stubborn" });
    const output = new OutputBuffer(manager, "stubborn");
    const marker = uniqueMarker("TRAPPED");
    manager.write("stubborn", `trap '' HUP; echo ${marker}\r`);
    await output.waitForLine(marker);

    const exit = await manager.terminate("stubborn");
    expect(exit?.signal).toBe(9);
    expect(manager.size).toBe(0);
    expect(isAlive(requirePid(info))).toBe(false);
  });

  it("terminateAll stops every session", async () => {
    const manager = createTestManager();
    const sessions = ["one", "two", "three"].map((id) => manager.createSession({ id }));
    const busy = new OutputBuffer(manager, "three");
    const marker = uniqueMarker("BUSY");
    manager.write("three", `echo ${marker}; sleep 300\r`);
    await busy.waitForLine(marker);

    await manager.terminateAll();
    expect(manager.size).toBe(0);
    expect(manager.list()).toEqual([]);
    for (const session of sessions) expect(isAlive(requirePid(session))).toBe(false);
    await manager.terminateAll(); // no-op when empty
  });
});

describe("process listing failure", () => {
  it("still terminates the shell when `ps` is unavailable", async () => {
    const manager = createTestManager({ terminateGraceMs: 500 });
    const info = manager.createSession({ id: "no-ps" });
    const original = process.env.PATH;
    // Hide `ps` from the server process only; the shell keeps its own PATH.
    process.env.PATH = "/nonexistent";
    try {
      await manager.terminate("no-ps");
    } finally {
      process.env.PATH = original;
    }
    expect(manager.size).toBe(0);
    expect(isAlive(requirePid(info))).toBe(false);
  });
});

describe("server dies mid-termination", () => {
  it("leaves nothing frozen or running when killed after the freeze", async () => {
    const child = spawn("node_modules/.bin/tsx", ["tests/fixtures/pty-killed-mid-termination.ts"], {
      stdio: ["ignore", "pipe", "inherit"],
    });
    const line = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("fixture produced no output")), 15_000);
      createInterface({ input: child.stdout }).once("line", (l) => {
        clearTimeout(timer);
        resolve(l);
      });
    });
    const report = JSON.parse(line) as {
      shell: number;
      background: number;
      foreground: number;
      frozen: number[];
      shellState: string;
      backgroundState: string;
    };
    try {
      // The descendants were frozen; the shell (session leader) was not.
      expect(report.frozen).toEqual(expect.arrayContaining([report.background, report.foreground]));
      expect(report.frozen).not.toContain(report.shell);
      expect(report.shellState).not.toMatch(/T/);
      expect(report.backgroundState).toMatch(/T/);

      // With the manager gone, the kernel's hangup must still clean everything up.
      const pids = [report.shell, report.background, report.foreground];
      await expect.poll(() => pids.filter(isAlive), { timeout: 5_000, interval: 50 }).toEqual([]);
    } finally {
      for (const pid of [report.shell, report.background, report.foreground]) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          // already gone
        }
      }
    }
  }, 30_000);
});
