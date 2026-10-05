import { relative, sep } from "node:path";
import { watch, type FSWatcher, type ChokidarOptions } from "chokidar";
import { AgentIdSchema, MessageIdSchema } from "@qelvra/shared";
import type { AgentRegistry } from "../agents/agent-registry.js";
import { MailboxError, type MailboxErrorCode, type MailboxManager } from "../mailbox/index.js";
import type { AgentWorkspaceManager } from "../workspaces/agent-workspace-manager.js";
import { silentLogger, type ServiceLogger } from "../lib/logger.js";

export type RouterEvent = {
  type:
    | "message.detected"
    | "message.queued"
    | "message.delivered"
    | "message.delivery_failed"
    | "message.quarantined"
    | "router.started"
    | "router.stopped"
    | "router.error";
  from?: string;
  messageId?: string;
  to?: string;
  messageType?: string;
  errorCode?: string;
  recovered?: boolean;
};
export function isPermanentDeliveryError(code: MailboxErrorCode): boolean {
  return [
    "MAILBOX_INVALID_MESSAGE",
    "MAILBOX_MESSAGE_TOO_LARGE",
    "MAILBOX_INVALID_RECIPIENT",
    "MAILBOX_DESTINATION_CONFLICT",
    "MAILBOX_UNSAFE_ENTRY",
  ].includes(code);
}
export function isMessageCandidate(filename: string): boolean {
  return !filename.startsWith(".") && filename.endsWith(".json");
}
export interface MessageRouterOptions {
  mailbox: MailboxManager;
  workspaces: AgentWorkspaceManager;
  registry: Pick<AgentRegistry, "get" | "list" | "subscribe">;
  logger?: ServiceLogger;
  onEvent?: (event: RouterEvent) => void;
  onFatal?: () => void;
  /** Server-only watcher seam for initialization/error tests. */
  watcherFactory?: (root: string, options: ChokidarOptions) => FSWatcher;
  controlMailbox?: boolean;
}

/** Filesystem delivery only: no runtime, PTY, shell, provider or transport imports. */
export class MessageRouter {
  private running = false;
  private activeDeliveries = 0;
  private readonly deliverySlots: (() => void)[] = [];
  private startupScan = false;
  private readonly bufferedEvents = new Map<string, { agentId: string; filename: string }>();
  private generation = 0;
  private abortStartup: (() => void) | undefined;
  private watcher: FSWatcher | undefined;
  private subscription: { dispose(): void } | undefined;
  private readonly inFlight = new Map<string, Promise<void>>();
  private readonly blocked = new Set<string>();
  private readonly maintenance = new Set<Promise<void>>();
  private readonly pauses = new Map<NodeJS.Timeout, () => void>();
  private starting: Promise<void> | undefined;
  private stopping: Promise<void> | undefined;
  private delivered = 0;
  private quarantined = 0;
  private readonly logger: ServiceLogger;

  constructor(private readonly options: MessageRouterOptions) {
    this.logger = options.logger ?? silentLogger;
  }
  isRunning(): boolean {
    return this.running;
  }
  status() {
    return {
      running: this.running,
      delivered: this.delivered,
      quarantined: this.quarantined,
      inFlight: this.inFlight.size,
    };
  }

  start(): Promise<void> {
    if (this.stopping) return this.stopping.then(() => this.start());
    if (this.starting) return this.starting;
    if (this.running) return Promise.resolve();
    const starting = this.initialize();
    this.starting = starting;
    void starting
      .finally(() => {
        this.starting = undefined;
      })
      .catch(() => undefined);
    return starting;
  }

