import { randomUUID } from "node:crypto";
import {
  ActivityInputSchema,
  type ActivityInput,
  type ActivityEvent,
  type ActivityStatus,
} from "@qelvra/shared";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";
import { ActivityError } from "./activity-errors.js";
import type { ActivityStore } from "./activity-store.js";
export class ActivityPublisher {
  private queue: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<(event: ActivityEvent) => void>();
  private readonly statusListeners = new Set<(status: ActivityStatus) => void>();
  private failures = 0;
  private closed = false;
  private lastTimestamp = 0;
  constructor(
    readonly store: ActivityStore,
    private readonly logger: ServiceLogger = silentLogger,
  ) {
    this.lastTimestamp = Date.parse(store.listEvents({ limit: 1 }).events[0]?.timestamp ?? "") || 0;
  }
  status(): ActivityStatus {
    return {
      degraded: this.failures >= 3 || this.store.integrityWarnings > 0 || this.store.isCapped(),
      consecutiveFailures: this.failures,
      integrityWarnings: this.store.integrityWarnings,
      capped: this.store.isCapped(),
    };
  }
  /** Observational: resolves null on failure; domains never wait or roll back. */
  publish(raw: ActivityInput, once = false): Promise<ActivityEvent | null> {
    const parsed = ActivityInputSchema.safeParse(raw);
    const work = this.queue.then(async () => {
      try {
        if (this.closed) throw new ActivityError("ACTIVITY_CLOSED");
        if (!parsed.success) throw new ActivityError("ACTIVITY_INVALID_EVENT");
        if (once && parsed.data.entity && this.store.has(parsed.data.type, parsed.data.entity.id))
          return null;
        const event: ActivityEvent = {
          ...parsed.data,
          id: `evt-${randomUUID()}`,
          timestamp: new Date(
            (this.lastTimestamp = Math.max(Date.now(), this.lastTimestamp + 1)),
          ).toISOString(),
        };
        await this.store.append(event);
        const recovered = this.failures > 0;
        this.failures = 0;
        for (const listener of this.listeners) {
          try {
            listener(structuredClone(event));
          } catch {
            this.logger.warn(
              { errorCode: "ACTIVITY_SUBSCRIBER_FAILED" },
              "Activity subscriber failed",
            );
          }
        }
        if (recovered) this.notifyStatus();
        return event;
      } catch (error) {
        this.failures++;
        this.logger.error(
          { errorCode: error instanceof ActivityError ? error.code : "ACTIVITY_WRITE_FAILED" },
          "Activity recording failed",
        );
        this.notifyStatus();
        return null;
      }
    });
    this.queue = work.then(() => undefined);
    return work;
  }
  private notifyStatus() {
    for (const listener of this.statusListeners) {
      try {
        listener(this.status());
      } catch {
        /* Transport owns cleanup. */
      }
    }
  }
  subscribe(listener: (event: ActivityEvent) => void) {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }
  subscribeStatus(listener: (status: ActivityStatus) => void) {
    this.statusListeners.add(listener);
    return { dispose: () => this.statusListeners.delete(listener) };
  }
  async flush() {
    await this.queue;
    await this.store.flush();
  }
  async close() {
    await this.flush();
    this.closed = true;
    this.listeners.clear();
    this.statusListeners.clear();
    await this.store.close();
  }
}
