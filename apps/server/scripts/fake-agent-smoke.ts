// Disposable manual demo of the actual runtime/PTY pipeline. Never modifies local data.
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const dir = await mkdtemp(join(tmpdir(), "qelvra-fake-demo-"));
const app = await createApp(
  loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
  { logger: false },
);
const output = new Map<string, string>();
const wait = async (check: () => boolean | Promise<boolean>) => {
  const deadline = Date.now() + 10000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Demo timed out");
    await pause(20);
  }
};
const launch = async (id: string) => {
  await app.runtime.start(id);
  const runtime = app.runtime.get(id);
  if (!runtime?.pid) throw new Error("Missing fake process");
  output.set(id, "");
  app.pty.onData(runtime.sessionId, (data) => output.set(id, (output.get(id) ?? "") + data));
  app.pty.write(runtime.sessionId, "STATUS\r");
  await wait(() => (output.get(id) ?? "").includes(`READY ${id}`));
};
const command = async (id: string, line: string, marker: string) => {
  const runtime = app.runtime.get(id);
  if (!runtime) throw new Error("Missing runtime");
  output.set(id, "");
  app.pty.write(runtime.sessionId, `${line}\r`);
  await wait(() => (output.get(id) ?? "").includes(marker));
  console.log(`${id}> ${line}\n${output.get(id)}`);
};
try {
  await app.ready();
  for (const id of ["nova", "atlas"]) {
    await app.runtime.create({ id, name: id, role: "Demo / Test", providerId: "fake" });
    await launch(id);
  }
  await command("nova", "PING", "PONG");
  await command("nova", "SEND atlas HELLO_ATLAS", "MESSAGE_QUEUED");
  await wait(async () =>
    (await app.mailbox.listMessages("nova", "inbox")).messages.some(
      (m) => m.body === "ACK:HELLO_ATLAS",
    ),
  );
  await command("nova", "CHECK_INBOX", "ACK:HELLO_ATLAS");
  await app.runtime.stop("atlas");
  await command("nova", "SEND atlas STOPPED_ATLAS", "MESSAGE_QUEUED");
  await wait(async () => (await app.mailbox.listMessages("atlas", "inbox")).messages.length === 1);
  console.log("Atlas stopped: incoming message safely preserved.");
  await launch("atlas");
  await wait(async () =>
    (await app.mailbox.listMessages("nova", "inbox")).messages.some(
      (m) => m.body === "ACK:STOPPED_ATLAS",
    ),
  );
  await command("nova", "CHECK_INBOX", "ACK:STOPPED_ATLAS");
  await wait(async () => app.router.status().delivered === 4 && app.router.status().inFlight === 0);
  for (const id of ["nova", "atlas"]) {
    if ((await app.mailbox.listMessages(id, "outbox")).messages.length)
      throw new Error("Pending source");
    for (const box of ["inbox", "outbox"] as const)
      if (
        (await readdir(await app.workspaces.getMailboxPath(id, box))).some((name) =>
          name.startsWith(".tmp-"),
        )
      )
        throw new Error("Temporary file left");
  }
  if ((await readdir(join(dir, "hive"))).includes("quarantine"))
    throw new Error("Unexpected quarantine");
  console.log("PASS: real fake-agent round-trip, stopped backlog, no loops/quarantine/temp files.");
} finally {
  await app.close();
  await rm(dir, { recursive: true, force: true });
}

if (app.runtime.size || app.pty.size) throw new Error("Runtime leak");
