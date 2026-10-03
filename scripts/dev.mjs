// Runs the server and web dev servers together (`npm run dev`). No dependencies: output is
// prefixed per process, Ctrl-C stops both, and if one exits the other is stopped too.
import { spawn } from "node:child_process";
import readline from "node:readline";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const processes = [
  { name: "server", color: "\x1b[36m", workspace: "@qelvra/server" },
  { name: "web", color: "\x1b[35m", workspace: "@qelvra/web" },
];

let stopping = false;
const children = processes.map(({ name, color, workspace }) => {
  const child = spawn(npm, ["run", "dev", "-w", workspace], {
    stdio: ["inherit", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? "1" },
  });
  const prefix = `${color}[${name}]\x1b[0m `;
  for (const stream of [child.stdout, child.stderr]) {
    readline.createInterface({ input: stream }).on("line", (line) => {
      (stream === child.stderr ? process.stderr : process.stdout).write(prefix + line + "\n");
    });
  }
  child.on("exit", (code, signal) => {
    if (!stopping) {
      console.error(`${prefix}exited (${signal ?? code}); stopping the other process`);
      stop(code ?? 1);
    }
  });
  return child;
});

function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  const alive = children.filter((child) => child.exitCode === null && child.signalCode === null);
  // SIGINT (what Ctrl-C sends) lets npm, Vite and the server exit cleanly without npm errors.
  for (const child of alive) child.kill("SIGINT");
  let remaining = alive.length;
  if (remaining === 0) process.exit(exitCode);
  for (const child of alive) {
    child.once("exit", () => {
      remaining -= 1;
      if (remaining === 0) process.exit(exitCode);
    });
  }
  setTimeout(() => process.exit(exitCode), 10_000).unref();
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
