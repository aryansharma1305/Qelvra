import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentRegistry } from "../../apps/server/src/agents/agent-registry";
import { AgentWorkspaceManager } from "../../apps/server/src/workspaces/agent-workspace-manager";
import {
  MailboxManager,
  MAILBOX_FILE_MAX_BYTES,
  type MailboxBox,
} from "../../apps/server/src/mailbox";

vi.mock("node:fs/promises", async (importOriginal) => ({
  ...(await importOriginal<typeof fs>()),
}));

function take(values: string[]): string {
  const value = values.shift();
  if (value === undefined) throw new Error("Exhausted test sequence");
  return value;
}
let dir: string;
let registry: AgentRegistry;
let workspaces: AgentWorkspaceManager;
let mailbox: MailboxManager;
const input = { to: "atlas", type: "message" as const, body: "HELLO_ATLAS" };
const id = () => `msg-${randomUUID()}`;
const boxPath = (agent = "nova", box = "outbox") => join(dir, "hive", "agents", agent, box);
beforeEach(async () => {
  dir = await fs.mkdtemp(join(tmpdir(), "qelvra-mailbox-"));
  registry = await AgentRegistry.open({ file: join(dir, "agents.json") });
  workspaces = await AgentWorkspaceManager.open(dir);
  for (const agentId of ["nova", "atlas"]) {
    await workspaces.ensureWorkspace(
      await registry.create({ id: agentId, name: agentId, role: "Test" }),
    );
  }
  mailbox = new MailboxManager({ registry, workspaces });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(dir, { recursive: true, force: true });
});

