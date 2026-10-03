import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, readdir, readFile, writeFile, rm, mkdir, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Message } from "@qelvra/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../../apps/server/src/workspaces/agent-workspace-manager";
import {
  MailboxManager,
  MailboxError,
  MAILBOX_FILE_MAX_BYTES,
} from "../../../apps/server/src/mailbox";
import {
  MessageRouter,
  type RouterEvent,
  type MessageRouterOptions,
} from "../../../apps/server/src/router";
import { createApp } from "../../../apps/server/src/app";
import { loadConfig } from "../../../apps/server/src/config/env";

let dir: string;
let registry: AgentRegistry;
let workspaces: AgentWorkspaceManager;
let mailbox: MailboxManager;
let router: MessageRouter;
let events: RouterEvent[];
const input = { to: "atlas", type: "message" as const, body: "HELLO_ATLAS" };
const path = (agent: string, box: string) => join(dir, "hive", "agents", agent, box);
async function addAgent(id: string) {
  await workspaces.ensureWorkspace(await registry.create({ id, name: id, role: "Test" }));
}
async function waitInbox(agent: string, count: number) {
  await vi.waitFor(
    async () => expect((await mailbox.listMessages(agent, "inbox")).messages).toHaveLength(count),
    { timeout: 5000, interval: 20 },
  );
  await vi.waitFor(() => expect(router.status().inFlight).toBe(0), { timeout: 5000, interval: 20 });
}
async function quarantineEntries(agent = "nova") {
  const root = join(dir, "hive", "quarantine", agent);
  const names = await readdir(root);
  return Promise.all(
    names.map(async (name) => ({
      name,
      files: await readdir(join(root, name)),
      metadata: JSON.parse(await readFile(join(root, name, "error.json"), "utf8")),
      content: await readFile(join(root, name, "message.json"), "utf8"),
    })),
  );
}
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "qelvra-router-"));
  registry = await AgentRegistry.open({ file: join(dir, "agents.json") });
  workspaces = await AgentWorkspaceManager.open(dir);
  for (const id of ["nova", "atlas", "scout", "michael"]) await addAgent(id);
  mailbox = new MailboxManager({ registry, workspaces });
  events = [];
  router = new MessageRouter({
    registry,
    workspaces,
    mailbox,
    onEvent: (event) => events.push(event),
  });
});
afterEach(async () => {
  await router?.stop();
  vi.restoreAllMocks();
  await rm(dir, { recursive: true, force: true });
});

