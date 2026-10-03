import assert from "node:assert/strict";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AgentRegistry } from "../src/agents/agent-registry.js";
import { AgentWorkspaceManager } from "../src/workspaces/agent-workspace-manager.js";
import { MailboxManager } from "../src/mailbox/index.js";

// Always disposable. No live app, default DATA_DIR, runtimes or network access.
const dataDir = await mkdtemp(join(tmpdir(), "qelvra-mailbox-smoke-"));
try {
  const registry = await AgentRegistry.open({ file: join(dataDir, "agents.json") });
  const workspaces = await AgentWorkspaceManager.open(dataDir);
  for (const id of ["nova", "atlas"]) {
    await workspaces.ensureWorkspace(await registry.create({ id, name: id, role: "Smoke test" }));
  }
  const mailbox = new MailboxManager({ registry, workspaces });
  const message = await mailbox.writeOutboxMessage("nova", {
    to: "atlas",
    type: "message",
    body: "HELLO_ATLAS",
  });
  assert.deepEqual(await mailbox.readMessage("nova", "outbox", message.id), message);
  assert.equal(message.from, "nova");
  assert.equal(message.to, "atlas");
  assert.equal(message.body, "HELLO_ATLAS");
  assert.deepEqual(await readdir(await workspaces.getMailboxPath("nova", "outbox")), [
    `${message.id}.json`,
  ]);
  assert.deepEqual(await readdir(await workspaces.getMailboxPath("atlas", "inbox")), []);
  assert.equal(await mailbox.acknowledgeMessage("nova", "outbox", message.id), true);
  assert.deepEqual(await readdir(await workspaces.getMailboxPath("nova", "outbox")), []);
  console.log(
    "PASS: Nova → Atlas envelope, outbox-only publication, validated read, explicit removal; no temp files or PTYs.",
  );
} finally {
  await rm(dataDir, { recursive: true, force: true });
}
