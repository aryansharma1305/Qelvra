import { realpathSync, statSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { spawn as nodePtySpawn, type IPty } from "node-pty";
import { PtyError } from "./errors.js";
import { freezeProcessTree, isAlive, sendSignal, waitUntilGone } from "./process-tree.js";
import { createLocalShellProvider, type ShellProvider } from "./shell-provider.js";
import {
  silentLogger,
  type CreatePtySessionOptions,
  type Disposable,
  type PtyExit,
  type PtyLogger,
  type PtySessionInfo,
} from "./types.js";

export const PTY_TERM_NAME = "xterm-256color";
export const PTY_DEFAULT_COLS = 120;
export const PTY_DEFAULT_ROWS = 32;
export const PTY_MAX_COLS = 1000;
export const PTY_MAX_ROWS = 500;

const SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
/** Wait after SIGHUP before escalating to SIGKILL. */
const DEFAULT_TERMINATE_GRACE_MS = 3_000;
/** Wait after SIGKILL before giving up on the exit event and cleaning up anyway. */
const KILL_WAIT_MS = 2_000;

type SpawnFn = typeof nodePtySpawn;
type DataListener = (data: string) => void;
type ExitListener = (exit: PtyExit) => void;

interface PtySessionRuntime {
  info: PtySessionInfo;
  process: IPty;
  dataListeners: Set<DataListener>;
  exitListeners: Set<ExitListener>;
  nativeSubscriptions: Disposable[];
  /** Set once termination starts; the session no longer accepts input. */
  closing: boolean;
  /** In-flight shutdown, shared by concurrent terminate() calls. */
  terminating?: Promise<PtyExit>;
  exited: Promise<PtyExit>;
}

export interface PtyManagerOptions {
  /** Default session cwd and primary allowed root (symlinks resolved). */
  workspaceRoot: string;
  /** Additional server-configured cwd roots; never supplied by browser messages. */
  additionalWorkspaceRoots?: readonly string[];
  shellProvider?: ShellProvider;
  logger?: PtyLogger;
  /** Environment for spawned shells; defaults to the server's environment. */
  env?: NodeJS.ProcessEnv;
  terminateGraceMs?: number;
  /** Injectable for tests. */
  spawn?: SpawnFn;
}

/**
 * Variables that identify the terminal emulator the *server* was started from. Passing
 * them on makes shells behave as if they ran there (e.g. macOS zsh restores Apple Terminal
 * sessions when it sees TERM_PROGRAM=Apple_Terminal), so PTYs get their own identity.
 */
const PARENT_TERMINAL_VARIABLES = [
  "TERM_PROGRAM",
  "TERM_PROGRAM_VERSION",
  "TERM_SESSION_ID",
  "ITERM_SESSION_ID",
  "ITERM_PROFILE",
  "LC_TERMINAL",
  "LC_TERMINAL_VERSION",
  "WT_SESSION",
  "VSCODE_INJECTION",
] as const;

export function ptyEnvironment(base: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const dropped = new Set<string>(PARENT_TERMINAL_VARIABLES);
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => !dropped.has(name)));
  return { ...env, TERM: PTY_TERM_NAME, COLORTERM: "truecolor" };
}

function assertSize(cols: number, rows: number): void {
  const valid =
    Number.isInteger(cols) &&
    Number.isInteger(rows) &&
    cols >= 1 &&
    rows >= 1 &&
    cols <= PTY_MAX_COLS &&
    rows <= PTY_MAX_ROWS;
  if (!valid) {
    throw new PtyError(
      "PTY_INVALID_SIZE",
      `Terminal size must be whole numbers within 1-${PTY_MAX_COLS} columns and 1-${PTY_MAX_ROWS} rows`,
    );
  }
}

