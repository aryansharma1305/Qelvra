import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import {
  AgentIdSchema,
  MessageIdSchema,
  MessageSchema,
  OutboxMessageInputSchema,
  type Message,
  type OutboxMessageInput,
} from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import { publishFileExclusive, syncDirectory } from "../lib/atomic-publish.js";
import { messagesEqual } from "./message-integrity.js";
import { MailboxError } from "./errors.js";
import type { MailboxBox, MailboxList } from "./types.js";

/** Covers worst-case JSON escaping of a 64 KiB body, plus bounded envelope fields. */
export const MAILBOX_FILE_MAX_BYTES = 64 * 1024 * 6 + 1024;
function fsCode(error: unknown): string | undefined {
  return (error as NodeJS.ErrnoException)?.code;
}

export interface MailboxManagerOptions {
  workspaces: AgentWorkspaceManager;
  registry: Pick<AgentRegistry, "get">;
  /** Server-only deterministic test seams; callers cannot select ids or timestamps. */
  uuid?: () => string;
  clock?: () => Date;
}

/** Data only. No runtime, watchers, delivery, execution or network endpoints. */
export class MailboxManager {
  private readonly acknowledgements = new Map<string, Promise<unknown>>();
  constructor(private readonly options: MailboxManagerOptions) {}

  async writeOutboxMessage(agentId: string, input: OutboxMessageInput): Promise<Message> {
    const directory = await this.directory(agentId, "outbox");
    const parsed = OutboxMessageInputSchema.safeParse(input);
    if (!parsed.success) throw new MailboxError("MAILBOX_INVALID_MESSAGE");
    if (!this.options.registry.get(parsed.data.to)) {
      throw new MailboxError("MAILBOX_INVALID_RECIPIENT");
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      let message: Message;
      try {
        message = MessageSchema.parse({
          ...parsed.data,
          from: agentId,
          id: `msg-${(this.options.uuid ?? randomUUID)()}`,
          createdAt: (this.options.clock ?? (() => new Date()))().toISOString(),
        });
      } catch (error) {
        throw new MailboxError("MAILBOX_INVALID_MESSAGE", { cause: error });
      }
      try {
        await publishFileExclusive(
          directory,
          `${message.id}.json`,
          `${JSON.stringify(message)}\n`,
          () => this.directory(agentId, "outbox"),
        );
        return message;
      } catch (error) {
        if (fsCode(error) === "EEXIST") continue;
        if (error instanceof MailboxError) throw error;
        throw new MailboxError("MAILBOX_WRITE_FAILED", { cause: error });
      }
    }
    throw new MailboxError("MAILBOX_DUPLICATE_MESSAGE");
  }

  /** Router-internal: same envelope, exclusive durable publication and collision recovery. */
  async deliverInboxMessage(recipientId: string, input: Message): Promise<"created" | "existing"> {
    const parsed = MessageSchema.safeParse(input);
    if (!parsed.success || parsed.data.to !== recipientId)
      throw new MailboxError("MAILBOX_INVALID_MESSAGE");
    if (!this.options.registry.get(recipientId))
      throw new MailboxError("MAILBOX_INVALID_RECIPIENT");
    const message = parsed.data;
    const directory = await this.directory(recipientId, "inbox");
    try {
      await publishFileExclusive(
        directory,
        `${message.id}.json`,
        `${JSON.stringify(message)}\n`,
        async () => {
          if (!this.options.registry.get(recipientId))
            throw new MailboxError("MAILBOX_INVALID_RECIPIENT");
          await this.directory(recipientId, "inbox");
        },
        true,
      );
      return "created";
    } catch (error) {
      if (fsCode(error) === "EEXIST") {
        let existing: Message;
        try {
          existing = await this.readMessage(recipientId, "inbox", message.id);
        } catch (readError) {
          if (
            readError instanceof MailboxError &&
            [
              "MAILBOX_INVALID_MESSAGE",
              "MAILBOX_MESSAGE_TOO_LARGE",
              "MAILBOX_UNSAFE_ENTRY",
            ].includes(readError.code)
          ) {
            throw new MailboxError("MAILBOX_DESTINATION_CONFLICT");
          }
          throw readError;
        }
        if (!messagesEqual(existing, message))
          throw new MailboxError("MAILBOX_DESTINATION_CONFLICT");
        try {
          await this.directory(recipientId, "inbox");
          const handle = await open(
            join(directory, `${message.id}.json`),
            constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
          );
          try {
            const stat = await handle.stat();
            if (!stat.isFile() || stat.size > MAILBOX_FILE_MAX_BYTES)
              throw new MailboxError("MAILBOX_DESTINATION_CONFLICT");
            await handle.sync();
          } finally {
            await handle.close();
          }
          await syncDirectory(directory);
        } catch (syncError) {
          if (syncError instanceof MailboxError) throw syncError;
          throw new MailboxError("MAILBOX_WRITE_FAILED", { cause: syncError });
        }
        return "existing";
      }
      if (error instanceof MailboxError) throw error;
      throw new MailboxError("MAILBOX_WRITE_FAILED", { cause: error });
    }
  }

