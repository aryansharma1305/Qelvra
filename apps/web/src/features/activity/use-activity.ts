import { useEffect, useState } from "react";
import type { ActivityEvent, ActivityStatus } from "@qelvra/shared";
import { connectActivityStream, type ConnectionState } from "./activity-client";
import { listActivity } from "../../lib/api";
export function mergeActivity(
  events: readonly ActivityEvent[],
  incoming: readonly ActivityEvent[],
) {
  const unique = new Map([...events, ...incoming].map((event) => [event.id, event]));
  return [...unique.values()]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id))
    .slice(0, 100);
}
export function useActivity() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [state, setState] = useState<ConnectionState>("loading");
  const [status, setStatus] = useState<ActivityStatus | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [olderError, setOlderError] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    // Fresh buffer per connection lifetime; REST refresh replaces stale cached pages.
    const buffer: ActivityEvent[] = [];
    const stream = connectActivityStream({
      onState: setState,
      onStatus: setStatus,
      onEvent: (event) => {
        buffer.push(event);
        if (buffer.length > 100) buffer.shift();
        setEvents((current) => mergeActivity(current, [event]));
      },
      onSnapshot: (snapshot) => {
        setEvents(mergeActivity(snapshot.events, buffer));
        setCursor(snapshot.nextCursor);
        setStatus(snapshot.status);
      },
    });
    return () => stream.dispose();
  }, [retry]);
  const loadOlder = async () => {
    if (!cursor || loadingOlder) return;
    setLoadingOlder(true);
    setOlderError(false);
    try {
      const page = await listActivity({ limit: 100, cursor });
      setEvents(page.events);
      setCursor(page.nextCursor);
    } catch {
      setOlderError(true);
    } finally {
      setLoadingOlder(false);
    }
  };
  return {
    events,
    state,
    status,
    cursor,
    olderError,
    loadingOlder,
    loadOlder,
    retry: () => {
      setOlderError(false);
      setRetry((value) => value + 1);
    },
  };
}
export type ActivityFeedState = ReturnType<typeof useActivity>;