  private async initialize(): Promise<void> {
    const generation = ++this.generation;
    this.blocked.clear();
    this.startupScan = true;
    try {
      // Recheck fixed managed parents before giving any path to the watcher.
      for (const agent of this.options.registry.list())
        await this.options.workspaces.getMailboxPath(agent.id, "outbox");
      if (generation !== this.generation) throw new Error("ROUTER_START_CANCELLED");
      if (this.options.controlMailbox)
        await this.options.workspaces.getControlMailboxPath("outbox");
      const root = this.options.controlMailbox
        ? this.options.workspaces.hiveRoot
        : await this.options.workspaces.getAgentsPath();
      const partsOf = (path: string) => {
        const parts = relative(root, path).split(sep).filter(Boolean);
        return this.options.controlMailbox && parts[0] === "agents" ? parts.slice(1) : parts;
      };
      const watcher = (this.options.watcherFactory ?? watch)(root, {
        persistent: true,
        ignoreInitial: true,
        followSymlinks: false,
        depth: this.options.controlMailbox ? 3 : 2,
        atomic: true,
        ignored: (path, stats) => {
          const parts = partsOf(path);
          if (!parts.length) return false;
          if (!AgentIdSchema.safeParse(parts[0]).success) return true;
          if (parts.length === 1) return stats ? !stats.isDirectory() : false;
          if (parts[1] !== "outbox") return true;
          if (parts.length === 2) return stats ? !stats.isDirectory() : false;
          return (
            parts.length !== 3 ||
            !isMessageCandidate(parts[2] ?? "") ||
            (stats ? !stats.isFile() : false)
          );
        },
      });
      this.watcher = watcher;
      const handle = (path: string) => {
        if (!this.running) return;
        const parts = partsOf(path);
        const [agentId, box, filename] = parts;
        if (parts.length === 3 && agentId && box === "outbox" && filename) {
          if (this.startupScan)
            this.bufferedEvents.set(JSON.stringify([agentId, filename]), { agentId, filename });
          else void this.processEntry(agentId, filename);
        }
      };
      watcher.on("add", handle).on("change", handle);
      await new Promise<void>((resolve, reject) => {
        const clear = () => {
          clearTimeout(timeout);
          watcher.off("ready", ready).off("error", failed);
          this.abortStartup = undefined;
        };
        const ready = () => {
          clear();
          resolve();
        };
        const failed = () => {
          clear();
          reject(new Error("ROUTER_WATCH_START_FAILED"));
        };
        const timeout = setTimeout(failed, 5000);
        this.abortStartup = failed;
        watcher.once("ready", ready).once("error", failed);
      });
      if (generation !== this.generation) throw new Error("ROUTER_START_CANCELLED");
      watcher.on("error", () => {
        this.emit({ type: "router.error", errorCode: "ROUTER_WATCH_FAILED" });
        this.logger.error(
          { event: "router.watch_failed", errorCode: "ROUTER_WATCH_FAILED" },
          "Router watcher failed",
        );
        void this.stop().catch(() => undefined);
        this.options.onFatal?.();
      });
      await this.options.workspaces.getAgentsPath();
      if (generation !== this.generation) throw new Error("ROUTER_START_CANCELLED");
      this.running = true;
      this.emit({ type: "router.started" });
      this.subscription = this.options.registry.subscribe((event) => {
        if (event.type === "agent.created") this.track(this.refreshAgent(event.agent.id));
        if (event.type === "agent.deleted") {
          // Keep the bounded tree watcher; preserved/recreated directories remain observable.
          // Deleted owners are gated out before reads, publication and acknowledgement.
          for (const key of this.blocked) {
            if (JSON.parse(key)[0] === event.agent.id) this.blocked.delete(key);
          }
        }
      });
      await this.rescan();
      this.startupScan = false;
      const buffered = [...this.bufferedEvents.values()];
      this.bufferedEvents.clear();
      await Promise.all(
        buffered.map(({ agentId, filename }) => this.processEntry(agentId, filename)),
      );
    } catch (error) {
      this.emit({ type: "router.error", errorCode: "ROUTER_START_FAILED" });
      this.startupScan = false;
      this.bufferedEvents.clear();
      this.running = false;
      this.subscription?.dispose();
      this.subscription = undefined;
      await this.watcher?.close();
      this.watcher = undefined;
      for (const [timer, resolve] of this.pauses) {
        clearTimeout(timer);
        resolve();
      }
      this.pauses.clear();
      await Promise.all([...this.maintenance, ...this.inFlight.values()]);
      throw new Error("ROUTER_START_FAILED", { cause: error });
    }
  }

  private track(work: Promise<void>): void {
    const safe = work.catch(() => {
      this.logger.warn(
        { event: "router.refresh_failed", errorCode: "ROUTER_REFRESH_FAILED" },
        "Router refresh failed",
      );
    });
    this.maintenance.add(safe);
    void safe.finally(() => this.maintenance.delete(safe));
  }
  private async refreshAgent(agentId: string): Promise<void> {
    // Registry creation precedes workspace initialization. No router-owned workspace creation.
    for (const delay of [0, 100, 300, 1000]) {
      if (delay) await this.pause(delay);
      if (!this.running || !this.options.mailbox.hasRecipient(agentId)) return;
      try {
        const path = await this.options.workspaces.getMailboxPath(agentId, "outbox");
        this.watcher?.add(path);
        await this.scanAgent(agentId);
        return;
      } catch {
        /* Bounded wait for runtime's workspace creation to finish. */
      }
    }
    throw new Error("ROUTER_REFRESH_FAILED");
  }

  /** Explicit recovery scan also unlocks exhausted transient sources. */
  async rescan(): Promise<void> {
    if (!this.running) return;
    this.blocked.clear();
    await Promise.all(
      [
        ...this.options.registry.list().map((agent) => agent.id),
        ...(this.options.controlMailbox ? ["system"] : []),
      ].map((id) => this.scanAgent(id)),
    );
  }
  private async scanAgent(agentId: string): Promise<void> {
    if (!this.running || !this.options.mailbox.hasRecipient(agentId)) return;
    const listed = await this.options.mailbox.listMessages(agentId, "outbox");
    // Backlog is sequential within a sender; live events need not preserve this order.
    for (const message of listed.messages) await this.processEntry(agentId, `${message.id}.json`);
    for (const entry of listed.invalid) {
      if (isMessageCandidate(entry.filename)) await this.processEntry(agentId, entry.filename);
    }
  }

