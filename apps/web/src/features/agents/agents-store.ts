import type { Agent, CreateAgentRequest } from "@qelvra/shared";
import { useEffect, useSyncExternalStore } from "react";
import {
  ApiError,
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
  restartAgent,
  startAgent,
  stopAgent,
  type AgentLifecycleAction,
} from "../../lib/api";

// One shared agent list for every view that shows agents (Agents page, profile, terminal,
// sidebar, header). Mutations go through the API first and update the list only on
// success. The list is refetched when the window regains focus, so statuses changed while
// away (e.g. a shell that exited) show up without polling.

export type AgentAction = AgentLifecycleAction | "delete";

export interface AgentsState {
  status: "idle" | "loading" | "ready" | "error";
  agents: readonly Agent[];
  error: string | null;
  /** The action in flight per agent; its controls are disabled meanwhile. */
  pending: Readonly<Record<string, AgentAction>>;
}

const INITIAL: AgentsState = { status: "idle", agents: [], error: null, pending: {} };
let state: AgentsState = INITIAL;
const listeners = new Set<() => void>();
let inflight: AbortController | null = null;

function setState(next: AgentsState): void {
  state = next;
  for (const listener of listeners) listener();
}

function onFocus(): void {
  if (state.status !== "idle") void refreshAgents();
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) window.addEventListener("focus", onFocus);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("focus", onFocus);
  };
}

function upsert(agent: Agent): void {
  const exists = state.agents.some((a) => a.id === agent.id);
  setState({
    ...state,
    agents: exists
      ? state.agents.map((a) => (a.id === agent.id ? agent : a))
      : [...state.agents, agent],
  });
}

function withoutPending(id: string): Record<string, AgentAction> {
  return Object.fromEntries(Object.entries(state.pending).filter(([key]) => key !== id));
}

function setPending(id: string, action: AgentAction | null): void {
  setState({ ...state, pending: action ? { ...state.pending, [id]: action } : withoutPending(id) });
}

/** (Re)loads the list; a newer call cancels an older one. */
export async function refreshAgents(): Promise<void> {
  inflight?.abort();
  const controller = new AbortController();
  inflight = controller;
  setState({ ...state, status: "loading", error: null });
  try {
    const agents = await listAgents({ signal: controller.signal });
    if (!controller.signal.aborted) setState({ ...state, status: "ready", agents, error: null });
  } catch (error) {
    if (controller.signal.aborted) return;
    setState({
      ...state,
      status: "error",
      error: error instanceof Error ? error.message : "Could not load agents",
    });
  }
}

export async function createAgentInStore(input: CreateAgentRequest): Promise<Agent> {
  const agent = await createAgent(input);
  setState({ ...state, agents: [...state.agents.filter((a) => a.id !== agent.id), agent] });
  return agent;
}

/**
 * Deletes on the server (which stops a running agent first); an agent that is already
 * gone is simply removed locally.
 */
export async function deleteAgentInStore(id: string): Promise<void> {
  if (state.pending[id]) return;
  setPending(id, "delete");
  try {
    await deleteAgent(id);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) {
      setPending(id, null);
      throw error;
    }
  }
  setState({
    ...state,
    agents: state.agents.filter((a) => a.id !== id),
    pending: withoutPending(id),
  });
}

const LIFECYCLE = { start: startAgent, stop: stopAgent, restart: restartAgent } as const;

/**
 * Starts, stops or restarts an agent. Ignored while another action for the same agent is
 * in flight (the server serializes them too). On failure the agent is reloaded, so the
 * UI shows the status the server settled on (e.g. "error"), then the error is rethrown.
 */
export async function runAgentAction(id: string, action: AgentLifecycleAction): Promise<void> {
  if (state.pending[id]) return;
  setPending(id, action);
  try {
    upsert(await LIFECYCLE[action](id));
  } catch (error) {
    await reloadAgent(id);
    throw error;
  } finally {
    setPending(id, null);
  }
}

/** Refetches one agent (e.g. after its terminal reported an exit). */
export async function reloadAgent(id: string): Promise<void> {
  try {
    upsert(await getAgent(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      setState({ ...state, agents: state.agents.filter((a) => a.id !== id) });
    }
  }
}

/** The shared list; loads it on first use. */
export function useAgents(): AgentsState {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    if (state.status === "idle") void refreshAgents();
  }, []);
  return snapshot;
}

/** Test-only: reset module state between tests. */
export function resetAgentsStoreForTests(): void {
  inflight?.abort();
  inflight = null;
  state = INITIAL;
}