  /** Preserve invalid regular files without parsing or reading their potentially huge body. */
  async quarantineOutboxEntry(agentId: string, filename: string, errorCode: string): Promise<void> {
    if (!filename || filename === "." || filename === ".." || /[/\\\0]/.test(filename))
      throw new MailboxError("MAILBOX_INVALID_MESSAGE");
    const sourceDirectory = await this.directory(agentId, "outbox");
    const source = join(sourceDirectory, filename);
    try {
      const entry = await lstat(source);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
      const handle = await open(
        source,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.ino !== entry.ino || stat.dev !== entry.dev)
          throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
        await handle.sync();
      } finally {
        await handle.close();
      }
      const quarantine = await this.options.workspaces.createQuarantineDirectory(agentId);
      const check = () => this.options.workspaces.checkQuarantineDirectory(agentId, quarantine);
      const metadata = {
        agentId,
        originalFilename: filename.replace(/[\p{Cc}\p{Cf}]/gu, "_").slice(0, 255),
        errorCode,
        quarantinedAt: new Date().toISOString(),
      };
      await publishFileExclusive(
        quarantine,
        "error.json",
        `${JSON.stringify(metadata)}\n`,
        check,
        true,
      );
      await this.directory(agentId, "outbox");
      await check();
      const destination = join(quarantine, "message.json");
      await link(source, destination);
      const archived = await lstat(destination);
      if (
        !archived.isFile() ||
        archived.isSymbolicLink() ||
        archived.ino !== entry.ino ||
        archived.dev !== entry.dev
      ) {
        await unlink(destination);
        throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
      }
      await syncDirectory(quarantine);
      const after = await lstat(source);
      if (after.ino !== entry.ino || after.dev !== entry.dev)
        throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
      await unlink(source);
    } catch (error) {
      if (error instanceof MailboxError) throw error;
      if (fsCode(error) === "ENOENT") throw new MailboxError("MAILBOX_MESSAGE_NOT_FOUND");
      throw new MailboxError("MAILBOX_WRITE_FAILED", { cause: error });
    }
  }

  async readMessage(agentId: string, box: MailboxBox, messageId: string): Promise<Message> {
    const directory = await this.directory(agentId, box);
    this.validateMessageId(messageId);
    const path = join(directory, `${messageId}.json`);
    try {
      const entry = await lstat(path);
      if (!entry.isFile() || entry.isSymbolicLink()) throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
      const handle = await open(
        path,
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.ino !== entry.ino || stat.dev !== entry.dev) {
          throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
        }
        if (stat.size > MAILBOX_FILE_MAX_BYTES) throw new MailboxError("MAILBOX_MESSAGE_TOO_LARGE");
        // Bounded even if another process grows the file after stat.
        const buffer = Buffer.alloc(MAILBOX_FILE_MAX_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
          const { bytesRead } = await handle.read(buffer, length, buffer.length - length, null);
          if (!bytesRead) break;
          length += bytesRead;
        }
        if (length > MAILBOX_FILE_MAX_BYTES) throw new MailboxError("MAILBOX_MESSAGE_TOO_LARGE");
        const after = await handle.stat();
        if (
          after.size !== length ||
          after.mtimeMs !== stat.mtimeMs ||
          after.ctimeMs !== stat.ctimeMs
        ) {
          throw new MailboxError("MAILBOX_READ_FAILED");
        }
        let data: unknown;
        try {
          data = JSON.parse(
            new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, length)),
          );
        } catch (error) {
          throw new MailboxError("MAILBOX_INVALID_MESSAGE", { cause: error });
        }
        const parsed = MessageSchema.safeParse(data);
        if (
          !parsed.success ||
          parsed.data.id !== messageId ||
          (box === "outbox" ? parsed.data.from : parsed.data.to) !== agentId
        ) {
          throw new MailboxError("MAILBOX_INVALID_MESSAGE");
        }
        return parsed.data;
      } finally {
        await handle.close();
      }
    } catch (error) {
      if (error instanceof MailboxError) throw error;
      if (fsCode(error) === "ENOENT") throw new MailboxError("MAILBOX_MESSAGE_NOT_FOUND");
      if (fsCode(error) === "ELOOP") throw new MailboxError("MAILBOX_UNSAFE_ENTRY");
      throw new MailboxError("MAILBOX_READ_FAILED", { cause: error });
    }
  }

  async listMessages(agentId: string, box: MailboxBox): Promise<MailboxList> {
    const directory = await this.directory(agentId, box);
    let entries: string[];
    try {
      entries = (await readdir(directory)).sort();
    } catch (error) {
      throw new MailboxError("MAILBOX_READ_FAILED", { cause: error });
    }
    const result: MailboxList = { messages: [], invalid: [] };
    for (const filename of entries) {
      if (filename.startsWith(".tmp-")) continue;
      if (!filename.endsWith(".json")) {
        result.invalid.push({ filename, reason: "NON_JSON_FILE" });
        continue;
      }
      const id = filename.slice(0, -5);
      try {
        result.messages.push(await this.readMessage(agentId, box, id));
      } catch (error) {
        if (!(error instanceof MailboxError)) throw error;
        // Another consumer may acknowledge between enumeration and read.
        if (error.code !== "MAILBOX_MESSAGE_NOT_FOUND") {
          result.invalid.push({ filename, reason: error.code });
        }
      }
    }
    result.messages.sort(
      (a, b) =>
        Date.parse(a.createdAt) - Date.parse(b.createdAt) ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    return result;
  }

  /** Explicit deletion, including manual outbox removal. Missing messages return false. */
  acknowledgeMessage(
    agentId: string,
    box: MailboxBox,
    messageId: string,
    expected?: Message,
  ): Promise<boolean> {
    const key = JSON.stringify([agentId, box, messageId]);
    const previous = this.acknowledgements.get(key) ?? Promise.resolve();
    const result = previous.then(
      () => this.acknowledgeOnce(agentId, box, messageId, expected),
      () => this.acknowledgeOnce(agentId, box, messageId, expected),
    );
    const tail = result.catch(() => undefined);
    this.acknowledgements.set(key, tail);
    void tail.then(() => {
      if (this.acknowledgements.get(key) === tail) this.acknowledgements.delete(key);
    });
    return result;
  }

  private async acknowledgeOnce(
    agentId: string,
    box: MailboxBox,
    messageId: string,
    expected?: Message,
  ): Promise<boolean> {
    try {
      const current = await this.readMessage(agentId, box, messageId);
      if (expected && !messagesEqual(current, expected))
        throw new MailboxError("MAILBOX_INVALID_MESSAGE");
      const directory = await this.directory(agentId, box);
      await unlink(join(directory, `${messageId}.json`));
      return true;
    } catch (error) {
      if (error instanceof MailboxError && error.code === "MAILBOX_MESSAGE_NOT_FOUND") return false;
      if (fsCode(error) === "ENOENT") return false;
      if (error instanceof MailboxError) throw error;
      throw new MailboxError("MAILBOX_WRITE_FAILED", { cause: error });
    }
  }

  private validateMessageId(id: string) {
    if (!MessageIdSchema.safeParse(id).success) throw new MailboxError("MAILBOX_INVALID_MESSAGE");
  }

  private async directory(agentId: string, box: MailboxBox): Promise<string> {
    if (box !== "inbox" && box !== "outbox") throw new MailboxError("MAILBOX_INVALID_BOX");
    if (!AgentIdSchema.safeParse(agentId).success || !this.options.registry.get(agentId)) {
      throw new MailboxError("MAILBOX_AGENT_NOT_FOUND");
    }
    try {
      return await this.options.workspaces.getMailboxPath(agentId, box);
    } catch (error) {
      throw new MailboxError(
        fsCode(error) === "ENOENT" ? "MAILBOX_AGENT_NOT_FOUND" : "MAILBOX_UNSAFE_ENTRY",
        { cause: error },
      );
    }
  }
}
