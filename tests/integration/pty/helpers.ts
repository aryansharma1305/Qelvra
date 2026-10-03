import { randomBytes } from "node:crypto";
import {
  PtyManager,
  createLocalShellProvider,
  type PtyExit,
  type PtyManagerOptions,
} from "../../../apps/server/src/pty/index";

// Real-process test helpers. Every manager and pid created here is tracked so tests can
// clean up in afterEach (even when assertions fail) and prove nothing was left running.

const managers = new Set<PtyManager>();
const spawnedPids = new Set<number>();

/** The shell PTY tests run (no login/rc files). QELVRA_TEST_SHELL=/bin/dash mimics Linux. */
export const TEST_SHELL = process.env.QELVRA_TEST_SHELL ?? "/bin/sh";
export const testShell = createLocalShellProvider({ only: [TEST_SHELL], login: false });

export function createTestManager(options: Partial<PtyManagerOptions> = {}): PtyManager {
  const manager = new PtyManager({
    workspaceRoot: process.cwd(),
    shellProvider: testShell,
    // Empty prompt so output lines are identical on bash and dash (Linux /bin/sh), even
    // when commands are typed before the shell prints its prompt. No user configuration.
    env: { PATH: process.env.PATH, HOME: process.env.HOME, PS1: "", LANG: "C" },
    ...options,
  });
  const create = manager.createSession.bind(manager);
  manager.createSession = (opts) => {
    const info = create(opts);
    if (info.pid !== null) spawnedPids.add(info.pid);
    return info;
  };
  managers.add(manager);
  return manager;
}

export async function cleanupManagers(): Promise<void> {
  await Promise.all([...managers].map((manager) => manager.terminateAll()));
  managers.clear();
}

/** The session's pid; fails loudly instead of letting a missing pid pass a liveness check. */
export function requirePid(info: { pid: number | null }): number {
  if (info.pid === null) throw new Error("session has no pid");
  return info.pid;
}

export function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function leakedPids(): number[] {
  return [...spawnedPids].filter(isAlive);
}

export function uniqueMarker(label: string): string {
  return `QELVRA_${label}_${randomBytes(4).toString("hex").toUpperCase()}`;
}

// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07|\x1b[@-Z\\-_]/g;

/** Collects a session's output and waits for complete lines, event-driven. */
export class OutputBuffer {
  private text = "";
  private waiters: (() => void)[] = [];
  readonly subscription;

  constructor(manager: PtyManager, sessionId: string) {
    this.subscription = manager.onData(sessionId, (data) => {
      this.text += data;
      for (const wake of this.waiters) wake();
    });
  }

  get raw(): string {
    return this.text;
  }

  /** Output lines with escape sequences removed. */
  lines(): string[] {
    return this.text
      .replace(ANSI, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/\r/g, ""));
  }

  /**
   * Resolves when `line` appears as a whole output line. The terminal echoes typed input
   * (e.g. "$ echo MARKER"), so a substring match would succeed too early.
   */
  waitForLine(line: string, timeoutMs = 5_000): Promise<void> {
    return this.waitUntil(() => this.lines().includes(line), `line "${line}"`, timeoutMs);
  }

  waitUntil(predicate: () => boolean, what: string, timeoutMs = 5_000): Promise<void> {
    if (predicate()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== check);
        reject(
          new Error(
            `Timed out after ${timeoutMs}ms waiting for ${what}. Output:\n${this.text.slice(-800)}`,
          ),
        );
      }, timeoutMs);
      const check = () => {
        if (!predicate()) return;
        clearTimeout(timer);
        this.waiters = this.waiters.filter((w) => w !== check);
        resolve();
      };
      this.waiters.push(check);
    });
  }
}

export function waitForExit(
  manager: PtyManager,
  sessionId: string,
  timeoutMs = 5_000,
): Promise<PtyExit> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Session ${sessionId} did not exit`)),
      timeoutMs,
    );
    manager.onExit(sessionId, (exit) => {
      clearTimeout(timer);
      resolve(exit);
    });
  });
}
