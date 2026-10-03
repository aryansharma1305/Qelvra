import assert from "node:assert/strict";
import { mkdtemp, writeFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config/env.js";

const dataDir = await mkdtemp(join(tmpdir(), "qelvra-router-smoke-"));
const app = await createApp(loadConfig({ DATA_DIR: dataDir, WORKSPACE_ROOT: dataDir }), {
  logger: false,
});
async function eventually(check: () => Promise<void>) {
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      await check();
      return;
    } catch (error) {
      if (Date.now() >= deadline) throw error;
    }
    await pause(20);
  }
}
try {
  for (const id of ["nova", "atlas"])
    await app.runtime.create({ id, name: id, role: "Router smoke" });
  await app.ready();
  const first = await app.mailbox.writeOutboxMessage("nova", {
    to: "atlas",
    type: "message",
    body: "HELLO_ATLAS",
  });
  await eventually(async () => {
    assert.deepEqual((await app.mailbox.listMessages("atlas", "inbox")).messages, [first]);
    assert.deepEqual((await app.mailbox.listMessages("nova", "outbox")).messages, []);
  });
  await app.runtime.start("atlas");
  await app.runtime.stop("atlas");
  const second = await app.mailbox.writeOutboxMessage("nova", {
    to: "atlas",
    type: "message",
    body: "STOPPED_ATLAS",
  });
  await eventually(async () =>
    assert.deepEqual(await app.mailbox.readMessage("atlas", "inbox", second.id), second),
  );
  assert.equal(app.pty.size, 0);
  await app.router.stop();
  const pending = await app.mailbox.writeOutboxMessage("nova", {
    to: "atlas",
    type: "message",
    body: "OFFLINE_BACKLOG",
  });
  await app.router.start();
  assert.deepEqual(await app.mailbox.readMessage("atlas", "inbox", pending.id), pending);
  const outbox = await app.workspaces.getMailboxPath("nova", "outbox");
  await writeFile(join(outbox, "malformed.json"), "{broken");
  await eventually(async () => assert.equal(app.router.status().quarantined, 1));
  assert.deepEqual(await readdir(outbox), []);
  assert.equal((await app.mailbox.listMessages("atlas", "inbox")).messages.length, 3);
  assert.equal((await readdir(join(dataDir, "hive", "quarantine", "nova"))).length, 1);
  console.log(
    "PASS: live HELLO_ATLAS, stopped recipient, offline backlog, malformed quarantine; no pending sources, temp files or PTYs.",
  );
} finally {
  try {
    await app.close();
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
}
