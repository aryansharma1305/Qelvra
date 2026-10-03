import type { Agent } from "@qelvra/shared";
import { STATUS_GROUP, type StatusGroup } from "../../features/agents/presentation";

// Filtering for the Agents page, over real agents from the registry.

export const STATUS_GROUPS: readonly StatusGroup[] = ["working", "thinking", "waiting", "offline"];

/** The design's capability tags. Agents have no capabilities until providers exist. */
export const CAPABILITY_TAGS = [
  "React",
  "TypeScript",
  "Testing",
  "Research",
  "Design",
  "Node.js",
  "Redis",
  "Orchestration",
] as const;

export interface DirectoryFilters {
  query: string;
  status: StatusGroup | "all";
}

export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = { query: "", status: "all" };

export function matchesDirectoryFilters(agent: Agent, filters: DirectoryFilters): boolean {
  if (filters.status !== "all" && STATUS_GROUP[agent.status] !== filters.status) return false;
  const query = filters.query.trim().toLowerCase();
  if (!query) return true;
  return [agent.id, agent.name, agent.role].join(" ").toLowerCase().includes(query);
}

export function countByStatus(agents: readonly Agent[], status: StatusGroup | "all"): number {
  return status === "all"
    ? agents.length
    : agents.filter((agent) => STATUS_GROUP[agent.status] === status).length;
}

/** Header summary, e.g. "3 Operatives • 1 Working • 2 Offline". */
export function summarizeAgents(agents: readonly Agent[]): string {
  const parts = [`${agents.length} ${agents.length === 1 ? "Operative" : "Operatives"}`];
  const labels: Record<StatusGroup, string> = {
    working: "Working",
    thinking: "Thinking",
    waiting: "Waiting",
    offline: "Offline",
  };
  for (const group of STATUS_GROUPS) {
    const count = countByStatus(agents, group);
    if (count > 0) parts.push(`${count} ${labels[group]}`);
  }
  return parts.join(" • ");
}
