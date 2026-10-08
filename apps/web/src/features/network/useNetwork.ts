import { useEffect, useRef, useState } from "react";
import type { NetworkResponse, NetworkWindow } from "@qelvra/shared";
import { getNetwork } from "../../lib/api";
import { connectActivityStream, type ConnectionState } from "../activity/activity-client";

/** Activity invalidates the projection; graph truth always comes from GET /api/network. */
export function useNetwork(window: NetworkWindow) {
  const [data, setData] = useState<NetworkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState | "paused">("loading");
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    let disposed = false,
      fetching = false,
      queued = false;
    let request: AbortController | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let fallback: ReturnType<typeof setInterval> | undefined;
    let stream: ReturnType<typeof connectActivityStream> | undefined;
    const visible = () => !disposed && document.visibilityState !== "hidden";
    const load = async () => {
      if (!visible()) return;
      if (fetching) {
        queued = true;
        return;
      }
      fetching = true;
      const current = new AbortController();
      request = current;
      setLoading(true);
      try {
        const result = await getNetwork({ window }, { signal: current.signal });
        if (!disposed && !current.signal.aborted) {
          setData(result);
          setError(null);
        }
      } catch (failure) {
        if (!disposed && !current.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Network could not be loaded. Retry when the server is available.",
          );
      } finally {
        fetching = false;
        if (!disposed && !current.signal.aborted) setLoading(false);
        if (queued && visible()) {
          queued = false;
          void load();
        }
      }
    };
    const schedule = () => {
      if (!visible()) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => void load(), 150);
    };
    const stop = () => {
      clearTimeout(debounce);
      clearInterval(fallback);
      stream?.dispose();
      stream = undefined;
      queued = false;
      request?.abort();
    };
    const start = () => {
      if (!visible()) return;
      stream = connectActivityStream({
        onSnapshot: schedule,
        onState: setConnection,
        onStatus: schedule,
        onEvent: (event) => {
          if (/^(agent|task|execution|orchestration|message)\./.test(event.type)) schedule();
        },
      });
      fallback = setInterval(schedule, 10000);
      void load();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
        setConnection("paused");
        setLoading(false);
      } else start();
    };
    refreshRef.current = () => void load();
    document.addEventListener("visibilitychange", visibility);
    void Promise.resolve().then(() => {
      if (!disposed) {
        if (visible()) start();
        else {
          setConnection("paused");
          setLoading(false);
        }
      }
    });
    return () => {
      disposed = true;
      stop();
      refreshRef.current = () => {};
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [window]);
  return { data, loading, error, connection, refresh: () => refreshRef.current() };
}
