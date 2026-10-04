import {
  ActivityStreamMessageSchema,
  type ActivityEvent,
  type ActivityListResponse,
  type ActivityStatus,
} from "@qelvra/shared";
import { apiBaseUrl, listActivity } from "../../lib/api";
import { toWebSocketUrl } from "../../lib/ws";
export type ConnectionState = "loading" | "live" | "reconnecting" | "error";
interface Options {
  onSnapshot: (snapshot: ActivityListResponse) => void;
  onEvent: (event: ActivityEvent) => void;
  onStatus: (status: ActivityStatus) => void;
  onState: (state: ConnectionState) => void;
  socketFactory?: (url: string) => WebSocket;
  fetchLatest?: (signal: AbortSignal) => Promise<ActivityListResponse>;
  retryDelays?: readonly number[];
}
/** Connect first, then REST: events arriving during the snapshot are buffered by the hook. */
export function connectActivityStream(options: Options) {
  let stopped = false;
  let socket: WebSocket | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | null = null;
  let handshakeTimer: ReturnType<typeof setTimeout> | undefined;
  let attempts = 0;
  const delays = options.retryDelays ?? [500, 1000, 2000, 4000, 8000];
  const connect = () => {
    if (stopped) return;
    options.onState(attempts ? "reconnecting" : "loading");
    const current = (options.socketFactory ?? ((url) => new WebSocket(url)))(
      toWebSocketUrl(apiBaseUrl, "/ws/activity"),
    );
    socket = current;
    handshakeTimer = setTimeout(() => current.close(), 5000);
    current.onopen = async () => {
      clearTimeout(handshakeTimer);
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const snapshot = await (
          options.fetchLatest ?? ((signal) => listActivity({ limit: 100 }, { signal }))
        )(request.signal);
        if (stopped || socket !== current || request.signal.aborted) return;
        options.onSnapshot(snapshot);
        options.onState("live");
      } catch {
        if (!stopped && !request.signal.aborted) current.close();
      }
    };
    current.onmessage = (message) => {
      if (stopped || socket !== current) return;
      let raw: unknown;
      try {
        raw = JSON.parse(message.data as string);
      } catch {
        current.close(1008, "Invalid activity frame");
        return;
      }
      const parsed = ActivityStreamMessageSchema.safeParse(raw);
      if (!parsed.success) {
        current.close(1008, "Invalid activity frame");
        return;
      }
      if (parsed.data.type === "activity.event") options.onEvent(parsed.data.event);
      else options.onStatus(parsed.data.status);
    };
    current.onerror = () => current.close();
    current.onclose = () => {
      clearTimeout(handshakeTimer);
      controller?.abort();
      if (stopped) return;
      const delay = delays[attempts++];
      if (delay === undefined) {
        options.onState("error");
        return;
      }
      options.onState("reconnecting");
      timer = setTimeout(connect, delay);
    };
  };
  connect();
  return {
    dispose() {
      stopped = true;
      clearTimeout(timer);
      clearTimeout(handshakeTimer);
      controller?.abort();
      socket?.close();
    },
  };
}
