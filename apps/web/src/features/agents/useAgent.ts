import type { Agent } from "@qelvra/shared";
import { useEffect, useState } from "react";
import { ApiError, getAgent } from "../../lib/api";

export type AgentLookup =
  | { status: "loading" }
  | { status: "found"; agent: Agent }
  | { status: "not_found" }
  | { status: "error"; message: string };

type Settled = Exclude<AgentLookup, { status: "loading" }>;

/**
 * Fetches one agent. Each result is tagged with the request it answers, so a response for
 * a previous id can never be shown; changing `id` or unmounting also aborts the request.
 */
export function useAgent(id: string, reloadKey = 0): AgentLookup {
  const requestKey = `${id}#${reloadKey}`;
  const [result, setResult] = useState<{ key: string; lookup: Settled } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getAgent(id, { signal: controller.signal }).then(
      (agent) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, lookup: { status: "found", agent } });
        }
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const lookup: Settled =
          error instanceof ApiError && error.status === 404
            ? { status: "not_found" }
            : {
                status: "error",
                message: error instanceof Error ? error.message : "Could not load agent",
              };
        setResult({ key: requestKey, lookup });
      },
    );
    return () => controller.abort();
  }, [id, requestKey]);

  return result?.key === requestKey ? result.lookup : { status: "loading" };
}
