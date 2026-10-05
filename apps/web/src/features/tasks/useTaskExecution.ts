import { useCallback, useEffect, useState } from "react";
import type { TaskExecutionResponse } from "@qelvra/shared";
import { getTaskExecution, executeTask, cancelTaskExecution } from "../../lib/api";
import { reloadTask } from "./tasks-store";
export function useTaskExecution(taskId: string) {
  const [data, setData] = useState<TaskExecutionResponse>({ execution: null, result: null });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const active =
    !!data.execution &&
    ["queued", "starting", "running", "awaiting_result"].includes(data.execution.status);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const next = await getTaskExecution(taskId, signal ? { signal } : undefined);
        if (signal?.aborted) return;
        setData(next);
        setError(null);
        if (
          next.execution &&
          !["queued", "starting", "running", "awaiting_result"].includes(next.execution.status)
        )
          await reloadTask(taskId);
      } catch (error) {
        if (!signal?.aborted)
          setError(error instanceof Error ? error.message : "Could not load execution status");
      }
    },
    [taskId],
  );
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void load(controller.signal);
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let reading = false;
    const timer = setInterval(() => {
      if (!reading) {
        reading = true;
        void load(controller.signal).finally(() => {
          reading = false;
        });
      }
    }, 750);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [active, load]);
  const run = async (cancel = false) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const response = await (cancel ? cancelTaskExecution : executeTask)(taskId);
      setData(response);
      await reloadTask(taskId);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Execution failed");
      await reloadTask(taskId).catch(() => undefined);
    } finally {
      setPending(false);
    }
  };
  return { ...data, active, pending, error, run, reload: () => load() };
}
