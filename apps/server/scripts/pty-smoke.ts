// Developer-only manual check of the PTY lifecycle (not part of the server build or API).
// Usage: npm run pty:smoke -w @qelvra/server
import { PtyManager } from "../src/pty/index.js";

const MARKER = "QELVRA_MANUAL_PTY";
const TIMEOUT_MS = 10_000;
// eslint-disable-next-line no-control-regex -- terminal escape sequences start with ESC
const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g;

function isAlive(pid: number | null): boolean {
  if (pid === null) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

const manager = new PtyManager({ workspaceRoot: process.cwd() });
const session = manager.createSession({ id: "manual-smoke" });
console.log(
  `created  ${session.id}: pid ${session.pid}, ${session.shell} ${session.args.join(" ")}`,
);
console.log(`         cwd ${session.cwd}, ${session.cols}x${session.rows}`);

let output = "";
// Line-exact: the terminal also echoes the typed command "echo QELVRA_MANUAL_PTY".
const hasMarkerLine = () =>
  output.split(/\r?\n/).some((line) => line.replace(ANSI, "").trim() === MARKER);

const sawMarker = new Promise<boolean>((resolve) => {
  const timer = setTimeout(() => resolve(false), TIMEOUT_MS);
  const subscription = manager.onData(session.id, (data) => {
    output += data;
    if (hasMarkerLine()) {
      clearTimeout(timer);
      subscription.dispose();
      resolve(true);
    }
  });
});

console.log(`write    echo ${MARKER}`);
manager.write(session.id, `echo ${MARKER}\r`);
const ok = await sawMarker;
console.log(`output   ${ok ? "received" : "NOT received"} line "${MARKER}"`);
console.log("--- transcript tail (escape sequences shown raw) ---");
console.log(JSON.stringify(output.slice(-300)));

const exit = await manager.terminate(session.id);
const alive = isAlive(session.pid);
console.log(
  `terminated: exit ${JSON.stringify(exit)}, sessions left ${manager.size}, shell alive: ${alive}`,
);
process.exit(ok && manager.size === 0 && !alive ? 0 : 1);
