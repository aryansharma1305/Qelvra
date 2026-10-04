import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";
import type { AgentTerminalAttachment } from "../../../apps/server/src/agents/agent-runtime-manager";

let app: Awaited<ReturnType<typeof createApp>>;
let dir: string;
const pids = new Set<number>();
const outputs = new Map<string, string>();
const terminals = new Map<string, AgentTerminalAttachment>();
function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error("Missing fixture value");
  return value;
}
function alive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
async function until(check: () => unknown | Promise<unknown>) {
  await expect.poll(check, { timeout: 10000, interval: 30 }).toBeTruthy();
}
async function create(id: string) {
  await app.runtime.create({ id, name: id, role: "Demo / Test", providerId: "fake" });
}
async function start(id: string) {
  await app.runtime.start(id);
  const pid = required(required(app.runtime.get(id)).pid);
  pids.add(pid);
  outputs.set(id, "");
  terminals.set(
    id,
    app.runtime.attach(id, {
      onData: (data) => outputs.set(id, required(outputs.get(id)) + data),
      onExit: () => undefined,
      onReplaced: () => undefined,
    }),
  );
  required(terminals.get(id)).write("STATUS\r");
  await until(() => required(outputs.get(id)).includes(`READY ${id}`));
  return pid;
}
async function command(id: string, line: string, marker: string) {
  outputs.set(id, "");
  required(terminals.get(id)).write(`${line}\r`);
  await until(() => required(outputs.get(id)).includes(marker));
}
async function inbox(id: string) {
  return (await app.mailbox.listMessages(id, "inbox")).messages;
}
async function cleanMailboxes(ids: string[]) {
  await until(async () => {
    for (const id of ids) {
      const outbox = await app.mailbox.listMessages(id, "outbox");
      if (outbox.messages.length || outbox.invalid.length) return false;
      for (const box of ["inbox", "outbox"] as const)
        if (
          (await readdir(await app.workspaces.getMailboxPath(id, box))).some((n) =>
            n.startsWith(".tmp-"),
          )
        )
          return false;
    }
    return app.router.status().inFlight === 0;
  });
  expect(await readdir(join(dir, "hive"))).not.toContain("quarantine");
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-fake-"));
  app = await createApp(
    loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir, NODE_ENV: "test", LOG_LEVEL: "silent" }),
    { logger: false },
  );
  await app.ready();
});
afterEach(async (context) => {
  if (context.task.result?.state === "fail") {
    console.error("Fake fixture failure", app.router.status());
    for (const id of terminals.keys()) {
      console.error(
        id,
        outputs.get(id),
        await app.mailbox.listMessages(id, "inbox"),
        await app.mailbox.listMessages(id, "outbox"),
      );
    }
  }
  for (const terminal of terminals.values()) terminal.detach();
  await app.close();
  expect(app.pty.size).toBe(0);
  expect(app.runtime.size).toBe(0);
  for (const pid of pids) await until(() => !alive(pid));
  pids.clear();
  outputs.clear();
  terminals.clear();
  await rm(dir, { recursive: true, force: true });
});

