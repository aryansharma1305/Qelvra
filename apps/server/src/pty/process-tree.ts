import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_FREEZE_PASSES = 10;

/** pid -> ppid for every process, via `ps` (available on macOS and Linux). */
async function processTable(): Promise<Map<number, number>> {
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,ppid="]);
  const table = new Map<number, number>();
  for (const line of stdout.split("\n")) {
    const [pid, ppid] = line.trim().split(/\s+/).map(Number);
    if (pid && ppid !== undefined && !Number.isNaN(ppid)) table.set(pid, ppid);
  }
  return table;
}

export async function descendantsOf(rootPid: number): Promise<number[]> {
  const table = await processTable();
  const children = new Map<number, number[]>();
  for (const [pid, ppid] of table) children.set(ppid, [...(children.get(ppid) ?? []), pid]);
  const result: number[] = [];
  const queue = [...(children.get(rootPid) ?? [])];
  while (queue.length > 0) {
    const pid = queue.shift() as number;
    result.push(pid);
    queue.push(...(children.get(pid) ?? []));
  }
  return result;
}

export function sendSignal(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false; // already gone (ESRCH) or not ours (EPERM)
  }
}

export function isAlive(pid: number): boolean {
  return sendSignal(pid, 0 as unknown as NodeJS.Signals);
}

/**
 * Stops every descendant of `rootPid` with SIGSTOP, re-reading the tree until no new
 * process appears, and returns them. A stopped process cannot fork, so children cannot
 * escape by being created while the tree is signalled.
 *
 * The root (the shell, a session leader) is deliberately left running: if this server
 * dies mid-termination, the shell still gets the kernel's hangup when the PTY closes and
 * exits, and the kernel then hangs up and resumes its now-orphaned stopped children. A
 * stopped session leader would ignore that hangup and stay frozen forever.
 */
export async function freezeProcessTree(
  rootPid: number,
  onListError: (error: unknown) => void = () => {},
): Promise<number[]> {
  const frozen = new Set<number>();
  for (let pass = 0; pass < MAX_FREEZE_PASSES; pass++) {
    let descendants: number[];
    try {
      descendants = await descendantsOf(rootPid);
    } catch (error) {
      // Without `ps` we still hang up the shell and its process group (see PtyManager).
      onListError(error);
      break;
    }
    let added = 0;
    for (const pid of descendants) {
      if (frozen.has(pid)) continue;
      if (sendSignal(pid, "SIGSTOP")) {
        frozen.add(pid);
        added++;
      }
    }
    if (added === 0) break;
  }
  return [...frozen];
}

/** Process exit has no event outside our own children, so liveness is polled. */
const LIVENESS_POLL_MS = 25;

/** Resolves when none of `pids` is alive, or at `deadline` (epoch ms), whichever is first. */
export async function waitUntilGone(pids: readonly number[], deadline: number): Promise<void> {
  while (pids.some(isAlive) && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, LIVENESS_POLL_MS));
  }
}