function isWithin(root: string, target: string): boolean {
  const rel = relative(root, target);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

/**
 * Owns local PTY processes: spawn, input, output fan-out, resize, exit tracking and
 * termination. Knows nothing about WebSockets or agents; those layers build on it.
 */
export class PtyManager {
  readonly workspaceRoot: string;
  private readonly cwdRoots: readonly string[];
  private readonly sessions = new Map<string, PtySessionRuntime>();
  private readonly shellProvider: ShellProvider;
  private readonly logger: PtyLogger;
  private readonly env: NodeJS.ProcessEnv;
  private readonly terminateGraceMs: number;
  private readonly spawnFn: SpawnFn;

  constructor(options: PtyManagerOptions) {
    this.workspaceRoot = this.resolveRoot(options.workspaceRoot);
    this.cwdRoots = [
      this.workspaceRoot,
      ...(options.additionalWorkspaceRoots ?? []).map((root) => this.resolveRoot(root)),
    ];
    this.shellProvider = options.shellProvider ?? createLocalShellProvider();
    this.logger = options.logger ?? silentLogger;
    this.env = options.env ?? process.env;
    this.terminateGraceMs = options.terminateGraceMs ?? DEFAULT_TERMINATE_GRACE_MS;
    this.spawnFn = options.spawn ?? nodePtySpawn;
  }

  /** Number of live sessions. */
  get size(): number {
    return this.sessions.size;
  }

  has(id: string): boolean {
    return this.sessions.has(id);
  }

  get(id: string): PtySessionInfo | undefined {
    const runtime = this.sessions.get(id);
    return runtime ? { ...runtime.info } : undefined;
  }

  list(): PtySessionInfo[] {
    return [...this.sessions.values()].map((runtime) => ({ ...runtime.info }));
  }

  /**
   * Spawns a shell in a new PTY. Output emitted by the shell is delivered asynchronously,
   * so subscribing with onData() right after this call misses nothing.
   */
  createSession(options: CreatePtySessionOptions): PtySessionInfo {
    const { id } = options;
    if (typeof id !== "string" || !SESSION_ID_PATTERN.test(id)) {
      throw new PtyError(
        "PTY_INVALID_ID",
        "Session id must be 1-64 letters, digits, '-' or '_' and start with a letter or digit",
      );
    }
    if (this.sessions.has(id)) {
      throw new PtyError("PTY_SESSION_EXISTS", `PTY session "${id}" already exists`);
    }
    const cols = options.cols ?? PTY_DEFAULT_COLS;
    const rows = options.rows ?? PTY_DEFAULT_ROWS;
    assertSize(cols, rows);
    const cwd = this.resolveCwd(options.cwd);
    const shell = options.command ?? this.shellProvider.resolve();

    const info: PtySessionInfo = {
      id,
      pid: null,
      shell: shell.file,
      args: [...shell.args],
      cwd,
      cols,
      rows,
      createdAt: new Date().toISOString(),
      status: "starting",
      exit: null,
    };

    let ptyProcess: IPty;
    try {
      ptyProcess = this.spawnFn(shell.file, [...shell.args], {
        name: PTY_TERM_NAME,
        cols,
        rows,
        cwd,
        env: ptyEnvironment({ ...this.env, ...options.command?.env }),
      });
    } catch (error) {
      // Not registered: a failed spawn leaves no session behind.
      this.logger.error({ err: error, sessionId: id, shell: shell.file, cwd }, "PTY spawn failed");
      throw new PtyError("PTY_SPAWN_FAILED", `Could not start a shell for session "${id}"`, {
        cause: error,
      });
    }

    let resolveExited!: (exit: PtyExit) => void;
    const runtime: PtySessionRuntime = {
      info: { ...info, pid: ptyProcess.pid, status: "running" },
      process: ptyProcess,
      dataListeners: new Set(),
      exitListeners: new Set(),
      nativeSubscriptions: [],
      closing: false,
      exited: new Promise((resolveExit) => {
        resolveExited = resolveExit;
      }),
    };
    this.sessions.set(id, runtime);

    // Registered immediately so no output or exit can be missed.
    runtime.nativeSubscriptions.push(
      ptyProcess.onData((data) => this.emitData(runtime, data)),
      ptyProcess.onExit(({ exitCode, signal }) => {
        const exit: PtyExit = { exitCode, signal: signal ? signal : null };
        this.handleExit(runtime, exit);
        resolveExited(exit);
      }),
    );

    this.logger.info(
      { sessionId: id, pid: ptyProcess.pid, shell: shell.file, cwd, cols, rows },
      "PTY session started",
    );
    return { ...runtime.info };
  }

  /** Sends raw terminal input (keystrokes, pasted text, control sequences). */
  write(id: string, data: string): void {
    if (typeof data !== "string") {
      throw new PtyError("PTY_INVALID_INPUT", "Terminal input must be a string");
    }
    const runtime = this.requireRunning(id);
    try {
      runtime.process.write(data);
    } catch (error) {
      this.logger.warn({ err: error, sessionId: id }, "PTY write failed");
      throw new PtyError("PTY_SESSION_NOT_RUNNING", `PTY session "${id}" is not accepting input`, {
        cause: error,
      });
    }
  }

  resize(id: string, cols: number, rows: number): void {
    assertSize(cols, rows);
    const runtime = this.requireRunning(id);
    try {
      runtime.process.resize(cols, rows);
    } catch (error) {
      // The process can exit between our status check and the ioctl.
      this.logger.warn({ err: error, sessionId: id }, "PTY resize failed");
      throw new PtyError("PTY_SESSION_NOT_RUNNING", `PTY session "${id}" cannot be resized`, {
        cause: error,
      });
    }
    runtime.info.cols = cols;
    runtime.info.rows = rows;
  }

  /** Subscribes to terminal output. Dispose the returned handle to unsubscribe. */
  onData(id: string, listener: DataListener): Disposable {
    const runtime = this.requireSession(id);
    runtime.dataListeners.add(listener);
    return { dispose: () => void runtime.dataListeners.delete(listener) };
  }

  /** Called once when the session's process exits, for any reason. */
  onExit(id: string, listener: ExitListener): Disposable {
    const runtime = this.requireSession(id);
    runtime.exitListeners.add(listener);
    return { dispose: () => void runtime.exitListeners.delete(listener) };
  }

  /**
   * Ends the session and everything it started, like closing a terminal window: the
   * process tree is frozen (so nothing can fork away), sent SIGHUP, and given
   * `terminateGraceMs` to exit before anything left is SIGKILLed. Concurrent calls share
   * one shutdown. Returns null if no such session exists, so it is safe to repeat.
   */
  async terminate(id: string): Promise<PtyExit | null> {
    const runtime = this.sessions.get(id);
    if (!runtime) return null;
    runtime.terminating ??= this.shutdown(runtime);
    return runtime.terminating;
  }

  /** Terminates every session. Used on server shutdown. */
  async terminateAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    if (ids.length === 0) return;
    this.logger.info({ count: ids.length }, "Terminating all PTY sessions");
    await Promise.all(ids.map((id) => this.terminate(id)));
  }

  private resolveRoot(root: string): string {
    try {
      const real = realpathSync(resolve(root));
      if (!statSync(real).isDirectory()) throw new Error("not a directory");
      return real;
    } catch (error) {
      throw new PtyError("PTY_INVALID_CWD", "PTY workspace root must be an existing directory", {
        cause: error,
      });
    }
  }

  /** Resolves cwd inside configured roots; symlinks are followed before the check. */
  private resolveCwd(cwd: string | undefined): string {
    if (cwd === undefined) return this.workspaceRoot;
    if (typeof cwd !== "string" || cwd.length === 0 || cwd.includes("\0")) {
      throw new PtyError("PTY_INVALID_CWD", "Working directory is invalid");
    }
    let real: string;
    try {
      real = realpathSync(resolve(this.workspaceRoot, cwd));
      if (!statSync(real).isDirectory()) throw new Error("not a directory");
    } catch (error) {
      throw new PtyError("PTY_INVALID_CWD", "Working directory does not exist", { cause: error });
    }
    if (!this.cwdRoots.some((root) => isWithin(root, real))) {
      throw new PtyError("PTY_INVALID_CWD", "Working directory is outside the workspace root");
    }
    return real;
  }

  private requireSession(id: string): PtySessionRuntime {
    const runtime = this.sessions.get(id);
    if (!runtime) {
      throw new PtyError("PTY_SESSION_NOT_FOUND", `PTY session "${id}" does not exist`);
    }
    return runtime;
  }

  private requireRunning(id: string): PtySessionRuntime {
    const runtime = this.requireSession(id);
    if (runtime.closing || runtime.info.status !== "running") {
      throw new PtyError("PTY_SESSION_NOT_RUNNING", `PTY session "${id}" is shutting down`);
    }
    return runtime;
  }

  private emitData(runtime: PtySessionRuntime, data: string): void {
    for (const listener of runtime.dataListeners) {
      try {
        listener(data);
      } catch (error) {
        this.logger.error({ err: error, sessionId: runtime.info.id }, "PTY data listener threw");
      }
    }
  }

  /** Single cleanup path for natural exit, termination and forced cleanup. */
  private handleExit(runtime: PtySessionRuntime, exit: PtyExit): void {
    if (runtime.info.status === "exited") return;
    runtime.info.status = "exited";
    runtime.info.exit = exit;
    runtime.closing = true;

    if (this.sessions.get(runtime.info.id) === runtime) this.sessions.delete(runtime.info.id);
    for (const subscription of runtime.nativeSubscriptions) subscription.dispose();
    runtime.nativeSubscriptions.length = 0;
    runtime.dataListeners.clear();

    const listeners = [...runtime.exitListeners];
    runtime.exitListeners.clear();
    for (const listener of listeners) {
      try {
        listener(exit);
      } catch (error) {
        this.logger.error({ err: error, sessionId: runtime.info.id }, "PTY exit listener threw");
      }
    }
    this.logger.info({ sessionId: runtime.info.id, ...exit }, "PTY session exited");
  }

  private async shutdown(runtime: PtySessionRuntime): Promise<PtyExit> {
    runtime.closing = true;
    const { id, pid } = runtime.info;

    let exit: PtyExit | null;
    if (process.platform === "win32" || pid === null) {
      // ConPTY: closing the pseudoconsole ends the processes attached to it.
      try {
        runtime.process.kill();
      } catch (error) {
        this.logger.debug({ err: error, sessionId: id }, "PTY kill failed (already exited?)");
      }
      exit = await this.waitForExit(runtime, this.terminateGraceMs);
    } else {
      const descendants = await freezeProcessTree(pid, (error) =>
        this.logger.warn({ err: error, sessionId: id }, "Could not list PTY child processes"),
      );
      const tree = [pid, ...descendants];
      for (const member of tree) sendSignal(member, "SIGHUP");
      sendSignal(-pid, "SIGHUP"); // the shell's process group, for good measure
      for (const member of tree) sendSignal(member, "SIGCONT");

      // One grace period covers the shell and everything it started.
      const deadline = Date.now() + this.terminateGraceMs;
      exit = await this.waitForExit(runtime, this.terminateGraceMs);
      await waitUntilGone(tree, deadline);
      const survivors = tree.filter(isAlive);
      if (survivors.length > 0) {
        this.logger.warn(
          { sessionId: id, pids: survivors },
          "PTY processes ignored SIGHUP; sending SIGKILL",
        );
        for (const member of survivors) sendSignal(member, "SIGKILL");
        // terminate() promises the processes are gone, not merely signalled.
        await waitUntilGone(survivors, Date.now() + KILL_WAIT_MS);
        const undead = survivors.filter(isAlive);
        if (undead.length > 0) {
          this.logger.error({ sessionId: id, pids: undead }, "PTY processes survived SIGKILL");
        }
      }
      exit ??= await this.waitForExit(runtime, KILL_WAIT_MS);
    }

    if (!exit) {
      // The native layer never reported exit. Release our state rather than leak it.
      this.logger.error({ sessionId: id, pid }, "PTY did not report exit after SIGKILL");
      exit = { exitCode: -1, signal: 9 };
      this.handleExit(runtime, exit);
    }
    return exit;
  }

  private waitForExit(runtime: PtySessionRuntime, timeoutMs: number): Promise<PtyExit | null> {
    if (runtime.info.exit) return Promise.resolve(runtime.info.exit);
    return new Promise((resolveWait) => {
      const timer = setTimeout(() => resolveWait(null), timeoutMs);
      void runtime.exited.then((exit) => {
        clearTimeout(timer);
        resolveWait(exit);
      });
    });
  }
}
