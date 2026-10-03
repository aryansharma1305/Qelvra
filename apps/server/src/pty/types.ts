import type { ResolvedShell } from "./shell-provider.js";
export type PtySessionStatus = "starting" | "running" | "exited" | "failed";

/** How a PTY's process ended. `signal` is set when it was killed by a signal. */
export interface PtyExit {
  exitCode: number;
  signal: number | null;
}

/** Serializable snapshot of a session; never contains the native process object. */
export interface PtySessionInfo {
  id: string;
  pid: number | null;
  shell: string;
  args: readonly string[];
  cwd: string;
  cols: number;
  rows: number;
  createdAt: string;
  status: PtySessionStatus;
  exit: PtyExit | null;
}

export interface CreatePtySessionOptions {
  id: string;
  /** Absolute, or relative to the manager's workspace root. Defaults to the root. */
  cwd?: string;
  cols?: number;
  rows?: number;
  /** Internal server-owned launch selection. Never populated from WebSocket/API input. */
  command?: ResolvedShell & { env?: NodeJS.ProcessEnv };
}

export interface Disposable {
  dispose(): void;
}

export type { ServiceLogger as PtyLogger } from "../lib/logger.js";
export { silentLogger } from "../lib/logger.js";
