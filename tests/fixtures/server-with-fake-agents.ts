import { setTimeout as pause } from "node:timers/promises";
import { createApp } from "../../apps/server/src/app";
import { loadConfig } from "../../apps/server/src/config/env";
import { installShutdownHandlers } from "../../apps/server/src/server";

const dataDir = process.env.QELVRA_FAKE_TEST_DATA;
if (!dataDir) throw new Error("Disposable DATA_DIR required");
const app = await createApp(
  loadConfig({ DATA_DIR: dataDir, WORKSPACE_ROOT: dataDir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
  { logger: false },
);
await app.listen({ host: "127.0.0.1", port: 0 });
installShutdownHandlers(app);
const outputs = new Map<string, string>();
const pids: number[] = [];
const wait = async (check: () => boolean | Promise<boolean>) => {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Fixture timed out");
    await pause(20);
  }
};
for (const id of ["nova", "atlas"]) {
  await app.runtime.create({ id, name: id, role: "Signal fixture", providerId: "fake" });
  await app.runtime.start(id);
  const runtime = app.runtime.get(id);
  if (!runtime?.pid) throw new Error("Missing fake process");
  pids.push(runtime.pid);
  outputs.set(id, "");
  app.pty.onData(runtime.sessionId, (data) => outputs.set(id, (outputs.get(id) ?? "") + data));
  app.pty.write(runtime.sessionId, "STATUS\r");
  await wait(() => (outputs.get(id) ?? "").includes(`READY ${id}`));
}
const atlas = app.runtime.get("atlas");
const nova = app.runtime.get("nova");
if (!atlas || !nova) throw new Error("Missing runtimes");
outputs.set("atlas", "");
app.pty.write(atlas.sessionId, "AUTO_RESPOND OFF\rSTATUS\r");
await wait(() => (outputs.get("atlas") ?? "").includes("READY atlas"));
app.pty.write(nova.sessionId, "SEND atlas SIGNAL_PENDING\r");
await wait(async () => (await app.mailbox.listMessages("atlas", "inbox")).messages.length === 1);
process.stdout.write(`${JSON.stringify({ ready: true, pids })}\n`);