  /** Internal deterministic hook used by rescan and watcher; never accepts a filesystem path. */
  processEntry(agentId: string, filename: string): Promise<void> {
    if (
      !this.running ||
      !AgentIdSchema.safeParse(agentId).success ||
      !this.options.mailbox.hasRecipient(agentId) ||
      !isMessageCandidate(filename) ||
      /[/\\\0]/.test(filename)
    )
      return Promise.resolve();
    const key = JSON.stringify([agentId, filename]);
    const current = this.inFlight.get(key);
    if (current) return current;
    if (this.blocked.has(key)) return Promise.resolve();
    // Register the promise synchronously before beginning any async delivery.
    const work = Promise.resolve().then(async () => {
      if (this.activeDeliveries < 4) this.activeDeliveries++;
      else await new Promise<void>((resolve) => this.deliverySlots.push(resolve));
      try {
        await this.deliver(agentId, filename, key);
      } finally {
        const next = this.deliverySlots.shift();
        if (next)
          next(); // Transfer the reserved slot without allowing a fifth reader.
        else this.activeDeliveries--;
      }
    });
    const safe = work
      .catch(() => {
        this.blocked.add(key);
        this.emit({
          type: "message.delivery_failed",
          from: agentId,
          errorCode: "ROUTER_PROCESS_FAILED",
        });
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, safe);
    return safe;
  }
  private async deliver(agentId: string, filename: string, key: string): Promise<void> {
    const id = filename.slice(0, -5);
    const fields: Omit<RouterEvent, "type"> = { from: agentId };
    if (MessageIdSchema.safeParse(id).success) fields.messageId = id;
    this.emit({ type: "message.detected", ...fields });
    let queued = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!this.running || !this.options.mailbox.hasRecipient(agentId)) return;
      try {
        const message = await this.options.mailbox.readMessage(agentId, "outbox", id);
        fields.to = message.to;
        fields.messageType = message.type;
        if (!queued) {
          this.emit({ type: "message.queued", ...fields });
          queued = true;
        }
        if (!this.running || !this.options.mailbox.hasRecipient(agentId)) return;
        const result = await this.options.mailbox.deliverInboxMessage(message.to, message);
        // Stop may arrive after publication: finish acknowledgement safely, never undo inbox.
        if (!this.options.mailbox.hasRecipient(agentId)) return;
        await this.options.mailbox.acknowledgeMessage(agentId, "outbox", id, message);
        this.delivered++;
        this.emit({ type: "message.delivered", ...fields, recovered: result === "existing" });
        return;
      } catch (error) {
        const code = error instanceof MailboxError ? error.code : "MAILBOX_WRITE_FAILED";
        if (code === "MAILBOX_MESSAGE_NOT_FOUND" || !this.options.mailbox.hasRecipient(agentId))
          return;
        if (isPermanentDeliveryError(code)) {
          this.emit({ type: "message.delivery_failed", ...fields, errorCode: code });
          try {
            await this.options.mailbox.quarantineOutboxEntry(agentId, filename, code);
            this.quarantined++;
            this.emit({ type: "message.quarantined", ...fields, errorCode: code });
          } catch {
            this.blocked.add(key);
            this.emit({
              type: "message.delivery_failed",
              ...fields,
              errorCode: "ROUTER_QUARANTINE_FAILED",
            });
          }
          return;
        }
        if (attempt < 2 && this.running) await this.pause(attempt === 0 ? 100 : 300);
        else {
          this.blocked.add(key);
          this.emit({ type: "message.delivery_failed", ...fields, errorCode: code });
          return;
        }
      }
    }
  }
  private emit(event: RouterEvent): void {
    this.logger.info({ event: event.type, ...event }, event.type);
    try {
      this.options.onEvent?.(Object.freeze({ ...event }));
    } catch {
      this.logger.warn({ event: "router.listener_failed" }, "Router listener failed");
    }
  }
  private pause(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pauses.delete(timer);
        resolve();
      }, ms);
      this.pauses.set(timer, resolve);
    });
  }
  stop(): Promise<void> {
    if (this.stopping) return this.stopping;
    const stopping = this.shutdown();
    this.stopping = stopping;
    void stopping
      .finally(() => {
        this.stopping = undefined;
      })
      .catch(() => undefined);
    return stopping;
  }
  private async shutdown(): Promise<void> {
    const wasRunning = this.running;
    this.running = false;
    this.startupScan = false;
    this.bufferedEvents.clear();
    this.generation++;
    this.abortStartup?.();
    this.subscription?.dispose();
    this.subscription = undefined;
    for (const [timer, resolve] of this.pauses) {
      clearTimeout(timer);
      resolve();
    }
    this.pauses.clear();
    const watcher = this.watcher;
    this.watcher = undefined;
    await watcher?.close();
    await this.starting?.catch(() => undefined);
    await Promise.all([...this.maintenance, ...this.inFlight.values()]);
    if (wasRunning) this.emit({ type: "router.stopped" });
  }
}