describe("MailboxManager", () => {
  it("writes complete private JSON only to the stopped sender's outbox", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    expect(message).toMatchObject({ ...input, from: "nova" });
    expect(registry.get("nova")?.status).toBe("stopped");
    expect(await fs.readdir(boxPath())).toEqual([`${message.id}.json`]);
    expect(await fs.readdir(boxPath("atlas", "inbox"))).toEqual([]);
    const path = join(boxPath(), `${message.id}.json`);
    expect(JSON.parse(await fs.readFile(path, "utf8"))).toEqual(message);
    expect((await fs.stat(path)).mode & 0o777).toBe(0o600);
    expect(await mailbox.readMessage("nova", "outbox", message.id)).toEqual(message);
  });
  it("rejects spoofed envelope fields and unknown recipients before writing", async () => {
    for (const fields of [{ from: "michael" }, { id: id() }, { createdAt: "now" }]) {
      await expect(
        mailbox.writeOutboxMessage("nova", { ...input, ...fields }),
      ).rejects.toMatchObject({ code: "MAILBOX_INVALID_MESSAGE" });
    }
    await expect(
      mailbox.writeOutboxMessage("nova", { ...input, to: "unknown" }),
    ).rejects.toMatchObject({ code: "MAILBOX_INVALID_RECIPIENT" });
    await expect(
      mailbox.writeOutboxMessage("nova", { ...input, to: "../atlas" }),
    ).rejects.toMatchObject({ code: "MAILBOX_INVALID_MESSAGE" });
    expect(await fs.readdir(boxPath())).toEqual([]);
  });
  it("refuses missing agents, missing layouts, invalid boxes and path-like ids", async () => {
    await expect(mailbox.listMessages("unknown", "inbox")).rejects.toMatchObject({
      code: "MAILBOX_AGENT_NOT_FOUND",
    });
    await expect(mailbox.listMessages("../nova", "inbox")).rejects.toMatchObject({
      code: "MAILBOX_AGENT_NOT_FOUND",
    });
    await expect(mailbox.listMessages("nova", "../workspace" as MailboxBox)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_BOX",
    });
    await expect(mailbox.readMessage("nova", "outbox", "../memory.md")).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    await fs.rmdir(boxPath());
    await expect(mailbox.writeOutboxMessage("nova", input)).rejects.toMatchObject({
      code: "MAILBOX_AGENT_NOT_FOUND",
    });
  });
  it("returns a controlled missing-message error; repeated acknowledgement is safe", async () => {
    await expect(mailbox.readMessage("nova", "outbox", id())).rejects.toMatchObject({
      code: "MAILBOX_MESSAGE_NOT_FOUND",
    });
    const message = await mailbox.writeOutboxMessage("nova", input);
    expect(await mailbox.acknowledgeMessage("nova", "outbox", message.id)).toBe(true);
    expect(await mailbox.acknowledgeMessage("nova", "outbox", message.id)).toBe(false);
    expect(await fs.readdir(boxPath())).toEqual([]);
  });
  it("reads and explicitly acknowledges a manually staged inbox without delivery", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    await fs.copyFile(
      join(boxPath(), `${message.id}.json`),
      join(boxPath("atlas", "inbox"), `${message.id}.json`),
    );
    expect(await mailbox.readMessage("atlas", "inbox", message.id)).toEqual(message);
    expect(await mailbox.acknowledgeMessage("atlas", "inbox", message.id)).toBe(true);
    expect((await mailbox.listMessages("nova", "outbox")).messages).toEqual([message]);
  });
  it("sorts by timestamp then id, independently of directory order", async () => {
    const ids = [
      "ffffffff-ffff-4fff-8fff-ffffffffffff",
      "00000000-0000-4000-8000-000000000000",
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ];
    const dates = ["2026-10-03T00:00:01Z", "2026-10-03T00:00:01Z", "2026-10-03T00:00:00Z"];
    const writer = new MailboxManager({
      registry,
      workspaces,
      uuid: () => take(ids),
      clock: () => new Date(take(dates)),
    });
    const messages = [];
    for (let i = 0; i < 3; i++) messages.push(await writer.writeOutboxMessage("nova", input));
    expect((await mailbox.listMessages("nova", "outbox")).messages).toEqual([
      messages[2],
      messages[1],
      messages[0],
    ]);
  });
  it("reports malformed, invalid, oversized and non-json entries, ignoring crash temp files", async () => {
    const valid = await mailbox.writeOutboxMessage("nova", input);
    const badJson = id(),
      badSchema = id(),
      oversized = id();
    await fs.writeFile(join(boxPath(), `${badJson}.json`), "{");
    await fs.writeFile(
      join(boxPath(), `${badSchema}.json`),
      JSON.stringify({ ...valid, id: badSchema, type: "execute" }),
    );
    await fs.writeFile(
      join(boxPath(), `${oversized}.json`),
      "x".repeat(MAILBOX_FILE_MAX_BYTES + 1),
    );
    await fs.writeFile(join(boxPath(), "readme.txt"), "text");
    await fs.writeFile(join(boxPath(), "../bad.json"), "untouched");
    await fs.writeFile(join(boxPath(), ".tmp-interrupted"), "half JSON");
    await fs.writeFile(join(boxPath(), "arbitrary.json"), "{}");
    const result = await mailbox.listMessages("nova", "outbox");
    expect(result.messages).toEqual([valid]);
    expect(result.invalid).toHaveLength(5);
    expect(result.invalid).toContainEqual({
      filename: `${oversized}.json`,
      reason: "MAILBOX_MESSAGE_TOO_LARGE",
    });
    expect(result.invalid).toContainEqual({ filename: "readme.txt", reason: "NON_JSON_FILE" });
    expect(result.invalid.map((e) => e.filename)).toEqual(
      [...result.invalid.map((e) => e.filename)].sort(),
    );
    await expect(mailbox.readMessage("nova", "outbox", badJson)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    await expect(mailbox.acknowledgeMessage("nova", "outbox", badSchema)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    expect(await fs.readFile(join(boxPath(), ".tmp-interrupted"), "utf8")).toBe("half JSON");
  });
  it("rejects filename/envelope identity and mailbox ownership mismatches", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const another = id();
    await fs.copyFile(join(boxPath(), `${message.id}.json`), join(boxPath(), `${another}.json`));
    await expect(mailbox.readMessage("nova", "outbox", another)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    await fs.copyFile(
      join(boxPath(), `${message.id}.json`),
      join(boxPath("nova", "inbox"), `${message.id}.json`),
    );
    await expect(mailbox.readMessage("nova", "inbox", message.id)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
  });
  it("rejects symbolic links and directories without reading their targets", async () => {
    const symlinkId = id(),
      directoryId = id();
    await fs.symlink(join(dir, "agents.json"), join(boxPath(), `${symlinkId}.json`));
    await fs.mkdir(join(boxPath(), `${directoryId}.json`));
    expect((await mailbox.listMessages("nova", "outbox")).invalid.map((e) => e.reason)).toEqual([
      "MAILBOX_UNSAFE_ENTRY",
      "MAILBOX_UNSAFE_ENTRY",
    ]);
    await expect(mailbox.acknowledgeMessage("nova", "outbox", symlinkId)).rejects.toMatchObject({
      code: "MAILBOX_UNSAFE_ENTRY",
    });
    await fs.rm(boxPath(), { recursive: true });
    await fs.symlink(join(dir, "hive", "agents", "atlas", "outbox"), boxPath());
    await expect(mailbox.writeOutboxMessage("nova", input)).rejects.toMatchObject({
      code: "MAILBOX_UNSAFE_ENTRY",
    });
    expect(await fs.readdir(boxPath("atlas"))).toEqual([]);
  });
  it("publishes only after the full temporary write and fsync; final is never partial", async () => {
    const original = fs.open;
    let release!: () => void, reached!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    const ready = new Promise<void>((r) => {
      reached = r;
    });
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await original(...args);
      if (String(args[0]).includes(".tmp-")) {
        const write = handle.writeFile.bind(handle);
        vi.spyOn(handle, "writeFile").mockImplementation(async (data, options) => {
          await write("{", options);
          reached();
          await gate;
          await handle.truncate(0);
          // writeFile advances position; overwrite from offset zero after partial injection.
          await handle.write(Buffer.from(String(data)), 0, Buffer.byteLength(String(data)), 0);
        });
      }
      return handle;
    });
    const pending = mailbox.writeOutboxMessage("nova", input);
    try {
      await ready;
      expect((await fs.readdir(boxPath())).every((name) => name.startsWith(".tmp-"))).toBe(true);
      expect(await mailbox.listMessages("nova", "outbox")).toEqual({ messages: [], invalid: [] });
    } finally {
      release();
    }
    const message = await pending;
    expect(await mailbox.readMessage("nova", "outbox", message.id)).toEqual(message);
    expect(await fs.readdir(boxPath())).toEqual([`${message.id}.json`]);
  });
  it.each(["write", "sync", "publish"])(
    "cleans temporary files after %s failure",
    async (stage) => {
      if (stage === "publish")
        vi.spyOn(fs, "link").mockRejectedValueOnce(new Error("disk failure"));
      else {
        const original = fs.open;
        vi.spyOn(fs, "open").mockImplementation(async (...args) => {
          const handle = await original(...args);
          if (String(args[0]).includes(".tmp-")) {
            if (stage === "write")
              vi.spyOn(handle, "writeFile").mockRejectedValueOnce(new Error("disk failure"));
            else vi.spyOn(handle, "sync").mockRejectedValueOnce(new Error("disk failure"));
          }
          return handle;
        });
      }
      await expect(mailbox.writeOutboxMessage("nova", input)).rejects.toMatchObject({
        code: "MAILBOX_WRITE_FAILED",
      });
      expect(await fs.readdir(boxPath())).toEqual([]);
    },
  );
  it("bounds collisions without overwriting and can retry with a fresh id", async () => {
    const uuid = randomUUID();
    const writer = new MailboxManager({ registry, workspaces, uuid: () => uuid });
    const first = await writer.writeOutboxMessage("nova", input);
    await expect(
      writer.writeOutboxMessage("nova", { ...input, body: "overwrite" }),
    ).rejects.toMatchObject({ code: "MAILBOX_DUPLICATE_MESSAGE" });
    expect(await mailbox.readMessage("nova", "outbox", first.id)).toEqual(first);
    const ids = [uuid, randomUUID()];
    const retry = new MailboxManager({ registry, workspaces, uuid: () => take(ids) });
    expect((await retry.writeOutboxMessage("nova", input)).id).not.toBe(first.id);
    expect(await fs.readdir(boxPath())).toHaveLength(2);
  });
  it("50 concurrent writes are unique, complete and leave no temp files", async () => {
    const messages = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        mailbox.writeOutboxMessage("nova", { ...input, body: `message ${i}` }),
      ),
    );
    expect(new Set(messages.map((m) => m.id)).size).toBe(50);
    const result = await mailbox.listMessages("nova", "outbox");
    expect(result.invalid).toEqual([]);
    expect(result.messages).toHaveLength(50);
    expect(new Set(result.messages.map((m) => m.body)).size).toBe(50);
    expect(await fs.readdir(boxPath())).toHaveLength(50);
    expect((await fs.readdir(boxPath())).some((name) => name.startsWith(".tmp-"))).toBe(false);
  });
  it("preserves workspace files and both metadata files", async () => {
    const cwd = await workspaces.getWorkspacePath("nova");
    const files = [
      join(cwd, "code.txt"),
      join(cwd, "..", "memory.md"),
      join(cwd, "..", "agent.md"),
    ];
    for (const file of files) await fs.writeFile(file, `preserved ${file}`);
    const before = await Promise.all(files.map((file) => fs.readFile(file)));
    const message = await mailbox.writeOutboxMessage("nova", input);
    await mailbox.listMessages("nova", "outbox");
    await mailbox.acknowledgeMessage("nova", "outbox", message.id);
    expect(await Promise.all(files.map((file) => fs.readFile(file)))).toEqual(before);
  });
  it("reads a published message while its temporary hard link is removed", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const final = join(boxPath(), `${message.id}.json`);
    const temporary = join(boxPath(), ".tmp-publication");
    await fs.link(final, temporary);
    const original = fs.open;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await original(...args);
      if (String(args[0]).endsWith(`${message.id}.json`)) {
        const read = handle.read.bind(handle);
        vi.spyOn(handle, "read").mockImplementationOnce(async (...readArgs) => {
          await fs.unlink(temporary);
          return read(...readArgs);
        });
      }
      return handle;
    });
    await expect(mailbox.readMessage("nova", "outbox", message.id)).resolves.toEqual(message);
    expect((await fs.stat(final)).nlink).toBe(1);
  });
  it("bounds reads even when a file grows after stat", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const original = fs.open;
    vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      const handle = await original(...args);
      if (String(args[0]).endsWith(`${message.id}.json`)) {
        const stat = await handle.stat();
        vi.spyOn(handle, "stat").mockResolvedValueOnce(
          Object.assign(Object.create(Object.getPrototypeOf(stat)), stat, { size: 1 }),
        );
        await fs.writeFile(String(args[0]), "x".repeat(MAILBOX_FILE_MAX_BYTES + 1));
      }
      return handle;
    });
    await expect(mailbox.readMessage("nova", "outbox", message.id)).rejects.toMatchObject({
      code: "MAILBOX_MESSAGE_TOO_LARGE",
    });
  });
  it("rejects invalid UTF-8 and supports the maximum JSON-escaped body", async () => {
    const message = await mailbox.writeOutboxMessage("nova", {
      ...input,
      body: "\u0001".repeat(64 * 1024),
    });
    expect((await mailbox.readMessage("nova", "outbox", message.id)).body).toBe(message.body);
    await fs.writeFile(join(boxPath(), `${message.id}.json`), Buffer.from([0xff]));
    await expect(mailbox.readMessage("nova", "outbox", message.id)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
  });
  it("never overwrites a collision symlink or its target", async () => {
    const uuid = randomUUID();
    const target = join(dir, "target.txt");
    await fs.writeFile(target, "preserved");
    await fs.symlink(target, join(boxPath(), `msg-${uuid}.json`));
    const writer = new MailboxManager({ registry, workspaces, uuid: () => uuid });
    await expect(writer.writeOutboxMessage("nova", input)).rejects.toMatchObject({
      code: "MAILBOX_DUPLICATE_MESSAGE",
    });
    expect(await fs.readFile(target, "utf8")).toBe("preserved");
    expect(await fs.readdir(boxPath())).toEqual([`msg-${uuid}.json`]);
  });
  it("maps I/O failures without exposing raw filesystem details", async () => {
    vi.spyOn(fs, "readdir").mockRejectedValueOnce(new Error("sensitive path"));
    await expect(mailbox.listMessages("nova", "outbox")).rejects.toMatchObject({
      code: "MAILBOX_READ_FAILED",
      message: "MAILBOX_READ_FAILED",
    });
    const message = await mailbox.writeOutboxMessage("nova", input);
    vi.spyOn(fs, "open").mockRejectedValueOnce(new Error("sensitive path"));
    await expect(mailbox.readMessage("nova", "outbox", message.id)).rejects.toMatchObject({
      code: "MAILBOX_READ_FAILED",
    });
    vi.spyOn(fs, "unlink").mockRejectedValueOnce(new Error("sensitive path"));
    await expect(mailbox.acknowledgeMessage("nova", "outbox", message.id)).rejects.toMatchObject({
      code: "MAILBOX_WRITE_FAILED",
    });
    expect(await mailbox.readMessage("nova", "outbox", message.id)).toEqual(message);
  });
  it("concurrent acknowledgements safely handle an already removed message", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const results = await Promise.all(
      Array.from({ length: 10 }, () => mailbox.acknowledgeMessage("nova", "outbox", message.id)),
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await fs.readdir(boxPath())).toEqual([]);
  });
  it("reports invalid server generation as a controlled error", async () => {
    const writer = new MailboxManager({ registry, workspaces, clock: () => new Date(NaN) });
    await expect(writer.writeOutboxMessage("nova", input)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    expect(await fs.readdir(boxPath())).toEqual([]);
  });
  it("publishes inbox messages idempotently with the exact original envelope", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    expect(await mailbox.deliverInboxMessage("atlas", message)).toBe("created");
    expect(await mailbox.deliverInboxMessage("atlas", message)).toBe("existing");
    expect(await mailbox.readMessage("atlas", "inbox", message.id)).toEqual(message);
    await expect(mailbox.deliverInboxMessage("nova", message)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_MESSAGE",
    });
    await registry.delete("atlas");
    await expect(mailbox.deliverInboxMessage("atlas", message)).rejects.toMatchObject({
      code: "MAILBOX_INVALID_RECIPIENT",
    });
  });
  it("maps corrupt or symlinked destination collisions without overwriting", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const final = join(boxPath("atlas", "inbox"), `${message.id}.json`);
    await fs.writeFile(final, "{broken");
    await expect(mailbox.deliverInboxMessage("atlas", message)).rejects.toMatchObject({
      code: "MAILBOX_DESTINATION_CONFLICT",
    });
    expect(await fs.readFile(final, "utf8")).toBe("{broken");
    await fs.unlink(final);
    await fs.symlink(join(dir, "agents.json"), final);
    const before = await fs.readFile(join(dir, "agents.json"), "utf8");
    await expect(mailbox.deliverInboxMessage("atlas", message)).rejects.toMatchObject({
      code: "MAILBOX_DESTINATION_CONFLICT",
    });
    expect(await fs.readFile(join(dir, "agents.json"), "utf8")).toBe(before);
  });
  it("retains source after destination durability failure and recovers the complete inbox copy", async () => {
    const message = await mailbox.writeOutboxMessage("nova", input);
    const original = fs.open;
    const inboxDirectory = await workspaces.getMailboxPath("atlas", "inbox");
    const opening = vi.spyOn(fs, "open").mockImplementation(async (...args) => {
      if (String(args[0]) === inboxDirectory) throw new Error("directory sync unavailable");
      return original(...args);
    });
    await expect(mailbox.deliverInboxMessage("atlas", message)).rejects.toMatchObject({
      code: "MAILBOX_WRITE_FAILED",
    });
    expect(await mailbox.readMessage("nova", "outbox", message.id)).toEqual(message);
    expect(await mailbox.readMessage("atlas", "inbox", message.id)).toEqual(message);
    await expect(mailbox.deliverInboxMessage("atlas", message)).rejects.toMatchObject({
      code: "MAILBOX_WRITE_FAILED",
    });
    opening.mockRestore();
    expect(await mailbox.deliverInboxMessage("atlas", message)).toBe("existing");
    expect(await mailbox.acknowledgeMessage("nova", "outbox", message.id, message)).toBe(true);
    expect(await fs.readdir(boxPath())).toEqual([]);
  });
});
