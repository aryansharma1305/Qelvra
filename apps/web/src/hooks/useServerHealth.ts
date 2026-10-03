import type { HealthResponse } from "@qelvra/shared";
import { useEffect, useState } from "react";
import { getHealth } from "../lib/api";

export type ServerConnection =
  | { state: "checking" }
  | { state: "connected"; health: HealthResponse }
  | { state: "disconnected"; reason: string };

const POLL_INTERVAL_MS = 10_000;

/**
 * Polls GET /api/health. Re-checks immediately when the window regains focus or the
 * browser comes back online, so a restarted server is picked up quickly.
 */
export function useServerHealth(intervalMs = POLL_INTERVAL_MS): ServerConnection {
  const [connection, setConnection] = useState<ServerConnection>({ state: "checking" });

  useEffect(() => {
    let disposed = false;
    let inFlight: AbortController | null = null;

    const check = async () => {
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;
      try {
        const health = await getHealth({ signal: controller.signal });
        if (!disposed && !controller.signal.aborted) setConnection({ state: "connected", health });
      } catch (error) {
        if (disposed || controller.signal.aborted) return;
        setConnection({
          state: "disconnected",
          reason: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), intervalMs);
    const recheck = () => void check();
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);

    return () => {
      disposed = true;
      inFlight?.abort();
      window.clearInterval(timer);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
    };
  }, [intervalMs]);

  return connection;
}