describe("MessageRouter with real chokidar", () => {
  it("automatically delivers unchanged envelopes to stopped recipients", async () => {
    await router.start();
    const message = await mailbox.writeOutboxMessage("nova", input);
    await waitInbox("atlas", 1);
    expect(await mailbox.readMessage("atlas", "inbox", message.id)).toEqual(message);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
    expect(registry.get("atlas")?.status).toBe("stopped");
    expect(events.filter((e) => e.type === "message.delivered")).toHaveLength(1);
    expect(JSON.stringify(events)).not.toContain(input.body);
  });
  it("delivers offline backlog in deterministic order and survives restart", async () => {
    const messages: Message[] = [];
    for (let i = 0; i < 3; i++)
      messages.push(await mailbox.writeOutboxMessage("nova", { ...input, body: `backlog ${i}` }));
    await router.start();
    await waitInbox("atlas", 3);
    expect(events.filter((e) => e.type === "message.delivered").map((e) => e.messageId)).toEqual(
      messages
        .map((m) => m.id)
        .sort((a, b) => {
          const ma = messages.find((m) => m.id === a),
            mb = messages.find((m) => m.id === b);
          return (
            Date.parse(ma?.createdAt ?? "") - Date.parse(mb?.createdAt ?? "") || a.localeCompare(b)
          );
        }),
    );
    await router.stop();
    await mailbox.writeOutboxMessage("nova", { ...input, body: "offline" });
    await router.start();
    await waitInbox("atlas", 4);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("deduplicates repeated events for the same source while it is in flight", async () => {
    await router.start();
    const original = mailbox.deliverInboxMessage.bind(mailbox);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const deliver = vi.spyOn(mailbox, "deliverInboxMessage").mockImplementation(async (...args) => {
      await gate;
      return original(...args);
    });
    const message = await mailbox.writeOutboxMessage("nova", input);
    const pending = Array.from({ length: 20 }, () =>
      router.processEntry("nova", `${message.id}.json`),
    );
    try {
      await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
      expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
      expect(await readdir(path("atlas", "inbox"))).toEqual([]);
    } finally {
      release();
    }
    await Promise.all(pending);
    await waitInbox("atlas", 1);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("recovers the crash window after inbox publication but before source acknowledgement", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    await mailbox.deliverInboxMessage("atlas", message);
    expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
    await router.start();
    await waitInbox("atlas", 1);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: "message.delivered",
        recovered: true,
        messageId: message.id,
      }),
    );
  });
  it("keeps source after exhausted ack failures and recovers without duplicate destination", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const ack = vi
      .spyOn(mailbox, "acknowledgeMessage")
      .mockRejectedValue(new MailboxError("MAILBOX_WRITE_FAILED"));
    await router.start();
    expect(ack).toHaveBeenCalledTimes(3);
    expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
    expect((await mailbox.listMessages("atlas", "inbox")).messages).toEqual([message]);
    ack.mockRestore();
    await router.stop();
    await router.start();
    await waitInbox("atlas", 1);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("quarantines spoofed, malformed and invalid-id files while continuing valid deliveries", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    await writeFile(
      join(path("nova", "outbox"), `${message.id}.json`),
      JSON.stringify({ ...message, from: "michael" }),
    );
    await writeFile(join(path("nova", "outbox"), "malformed.json"), "{bad json");
    await mailbox.writeOutboxMessage("nova", input);
    await router.start();
    await waitInbox("atlas", 1);
    expect(router.status().quarantined).toBe(2);
    const failed = await quarantineEntries();
    expect(failed).toHaveLength(2);
    for (const entry of failed) {
      expect(entry.name).toMatch(/^[0-9a-f-]{36}$/);
      expect(entry.files.sort()).toEqual(["error.json", "message.json"]);
      expect(entry.metadata.errorCode).toBe("MAILBOX_INVALID_MESSAGE");
    }
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("quarantines a deleted recipient and preserves deleted sender workspaces", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    await registry.delete("atlas");
    await router.start();
    expect(router.status().quarantined).toBe(1);
    expect((await quarantineEntries())[0]?.metadata.errorCode).toBe("MAILBOX_INVALID_RECIPIENT");
    expect(await readdir(path("atlas", "inbox"))).toEqual([]);
    await registry.delete("nova");
    await writeFile(join(path("nova", "outbox"), `${message.id}.json`), JSON.stringify(message));
    await router.rescan();
    expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
  });
  it("routes new agents automatically, including recreated IDs with preserved backlog", async () => {
    await router.start();
    await addAgent("pixel");
    const message = await mailbox.writeOutboxMessage("pixel", input);
    await waitInbox("atlas", 1);
    expect((await mailbox.listMessages("atlas", "inbox")).messages).toEqual([message]);
    await registry.delete("pixel");
    await vi.waitFor(() => expect(router.status().inFlight).toBe(0));
    const pending = { ...message, id: `msg-${randomUUID()}`, body: "preserved backlog" };
    await writeFile(join(path("pixel", "outbox"), `${pending.id}.json`), JSON.stringify(pending));
    await addAgent("pixel");
    await waitInbox("atlas", 2);
    expect(await readdir(path("pixel", "outbox"))).toEqual([]);
  });
  it("routes 50 concurrent messages and traffic from multiple senders without duplicates", async () => {
    await router.start();
    const messages = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        mailbox.writeOutboxMessage("nova", { ...input, body: `${i}` }),
      ),
    );
    const other = await Promise.all([
      mailbox.writeOutboxMessage("scout", input),
      mailbox.writeOutboxMessage("michael", { ...input, to: "nova" }),
      mailbox.writeOutboxMessage("atlas", { ...input, to: "scout" }),
    ]);
    await Promise.all([waitInbox("atlas", 51), waitInbox("nova", 1), waitInbox("scout", 1)]);
    expect(new Set(messages.map((m) => m.id)).size).toBe(50);
    expect(await mailbox.readMessage("nova", "inbox", other[1]?.id ?? "")).toEqual(other[1]);
    expect(await mailbox.readMessage("scout", "inbox", other[2]?.id ?? "")).toEqual(other[2]);
    for (const id of ["nova", "atlas", "scout", "michael"]) {
      expect(await readdir(path(id, "outbox"))).toEqual([]);
      expect((await readdir(path(id, "inbox"))).every((name) => !name.startsWith(".tmp-"))).toBe(
        true,
      );
    }
    expect(router.status().delivered).toBe(53);
  }, 15000);
  it("never overwrites conflicting destination content", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const conflicting = { ...message, body: "existing inbox message" };
    await writeFile(
      join(path("atlas", "inbox"), `${message.id}.json`),
      JSON.stringify(conflicting),
    );
    await router.start();
    expect(await mailbox.readMessage("atlas", "inbox", message.id)).toEqual(conflicting);
    expect((await quarantineEntries())[0]?.metadata.errorCode).toBe("MAILBOX_DESTINATION_CONFLICT");
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("retries transient failures three times, preserves exhausted sources and recovers on rescan", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const deliver = vi
      .spyOn(mailbox, "deliverInboxMessage")
      .mockRejectedValue(new MailboxError("MAILBOX_WRITE_FAILED"));
    await router.start();
    expect(deliver).toHaveBeenCalledTimes(3);
    expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
    await router.processEntry("nova", `${message.id}.json`);
    expect(deliver).toHaveBeenCalledTimes(3);
    deliver.mockRestore();
    await router.rescan();
    await waitInbox("atlas", 1);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("succeeds after one transient failure", async () => {
    await mailbox.writeOutboxMessage("nova", input);
    const deliver = vi
      .spyOn(mailbox, "deliverInboxMessage")
      .mockRejectedValueOnce(new MailboxError("MAILBOX_WRITE_FAILED"));
    await router.start();
    await waitInbox("atlas", 1);
    expect(deliver).toHaveBeenCalledTimes(2);
  });
  it("ignores hidden/temp/non-json files and never watches workspace content", async () => {
    await router.start();
    for (const filename of [".hidden.json", ".tmp-message.json", "message.json.swp", "notes.md"])
      await writeFile(join(path("nova", "outbox"), filename), "ignored");
    await writeFile(join(path("nova", "workspace"), "message.json"), "ignored");
    await router.rescan();
    expect(router.status().quarantined).toBe(0);
    expect((await mailbox.listMessages("atlas", "inbox")).messages).toEqual([]);
    expect(await readdir(path("nova", "outbox"))).toHaveLength(4);
    expect(await readFile(join(path("nova", "workspace"), "message.json"), "utf8")).toBe("ignored");
  });
  it("rejects unsafe quarantine parents and preserves source rather than escaping DATA_DIR", async () => {
    const outside = join(dir, "outside");
    await mkdir(outside);
    await symlink(outside, join(dir, "hive", "quarantine"));
    await writeFile(join(path("nova", "outbox"), "invalid.json"), "invalid");
    await router.start();
    expect(await readdir(outside)).toEqual([]);
    expect(await readdir(path("nova", "outbox"))).toEqual(["invalid.json"]);
    expect(events).toContainEqual(
      expect.objectContaining({ errorCode: "ROUTER_QUARANTINE_FAILED" }),
    );
    await expect(
      mailbox.quarantineOutboxEntry("nova", "../../escape.json", "ERROR"),
    ).rejects.toMatchObject({ code: "MAILBOX_INVALID_MESSAGE" });
  });
  it("stop waits for publication in flight and leaves other backlog recoverable", async () => {
    const messages: Message[] = [];
    for (let i = 0; i < 5; i++) messages.push(await mailbox.writeOutboxMessage("nova", input));
    const original = mailbox.deliverInboxMessage.bind(mailbox);
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const deliver = vi
      .spyOn(mailbox, "deliverInboxMessage")
      .mockImplementationOnce(async (...args) => {
        await gate;
        return original(...args);
      });
    const starting = router.start();
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(1));
    const stopping = router.stop();
    release();
    await Promise.all([starting, stopping]);
    expect(router.isRunning()).toBe(false);
    expect(router.status().inFlight).toBe(0);
    expect((await mailbox.listMessages("atlas", "inbox")).messages).toHaveLength(1);
    expect(await readdir(path("nova", "outbox"))).toHaveLength(4);
    deliver.mockRestore();
    await router.start();
    await waitInbox("atlas", 5);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
  });
  it("fails startup and closes resources when watcher initialization fails", async () => {
    const fake = Object.assign(new EventEmitter(), { close: vi.fn(async () => undefined) });
    router = new MessageRouter({
      mailbox,
      registry,
      workspaces,
      watcherFactory: () => {
        queueMicrotask(() => fake.emit("error", new Error("watch failed")));
        return fake as unknown as ReturnType<NonNullable<MessageRouterOptions["watcherFactory"]>>;
      },
    });
    await expect(router.start()).rejects.toThrow("ROUTER_START_FAILED");
    expect(router.isRunning()).toBe(false);
    expect(fake.close).toHaveBeenCalled();
  });
  it("integrates with Fastify startup, automatic delivery and close without PTYs", async () => {
    const app = await createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir }), {
      logger: false,
    });
    try {
      await app.ready();
      expect(app.router.isRunning()).toBe(true);
      const message = await app.mailbox.writeOutboxMessage("nova", input);
      await vi.waitFor(
        async () =>
          expect((await app.mailbox.listMessages("atlas", "inbox")).messages).toEqual([message]),
        { timeout: 5000 },
      );
      expect(app.pty.size).toBe(0);
      expect(app.runtime.size).toBe(0);
    } finally {
      await app.close();
    }
    expect(app.router.isRunning()).toBe(false);
    expect(app.router.status().inFlight).toBe(0);
  });
  it("quarantines oversized and control-character filenames using generated paths", async () => {
    const id = `msg-${randomUUID()}`;
    const oversized = "x".repeat(MAILBOX_FILE_MAX_BYTES + 1);
    await writeFile(join(path("nova", "outbox"), `${id}.json`), oversized);
    await writeFile(join(path("nova", "outbox"), "bad\nname.json"), "invalid");
    await router.start();
    const entries = await quarantineEntries();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.metadata.originalFilename)).toContain("bad_name.json");
    expect(
      entries.find((entry) => entry.metadata.errorCode === "MAILBOX_MESSAGE_TOO_LARGE")?.content,
    ).toBe(oversized);
    expect(await readdir(path("nova", "outbox"))).toEqual([]);
    expect(await readdir(path("atlas", "inbox"))).toEqual([]);
  });
  it("does not acknowledge a different source envelope than the delivered snapshot", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    await writeFile(
      join(path("nova", "outbox"), `${message.id}.json`),
      JSON.stringify({ ...message, body: "changed" }),
    );
    await expect(
      mailbox.acknowledgeMessage("nova", "outbox", message.id, message),
    ).rejects.toMatchObject({ code: "MAILBOX_INVALID_MESSAGE" });
    expect(await readdir(path("nova", "outbox"))).toEqual([`${message.id}.json`]);
  });
  it("cancels startup before watcher ready without leaving timers or a running watcher", async () => {
    const fake = Object.assign(new EventEmitter(), { close: vi.fn(async () => undefined) });
    const factory = vi.fn(
      () => fake as unknown as ReturnType<NonNullable<MessageRouterOptions["watcherFactory"]>>,
    );
    router = new MessageRouter({ mailbox, registry, workspaces, watcherFactory: factory });
    const starting = router.start().catch((error) => error as Error);
    await vi.waitFor(() => expect(factory).toHaveBeenCalledTimes(1));
    await router.stop();
    expect(await starting).toMatchObject({ message: "ROUTER_START_FAILED" });
    expect(fake.close).toHaveBeenCalled();
    expect(router.isRunning()).toBe(false);
  });
  it("reports fatal watcher failure and stops the router", async () => {
    const fake = Object.assign(new EventEmitter(), { close: vi.fn(async () => undefined) });
    const fatal = vi.fn();
    router = new MessageRouter({
      mailbox,
      registry,
      workspaces,
      onFatal: fatal,
      watcherFactory: () => {
        queueMicrotask(() => fake.emit("ready"));
        return fake as unknown as ReturnType<NonNullable<MessageRouterOptions["watcherFactory"]>>;
      },
    });
    await router.start();
    fake.emit("error", new Error("watch failed"));
    await router.stop();
    expect(fatal).toHaveBeenCalledTimes(1);
    expect(fake.close).toHaveBeenCalled();
    expect(router.isRunning()).toBe(false);
  });
  it("fails Fastify readiness rather than serving with an unsafe outbox", async () => {
    const app = await createApp(loadConfig({ DATA_DIR: dir, WORKSPACE_ROOT: dir }), {
      logger: false,
    });
    await rm(path("nova", "outbox"), { recursive: true });
    await writeFile(path("nova", "outbox"), "invalid directory");
    try {
      await expect(app.ready()).rejects.toThrow("ROUTER_START_FAILED");
    } finally {
      await app.close();
    }
    expect(app.router.isRunning()).toBe(false);
    expect(app.pty.size).toBe(0);
  });
  it("buffers delayed watcher events until the ordered startup backlog scan completes", async () => {
    const messages = await Promise.all([
      mailbox.writeOutboxMessage("nova", { ...input, body: "first" }),
      mailbox.writeOutboxMessage("nova", { ...input, body: "second" }),
    ]);
    const expected = (await mailbox.listMessages("nova", "outbox")).messages;
    const later = expected[1];
    if (!later) throw new Error("Missing backlog fixture");
    const fake = Object.assign(new EventEmitter(), { close: vi.fn(async () => undefined) });
    router = new MessageRouter({
      mailbox,
      registry,
      workspaces,
      onEvent: (event) => events.push(event),
      watcherFactory: () => {
        queueMicrotask(() => fake.emit("ready"));
        return fake as unknown as ReturnType<NonNullable<MessageRouterOptions["watcherFactory"]>>;
      },
    });
    const originalList = mailbox.listMessages.bind(mailbox);
    const outbox = await workspaces.getMailboxPath("nova", "outbox");
    vi.spyOn(mailbox, "listMessages").mockImplementationOnce(async (...args) => {
      fake.emit("add", join(outbox, `${later.id}.json`));
      expect(router.status().inFlight).toBe(0);
      return originalList(...args);
    });
    await router.start();
    expect(
      events.filter((event) => event.type === "message.delivered").map((event) => event.messageId),
    ).toEqual(expected.map((message) => message.id));
    expect((await mailbox.listMessages("atlas", "inbox")).messages).toHaveLength(messages.length);
  });
});
