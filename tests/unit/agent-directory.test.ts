import type { Agent, AgentStatus } from "@qelvra/shared";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_DIRECTORY_FILTERS,
  countByStatus,
  matchesDirectoryFilters,
  summarizeAgents,
  type DirectoryFilters,
} from "../../apps/web/src/pages/agents/agentDirectory";
import { relativeTime, toDirectoryCard } from "../../apps/web/src/features/agents/presentation";

function agent(id: string, name: string, role: string, status: AgentStatus = "stopped"): Agent {
  return {
    id,
    name,
    role,
    status,
    providerId: null,
    createdAt: "2026-10-03T10:00:00.000Z",
    updatedAt: "2026-10-03T10:00:00.000Z",
  };
}

const AGENTS = [
  agent("frontend-nova", "Frontend Nova", "Frontend Engineer", "working"),
  agent("atlas", "Atlas", "Backend Engineer", "running"),
  agent("pixel", "Pixel", "Designer", "idle"),
  agent("echo", "Echo", "Researcher", "stopped"),
  agent("scout", "Scout", "QA", "error"),
];

const visible = (patch: Partial<DirectoryFilters>) =>
  AGENTS.filter((a) => matchesDirectoryFilters(a, { ...DEFAULT_DIRECTORY_FILTERS, ...patch })).map(
    (a) => a.id,
  );

describe("agent directory filters", () => {
  it("shows every agent by default", () => {
    expect(visible({})).toHaveLength(5);
  });

  it("groups lifecycle states into the design's status tabs", () => {
    // "Working" is only for agents with a task; a running shell without one is waiting.
    expect(visible({ status: "working" })).toEqual(["frontend-nova"]);
    expect(visible({ status: "waiting" })).toEqual(["atlas", "pixel"]);
    expect(visible({ status: "offline" })).toEqual(["echo", "scout"]);
    expect(visible({ status: "thinking" })).toEqual([]);
  });

  it("searches name, role and id case-insensitively", () => {
    expect(visible({ query: "  NOVA " })).toEqual(["frontend-nova"]);
    expect(visible({ query: "backend" })).toEqual(["atlas"]);
    expect(visible({ query: "frontend-nova" })).toEqual(["frontend-nova"]);
    expect(visible({ query: "nothing" })).toEqual([]);
  });

  it("counts per tab and summarizes the team", () => {
    expect(countByStatus(AGENTS, "all")).toBe(5);
    expect(countByStatus(AGENTS, "working")).toBe(1);
    expect(summarizeAgents(AGENTS)).toBe("5 Operatives • 1 Working • 2 Waiting • 2 Offline");
    expect(summarizeAgents([AGENTS[3] as Agent])).toBe("1 Operative • 1 Offline");
    expect(summarizeAgents([])).toBe("0 Operatives");
  });
});

describe("agent card presentation", () => {
  const now = Date.parse("2026-10-03T10:05:00.000Z");

  it("shows real fields and no invented runtime data", () => {
    const card = toDirectoryCard(agent("echo", "Echo", "Researcher", "stopped"), now);
    expect(card).toMatchObject({
      id: "echo",
      name: "Echo",
      role: "Researcher",
      status: "offline",
      statusLabel: "Stopped",
      model: "No provider",
      currentTask: "No active task",
      contextUsage: "Not running",
      lastActive: "created 5 minutes ago",
    });
    expect(card.tone.contextBar).toContain("w-0");
    expect(JSON.stringify(card)).not.toMatch(/\d+k \/ \d+k|loop #|tokens\/sec/);
  });

  it("shows a running agent's shell honestly", () => {
    const card = toDirectoryCard(agent("atlas", "Atlas", "Backend", "running"), now);
    expect(card).toMatchObject({
      status: "waiting",
      statusLabel: "Running",
      statusMeta: "local shell",
      runtime: "Shell running",
      currentTask: "No active task",
    });
  });

  it("formats relative times", () => {
    expect(relativeTime("2026-10-03T10:04:50.000Z", now)).toBe("just now");
    expect(relativeTime("2026-10-03T09:05:00.000Z", now)).toBe("1 hour ago");
    expect(relativeTime("2026-10-01T10:05:00.000Z", now)).toBe("2 days ago");
  });
});
