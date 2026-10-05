import { useEffect, useState } from "react";
import type { Orchestration } from "@qelvra/shared";
import { listOrchestrations } from "../../lib/api";
import { connectActivityStream } from "../activity/activity-client";
import { refreshTasks } from "../tasks/tasks-store";

export function useOrchestrations() {
  const [goals, setGoals] = useState<Orchestration[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false,
      fetching = false,
      queued = false,
      active = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const load = async () => {
      if (disposed) return;
      if (fetching) {
        queued = true;
        return;
      }
      fetching = true;
      try {
        const [value] = await Promise.all([
          listOrchestrations({ signal: controller.signal }),
          refreshTasks(true),
        ]);
        if (!disposed) {
          setGoals(value);
          setError(null);
          active = value.some((g) => ["planning", "running", "reviewing"].includes(g.status));
        }
      } catch (error) {
        if (!disposed)
          setError(error instanceof Error ? error.message : "Goals could not be loaded.");
      } finally {
        fetching = false;
        if (!disposed) setLoading(false);
        if (queued && !disposed) {
          queued = false;
          void load();
        }
      }
    };
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void load();
      }, 100);
    };
    const stream = connectActivityStream({
      onSnapshot: schedule,
      onState: () => {},
      onStatus: () => {},
      onEvent: (e) => {
        if (/^(orchestration|execution|task)\./.test(e.type)) schedule();
      },
    });
    const fallback = setInterval(() => {
      if (active) schedule();
    }, 2000);
    void load();
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timer);
      clearInterval(fallback);
      stream.dispose();
    };
  }, [retry]);
  return { goals, error, loading, refresh: () => setRetry((n) => n + 1) };
}
