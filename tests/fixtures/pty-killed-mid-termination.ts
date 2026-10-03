// Child-process fixture: starts a shell with a background and a foreground child, freezes
// the tree as PtyManager.terminate() does, then dies with SIGKILL mid-termination. Prints
// the pids (and the shell's process state at that moment) for the test to watch.
import { execFileSync } from "node:child_process";
import { PtyManager, createLocalShellProvider } from "../../apps/server/src/pty/index";
import { freezeProcessTree } from "../../apps/server/src/pty/process-tree";

const manager = new PtyManager({
  workspaceRoot: process.cwd(),
  shellProvider: createLocalShellProvider({
    only: [process.env.QELVRA_TEST_SHELL ?? "/bin/sh"],
    login: false,
  }),
  env: { PATH: process.env.PATH, PS1: "", LANG: "C" },
});
const session = manager.createSession({ id: "doomed" });
const shell = session.pid ?? -1;
let output = "";
manager.onData("doomed", (data) => {
  output += data;
});
manager.write("doomed", "set +H 2>/dev/null\r");
manager.write("doomed", "sleep 1234 & echo BG=$!; sh -c 'echo FG=$$; exec sleep 1235'\r");

const deadline = Date.now() + 10_000;
while (!(/BG=(\d+)/.test(output) && /FG=(\d+)/.test(output)) && Date.now() < deadline) {
  await new Promise((resolve) => setTimeout(resolve, 20));
}
const background = Number(/BG=(\d+)/.exec(output)?.[1]);
const foreground = Number(/FG=(\d+)/.exec(output)?.[1]);

const frozen = await freezeProcessTree(shell);
const state = (pid: number) =>
  execFileSync("ps", ["-o", "stat=", "-p", String(pid)])
    .toString()
    .trim();
process.stdout.write(
  `${JSON.stringify({ shell, background, foreground, frozen, shellState: state(shell), backgroundState: state(background) })}\n`,
);
process.kill(process.pid, "SIGKILL");
