import { activityAgentIds } from "./activity-agent-ids.js";
import { mkdir, open, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { dirname } from "node:path";
import { parseActivityEvent, type ActivityEvent, type ActivityType } from "@qelvra/shared";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { ActivityError } from "./activity-errors.js";
export const ACTIVITY_FILE_CAP = 32 * 1024 * 1024;
export const ACTIVITY_MEMORY_LIMIT = 10_000;
export interface ActivityQuery {
  limit?: number;
  cursor?: string | undefined;
  type?: ActivityType | undefined;
  agentId?: string | undefined;
  taskId?: string | undefined;
  entityType?: "agent" | "task" | "message" | "router" | "orchestration" | undefined;
  entityId?: string;
}
/** A single process owns the append queue. No compaction or implicit repair. */
export class ActivityStore {
  private events: ActivityEvent[] = [];
  private queue: Promise<void> = Promise.resolve();
  private closed = false;
  private bytes = 0;
  private retentionTruncated = false;
  private needsNewline = false;
  integrityWarnings = 0;
  private constructor(
    readonly file: string,
    private readonly logger: ServiceLogger,
    private readonly cap: number,
  ) {}
  static async open(file: string, logger: ServiceLogger = silentLogger, cap = ACTIVITY_FILE_CAP) {
    const store = new ActivityStore(file, logger, cap);
    try {
      await mkdir(dirname(file), { recursive: true });
      try {
        store.bytes = (await stat(file)).size;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (store.bytes > cap) {
        store.warn();
        return store;
      }
      if (store.bytes) {
        const handle = await open(file, "r");
        try {
          const last = Buffer.alloc(1);
          await handle.read(last, 0, 1, store.bytes - 1);
          store.needsNewline = last[0] !== 10;
        } finally {
          await handle.close();
        }
        const lines = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
        const ids = new Set<string>();
        for await (const line of lines) {
          let event: ActivityEvent | null = null;
          try {
            event = parseActivityEvent(JSON.parse(line));
          } catch {
            /* Only safe diagnostics; never log corrupt contents. */
          }
          if (!event || ids.has(event.id)) {
            store.warn();
            continue;
          }
          ids.add(event.id);
          store.remember(event);
        }
      }
    } catch {
      store.warn();
      logger.error(
        { errorCode: "ACTIVITY_READ_FAILED" },
        "Could not read activity history; domain services remain available",
      );
    }
    return store;
  }
  private warn() {
    this.integrityWarnings++;
    this.logger.warn(
      { errorCode: "ACTIVITY_INTEGRITY_WARNING" },
      "Activity log contains unreadable or duplicate entries",
    );
  }
  private remember(event: ActivityEvent) {
    this.events.push(event);
    if (this.events.length > ACTIVITY_MEMORY_LIMIT) {
      this.events.shift();
      this.retentionTruncated = true;
    }
  }
  /** Defensive, deduplicated copy of retained observations; no journal reads or writes. */
  getSnapshot() {
    const ids = new Set<string>();
    const events = this.events.filter((event) => {
      if (ids.has(event.id)) return false;
      ids.add(event.id);
      return true;
    });
    let oldestRetainedAt: string | null = null,
      newestRetainedAt: string | null = null;
    for (const event of events) {
      if (!oldestRetainedAt || Date.parse(event.timestamp) < Date.parse(oldestRetainedAt))
        oldestRetainedAt = event.timestamp;
      if (!newestRetainedAt || Date.parse(event.timestamp) > Date.parse(newestRetainedAt))
        newestRetainedAt = event.timestamp;
    }
    return {
      events: structuredClone(events),
      retainedEvents: events.length,
      oldestRetainedAt,
      newestRetainedAt,
      retentionTruncated: this.retentionTruncated,
    };
  }
  deliveredToday(day = new Date().toISOString().slice(0, 10)) {
    return this.events.filter(
      (event) => event.type === "message.delivered" && event.timestamp.startsWith(day),
    ).length;
  }
  isCapped() {
    return this.bytes >= this.cap;
  }
  has(type: ActivityType, entityId: string) {
    return this.events.some((event) => event.type === type && event.entity?.id === entityId);
  }
  append(raw: ActivityEvent): Promise<void> {
    if (this.closed) return Promise.reject(new ActivityError("ACTIVITY_CLOSED"));
    // Clone/validate before queuing so callers cannot mutate a pending append.
    const event = parseActivityEvent(raw);
    if (!event) return Promise.reject(new ActivityError("ACTIVITY_INVALID_EVENT"));
    const work = this.queue.then(async () => {
      const line = `${this.needsNewline ? "\n" : ""}${JSON.stringify(event)}\n`;
      const bytes = Buffer.byteLength(line);
      if (this.bytes + bytes > this.cap) {
        this.bytes = this.cap;
        throw new ActivityError("ACTIVITY_CAP_REACHED");
      }
      try {
        const handle = await open(this.file, "a", 0o600);
        try {
          await handle.writeFile(line);
        } finally {
          await handle.close();
        }
      } catch {
        // An I/O error may have left a prefix. Preserve bytes and separate the next
        // record rather than concatenating JSON onto an uncertain tail.
        try {
          this.bytes = (await stat(this.file)).size;
          this.needsNewline = this.bytes > 0;
        } catch {
          /* Keep conservative accounting. */
        }
        throw new ActivityError("ACTIVITY_WRITE_FAILED");
      }
      this.bytes += bytes;
      this.needsNewline = false;
      this.remember(event);
    });
    this.queue = work.catch(() => undefined);
    return work;
  }
  async flush() {
    await this.queue;
  }
  async close() {
    this.closed = true;
    await this.flush();
  }
  listEvents(options: ActivityQuery = {}) {
    const { limit = 50, cursor, type, agentId, taskId, entityType, entityId } = options;
    let events = [...this.events].reverse();
    if (cursor) {
      const position = events.findIndex((event) => event.id === cursor);
      events = position < 0 ? [] : events.slice(position + 1);
    }
    events = events.filter(
      (event) =>
        (!type || event.type === type) &&
        (!entityType || event.entity?.type === entityType) &&
        (!entityId || event.entity?.id === entityId) &&
        (!taskId ||
          (event.entity?.type === "task" && event.entity.id === taskId) ||
          ("taskId" in event.metadata && event.metadata.taskId === taskId)) &&
        (!agentId || activityAgentIds(event).includes(agentId)),
    );
    const page = events.slice(0, Math.min(100, Math.max(1, limit)));
    return {
      events: structuredClone(page),
      nextCursor: events.length > page.length ? (page.at(-1)?.id ?? null) : null,
    };
  }
}