describe("real fake-agent execution loop", () => {
  it(
    "round-trips through real runtime, PTY, CLI, mailbox and router without a result loop",
    { timeout: 15000 },
    async () => {
      await create("nova");
      await create("atlas");
      await start("nova");
      await start("atlas");
      await command("nova", "PING", "PONG");
      await command("nova", "ECHO hello", "hello");
      await command("nova", "SEND atlas HELLO_ATLAS", "MESSAGE_QUEUED");
      await until(async () => (await inbox("nova")).some((m) => m.body === "ACK:HELLO_ATLAS"));
      const [response] = await inbox("nova");
      expect(response).toMatchObject({
        from: "atlas",
        to: "nova",
        type: "result",
        body: "ACK:HELLO_ATLAS",
      });
      await command("nova", "RESPOND", "> ");
      await command("nova", "CHECK_INBOX", "ACK:HELLO_ATLAS");
      expect(await inbox("nova")).toHaveLength(1);
      expect(await inbox("atlas")).toEqual([]);
      await cleanMailboxes(["nova", "atlas"]);
      expect(app.router.status().delivered).toBe(2);
      expect(app.router.status().quarantined).toBe(0);
      expect(required(app.pty.get(required(app.runtime.get("nova")).sessionId)).cwd).toBe(
        await app.workspaces.getWorkspacePath("nova"),
      );
    },
  );
  it("three agents route independent message/task responses", { timeout: 15000 }, async () => {
    const ids = ["nova", "atlas", "scout"];
    for (const id of ids) {
      await create(id);
      await start(id);
    }
    await Promise.all([
      command("nova", "SEND atlas FROM_NOVA", "MESSAGE_QUEUED"),
      command("atlas", "SEND_TASK scout TASK:abc", "MESSAGE_QUEUED"),
      command("scout", "SEND nova FROM_SCOUT", "MESSAGE_QUEUED"),
    ]);
    for (const [id, from, body] of [
      ["nova", "atlas", "ACK:FROM_NOVA"],
      ["atlas", "scout", "DONE:TASK:abc"],
      ["scout", "nova", "ACK:FROM_SCOUT"],
    ]) {
      // One retried snapshot checks every field. A second immediate read could overlap
      // the router unlinking the published hard link (a legitimate ctime change).
      await expect
        .poll(() => inbox(required(id)), { timeout: 10000, interval: 30 })
        .toEqual([expect.objectContaining({ from, to: id, type: "result", body })]);
    }
    await cleanMailboxes(ids);
    expect(app.router.status().delivered).toBe(6);
  });
  it(
    "a stopped recipient receives backlog and responds after startup",
    { timeout: 15000 },
    async () => {
      await create("nova");
      await create("atlas");
      await start("nova");
      await command("nova", "SEND atlas STOPPED_ATLAS", "MESSAGE_QUEUED");
      await until(async () => (await inbox("atlas")).length === 1);
      expect(app.runtime.get("atlas")).toBeUndefined();
      await start("atlas");
      await until(async () => (await inbox("nova")).some((m) => m.body === "ACK:STOPPED_ATLAS"));
      await cleanMailboxes(["nova", "atlas"]);
    },
  );
  it("restart preserves a deliberately unprocessed inbox", { timeout: 15000 }, async () => {
    await create("nova");
    await create("atlas");
    await start("nova");
    const first = await start("atlas");
    await command("atlas", "AUTO_RESPOND OFF", "AUTO_RESPOND OFF");
    await command("nova", "SEND atlas RESTART_PENDING", "MESSAGE_QUEUED");
    await until(async () => (await inbox("atlas")).length === 1);
    await app.runtime.stop("atlas");
    expect(await inbox("atlas")).toHaveLength(1);
    expect(await start("atlas")).not.toBe(first);
    await until(async () => (await inbox("nova")).some((m) => m.body === "ACK:RESTART_PENDING"));
    await cleanMailboxes(["nova", "atlas"]);
  });
  it(
    "unexpected process death records error and restart processes intact backlog",
    { timeout: 15000 },
    async () => {
      await create("nova");
      await create("atlas");
      await start("nova");
      const pid = await start("atlas");
      await command("atlas", "AUTO_RESPOND OFF", "AUTO_RESPOND OFF");
      await command("nova", "SEND atlas CRASH_PENDING", "MESSAGE_QUEUED");
      await until(async () => (await inbox("atlas")).length === 1);
      process.kill(pid, "SIGKILL");
      await until(() => app.agents.get("atlas")?.status === "error");
      expect(app.runtime.get("atlas")).toBeUndefined();
      expect(await inbox("atlas")).toHaveLength(1);
      await start("atlas");
      await until(async () => (await inbox("nova")).some((m) => m.body === "ACK:CRASH_PENDING"));
      await cleanMailboxes(["nova", "atlas"]);
    },
  );
  it("five real agents concurrently exchange 25 requests and 25 unique results", async () => {
    const ids = ["nova", "atlas", "scout", "michael", "echo"];
    for (const id of ids) {
      await create(id);
      await start(id);
    }
    await Promise.all(
      ids.map(async (id, sender) => {
        const recipient = required(ids[(sender + 1) % ids.length]);
        outputs.set(id, "");
        for (let n = 0; n < 5; n++)
          required(terminals.get(id)).write(`SEND ${recipient} ${id}_${n}\r`);
        await until(() => (required(outputs.get(id)).match(/MESSAGE_QUEUED/g) ?? []).length === 5);
      }),
    );
    for (const [index, id] of ids.entries()) {
      await until(async () => {
        const messages = await inbox(id);
        return messages.length === 5 && messages.every((m) => m.type === "result");
      });
      const messages = await inbox(id);
      expect(messages.map((m) => m.body).sort()).toEqual(
        Array.from({ length: 5 }, (_, n) => `ACK:${id}_${n}`).sort(),
      );
      expect(
        messages.every(
          (m) => m.from === ids[(index + 1) % ids.length] && m.to === id && m.type === "result",
        ),
      ).toBe(true);
      await command(id, "RESPOND", "> ");
    }
    const results = (await Promise.all(ids.map(inbox))).flat();
    expect(new Set(results.map((m) => m.id)).size).toBe(25);
    await cleanMailboxes(ids);
    expect(app.router.status().delivered).toBe(50);
  }, 20000);
  it("invalid recipients and spoof-looking commands never create an outbox envelope", async () => {
    await create("nova");
    await start("nova");
    await command("nova", "SEND absent nope", "MAILBOX_INVALID_RECIPIENT");
    await command("nova", "SEND ../atlas nope", "MAILBOX_INVALID_MESSAGE");
    await command("nova", "sh -c whoami", "UNKNOWN_COMMAND");
    expect((await app.mailbox.listMessages("nova", "outbox")).messages).toEqual([]);
  });
  it("failed response publication retains the incoming envelope for later processing", async () => {
    await create("nova");
    await create("atlas");
    await start("atlas");
    await command("atlas", "AUTO_RESPOND OFF", "AUTO_RESPOND OFF");
    // ACK's prefix would exceed the unchanged shared body limit. This controlled
    // setup tests a publication failure, rather than bypassing the round-trip flow.
    const source = await app.mailbox.writeOutboxMessage("nova", {
      to: "atlas",
      type: "message",
      body: "x".repeat(65536),
    });
    await until(async () => (await inbox("atlas")).length === 1);
    await command("atlas", "RESPOND", "MAILBOX_INVALID_MESSAGE");
    expect(await inbox("atlas")).toEqual([source]);
    expect((await app.mailbox.listMessages("atlas", "outbox")).messages).toEqual([]);
  });
  it("production rejects demo creation and launch without creating a process", async () => {
    const production = await createApp(
      { ...loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir }), isProduction: true },
      { logger: false },
    );
    try {
      expect(
        (
          await production.inject({
            method: "POST",
            url: "/api/agents",
            payload: { name: "prod", role: "test", providerId: "fake" },
          })
        ).statusCode,
      ).toBe(400);
      await production.agents.create({
        id: "disabled",
        name: "disabled",
        role: "test",
        providerId: "fake",
      });
      await expect(production.runtime.start("disabled")).rejects.toMatchObject({
        code: "PROVIDER_UNAVAILABLE",
      });
      expect(production.pty.size).toBe(0);
    } finally {
      await production.close();
    }
  });
});
