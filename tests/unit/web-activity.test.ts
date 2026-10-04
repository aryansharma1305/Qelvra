import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTIVITY_TYPES, ActivityEventSchema, type ActivityEvent } from "@qelvra/shared";
import { connectActivityStream } from "../../apps/web/src/features/activity/activity-client";
import { mergeActivity } from "../../apps/web/src/features/activity/use-activity";
import {
  formatActivityEvent,
  relativeActivityTime,
} from "../../apps/web/src/features/activity/format-activity";
import { listActivity } from "../../apps/web/src/lib/api";
function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing activity fixture");
  return value;
}
const event = (n = 0): ActivityEvent => ({
  type: "agent.started",
  entity: { type: "agent", id: "nova" },
  metadata: { agentName: "Nova" },
  id: `evt-${randomUUID()}`,
  timestamp: new Date(Date.UTC(2026, 9, 4, 0, 0, n)).toISOString(),
});
const status = { degraded: false, consecutiveFailures: 0, integrityWarnings: 0, capped: false };
class Socket {
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn(() => this.onclose?.());
  send(value: unknown) {
    this.onmessage?.({ data: JSON.stringify(value) });
  }
}
afterEach(() => vi.useRealTimers());
describe("activity client and formatter", () => {
  it("validates REST responses and serializes filters centrally", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ events: [event()], nextCursor: null, status })),
      );
    expect(
      (await listActivity({ limit: 5, type: "agent.started", agentId: "nova" }, { fetchImpl }))
        .events,
    ).toHaveLength(1);
    expect(required(fetchImpl.mock.calls[0])[0]).toContain(
      "limit=5&type=agent.started&agentId=nova",
    );
    fetchImpl.mockResolvedValueOnce(
      new Response(JSON.stringify({ events: [{ body: "PRIVATE" }], nextCursor: null, status })),
    );
    await expect(listActivity({}, { fetchImpl })).rejects.toMatchObject({
      kind: "invalid_response",
    });
  });
  it("fetches latest on every reconnect, validates stream frames and bounds retry/disposal", async () => {
    vi.useFakeTimers();
    const sockets: Socket[] = [];
    const snapshots = vi.fn();
    const onEvent = vi.fn();
    const onState = vi.fn();
    const fetchLatest = vi.fn().mockResolvedValue({ events: [event()], nextCursor: null, status });
    const client = connectActivityStream({
      onSnapshot: snapshots,
      onEvent,
      onStatus: vi.fn(),
      onState,
      fetchLatest,
      retryDelays: [1, 2],
      socketFactory: () => {
        const socket = new Socket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
    });
    required(sockets[0]).onopen?.();
    await Promise.resolve();
    expect(fetchLatest).toHaveBeenCalledTimes(1);
    expect(snapshots).toHaveBeenCalledTimes(1);
    required(sockets[0]).send({ type: "activity.event", event: event() });
    expect(onEvent).toHaveBeenCalledTimes(1);
    required(sockets[0]).send({ type: "activity.event", event: { ...event(), body: "PRIVATE" } });
    expect(onEvent).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    required(sockets[1]).onopen?.();
    await Promise.resolve();
    expect(fetchLatest).toHaveBeenCalledTimes(2);
    required(sockets[1]).close();
    await vi.advanceTimersByTimeAsync(2);
    required(sockets[2]).close();
    expect(onState).toHaveBeenLastCalledWith("error");
    client.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(sockets).toHaveLength(3);
  });
  it("deduplicates snapshot/live overlap and bounds browser state to 100", () => {
    const events = Array.from({ length: 120 }, (_, n) => event(n));
    const merged = mergeActivity(events, events.slice(-10));
    expect(merged).toHaveLength(100);
    expect(new Set(merged.map((e) => e.id)).size).toBe(100);
    expect(merged[0]).toEqual(events.at(-1));
  });
  it("formats every canonical event with human copy, safe links and lightweight relative time", () => {
    for (const type of ACTIVITY_TYPES) {
      const entity = type.startsWith("task.")
        ? { type: "task", id: "task-00000000-0000-4000-8000-000000000001" }
        : type.startsWith("message.")
          ? { type: "message", id: "msg-00000000-0000-4000-8000-000000000001" }
          : type.startsWith("router.")
            ? { type: "router", id: "router" }
            : { type: "agent", id: "nova" };
      const metadata = type.startsWith("task.")
        ? { taskTitle: "Login", assigneeId: "nova", assigneeName: "Nova" }
        : type.startsWith("message.")
          ? { from: "nova", to: "atlas", messageType: "message" }
          : type.startsWith("router.")
            ? {}
            : { agentName: "Nova" };
      const display = formatActivityEvent(
        ActivityEventSchema.parse({ ...event(), type, entity, metadata }),
      );
      expect(display.title).toBeTruthy();
      expect(display.title).not.toContain("undefined");
      expect(display.href).toMatch(/^\//);
      expect(display.icon).toBeTruthy();
    }
    const time = "2026-10-04T00:00:00.000Z";
    expect(relativeActivityTime(time, Date.parse(time) + 120000)).toBe("2m ago");
  });
});
